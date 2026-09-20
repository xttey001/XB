/**
 * Phase 3b: 知识层级引擎
 *
 * 职责：
 *   1. 自动建议 Category → KnowledgeArea 的归属（聚类）
 *   2. 基于标签/实体/名称做文本相似度匹配
 *   3. 无 LLM 时走确定性策略；有 LLM 时让模型做语义聚类
 */

import { prisma } from '@/lib/prisma';
import { parseJsonArray } from '@/lib/utils';
import { callLLM, parseLLMJSON, llmAvailable } from '@/lib/llm';

export interface ClusterSuggestion {
  categoryId: string;
  categoryName: string;
  suggestedAreaId: string;
  suggestedAreaName: string;
  confidence: number;  // 0-1
}

const CLUSTER_SYSTEM_PROMPT = `你是一个知识管理助手。我会给你：
1. 用户定义的若干"知识领域"（KnowledgeArea），每个有一个简短的名称和描述
2. 用户已有的若干"分类"（Category），每个有名称、图标、笔记数量

你的任务：把每个 Category 建议挂到最合适的 KnowledgeArea 下。

输出严格 JSON：
{
  "assignments": [
    {
      "categoryName": "MTM各种细节",
      "areaName": "交易技术",
      "confidence": 0.92,
      "reason": "MTM 是技术指标，属于交易技术领域"
    }
  ]
}
只输出 JSON，不要任何解释性文字。如果某个 Category 实在不属于任何给定的 Area，可以用 "其他" 作为 areaName（即使"其他"没在列表里也可以用）。`;

/**
 * 自动聚类：建议每个 Category 应该挂到哪个 KnowledgeArea
 */
export async function autoClusterCategories(): Promise<ClusterSuggestion[]> {
  const areas = await prisma.knowledgeArea.findMany({ orderBy: { order: 'asc' } });
  const categories = await prisma.category.findMany({ include: { _count: { select: { notes: true } } } });

  if (areas.length === 0) {
    throw new Error('请先创建至少一个 KnowledgeArea（知识主干）');
  }

  // --- 有 LLM 时让模型做语义聚类 ---
  if (llmAvailable()) {
    try {
      const areaList = areas.map((a) => `- ${a.name}${a.description ? `：${a.description}` : ''}`).join('\n');
      const catList = categories
        .map((c) => `- ${c.name} (${c._count.notes} 条笔记)`)
        .join('\n');

      const raw = await callLLM(
        `## 可用的知识领域\n${areaList}\n\n## 待归类的分类\n${catList}\n\n请把每个分类建议挂到最合适的领域下。`,
        undefined,
        CLUSTER_SYSTEM_PROMPT
      );
      const parsed = parseLLMJSON<{ assignments: Array<{ categoryName: string; areaName: string; confidence: number; reason: string }> }>(raw);

      // 把 areaName 映射回 areaId
      const areaMap = new Map(areas.map((a) => [a.name, a]));
      const otherArea = areas.find((a) => a.name === '其他');
      const results: ClusterSuggestion[] = [];

      for (const assign of parsed.assignments || []) {
        const cat = categories.find((c) => c.name === assign.categoryName);
        if (!cat) continue;
        const area = areaMap.get(assign.areaName) || otherArea;
        if (!area) continue;
        results.push({
          categoryId: cat.id,
          categoryName: cat.name,
          suggestedAreaId: area.id,
          suggestedAreaName: area.name,
          confidence: assign.confidence ?? 0.5,
        });
      }

      return results;
    } catch (e) {
      console.warn('[autoCluster] LLM 失败，回退确定性:', (e as Error).message);
    }
  }

  // --- 兜底：基于关键词/实体的确定性聚类 ---
  return deterministicCluster(areas, categories);
}

/** 确定性聚类：用关键词匹配 + Entity 共现 */
function deterministicCluster(
  areas: Array<{ id: string; name: string; description: string | null }>,
  categories: Array<{ id: string; name: string; icon: string | null }>
): ClusterSuggestion[] {
  // 给每个 area 定义触发关键词（基于 area 名称 + 一些常见扩展）
  const areaKeywords: Record<string, string[]> = {};
  const DEFAULT_KEYWORDS: Record<string, string[]> = {
    交易技术: ['技术', '指标', 'VWAP', 'vwap', 'MTM', 'mtm', 'OBV', 'obv', 'ICT', 'POC', 'poc', 'h顶', 'h底', '形态', '技术运用', '曲线', '凹', '凸'],
    交易手法: ['手法', '操盘', '交易', '具体交易', '机构', 'lee', 'Lee', '操作'],
    交易心理: ['心理', '人性', '韭菜', '心态', '情绪', '失败', '成功', '经验'],
    宏观市场: ['宏观', '利率', '美元', '黄金', '原油', '加密', '比特币', '货币', '标的'],
    个人成长: ['思维', '模型', '自我', '预测', '反思', '成长', '总结'],
    人物: ['哥', '老师', '墙哥', '余哥', '李', 'naruto', '语录'],
    基础知识: ['基础', '入门', '必看', '重要', '经典', '话'],
    其他: [],
  };

  for (const area of areas) {
    const base = DEFAULT_KEYWORDS[area.name] || [];
    // 把 area 自己的名字也作为关键词
    const tokens = area.name.replace(/[^\w\u4e00-\u9fff]/g, ' ').split(/\s+/).filter(Boolean);
    areaKeywords[area.id] = [...base, ...tokens];
  }

  const results: ClusterSuggestion[] = [];

  for (const cat of categories) {
    const catText = (cat.icon || '') + ' ' + cat.name;
    let bestAreaId = areas[0].id;
    let bestScore = 0;

    for (const area of areas) {
      const kws = areaKeywords[area.id] || [];
      let score = 0;
      for (const kw of kws) {
        if (catText.toLowerCase().includes(kw.toLowerCase())) {
          score += kw.length; // 长关键词权重更高
        }
      }
      // 名词重叠加分（更宽松的匹配）
      const areaToken = area.name.replace(/[^\w\u4e00-\u9fff]/g, '').toLowerCase();
      const catToken = cat.name.replace(/[^\w\u4e00-\u9fff]/g, '').toLowerCase();
      if (areaToken && catToken && (catToken.includes(areaToken) || areaToken.includes(catToken))) {
        score += 3;
      }
      if (score > bestScore) {
        bestScore = score;
        bestAreaId = area.id;
      }
    }

    // 置信度：分数 / 满分（取 area 平均关键词长度 * 2 作为满分估算）
    const maxPossible = Math.max(1, ...Object.values(areaKeywords).map((kws) => kws.reduce((s, k) => s + k.length, 0)));
    const confidence = Math.min(0.95, Math.max(0.1, bestScore / maxPossible));

    const bestArea = areas.find((a) => a.id === bestAreaId)!;
    results.push({
      categoryId: cat.id,
      categoryName: cat.name,
      suggestedAreaId: bestAreaId,
      suggestedAreaName: bestArea.name,
      confidence: bestScore > 0 ? confidence : 0.3,
    });
  }

  return results;
}

/** 把建议批量应用（写入 Category.knowledgeAreaId） */
export async function applyClusters(suggestions: ClusterSuggestion[]): Promise<number> {
  let count = 0;
  for (const s of suggestions) {
    try {
      await prisma.category.update({
        where: { id: s.categoryId },
        data: { knowledgeAreaId: s.suggestedAreaId },
      });
      count++;
    } catch {
      // 唯一约束或其他冲突跳过
    }
  }
  return count;
}
