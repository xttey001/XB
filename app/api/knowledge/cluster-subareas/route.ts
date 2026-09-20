import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { callLLM, parseLLMJSON, llmAvailable } from '@/lib/llm';

/**
 * POST /api/knowledge/cluster-subareas — AI 建议哪些扁平 Category 应该聚成子分类
 * body: { areaId: string }  指定某个 KnowledgeArea
 * 返回: { suggestions: [{ subAreaName, memberIds: string[], rationale }] }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { areaId } = body;
  if (!areaId) return NextResponse.json({ error: 'areaId required' }, { status: 400 });

  const area = await prisma.knowledgeArea.findUnique({ where: { id: areaId } });
  if (!area) return NextResponse.json({ error: 'area not found' }, { status: 404 });

  // 找该 Area 下所有"顶层、无子"的 Category（扁平分类）
  const flatCats = await prisma.category.findMany({
    where: { knowledgeAreaId: areaId, parentId: null },
    include: {
      children: true,
      _count: { select: { notes: true } },
    },
  });
  const leafCats = flatCats.filter((c) => c.children.length === 0);

  if (leafCats.length <= 3) {
    return NextResponse.json({
      suggestions: [],
      message: '当前分类数较少（<=3），暂不需要子分类',
    });
  }

  // 有 LLM 就走 LLM
  if (llmAvailable()) {
    try {
      const catList = leafCats
        .map((c, i) => `${i}. ${c.name} (${c._count.notes}条)`)
        .join('\n');

      const prompt = `我有一个知识领域「${area.name}」，包含这些分类：
${catList}

请把这些分类自动聚成 2-5 个"子分类"，每个子分类是一个主题容器，包含若干相关的叶子分类。
子分类名称要简洁（2-6字），能概括其成员的共同主题。

输出严格 JSON：
{
  "clusters": [
    {
      "subAreaName": "技术指标",
      "memberIndices": [0, 3, 5],
      "rationale": "这些都是具体指标类"
    }
  ]
}
只输出 JSON，不要任何其他文字。`;

      const raw = await callLLM(prompt);
      const parsed = parseLLMJSON<{ clusters: Array<{ subAreaName: string; memberIndices: number[]; rationale: string }> }>(raw);

      const suggestions = (parsed.clusters || []).map((cl) => ({
        subAreaName: cl.subAreaName,
        memberIds: cl.memberIndices
          .filter((i) => i >= 0 && i < leafCats.length)
          .map((i) => leafCats[i].id),
        rationale: cl.rationale,
      }));

      return NextResponse.json({ suggestions });
    } catch (e) {
      console.warn('[cluster-subareas] LLM 失败:', (e as Error).message);
    }
  }

  // 兜底：基于关键词的确定性聚类（简单分组，关键词相同的归一起）
  const groups = new Map<string, string[]>();
  for (const cat of leafCats) {
    let matched = false;
    for (const [key, ids] of groups) {
      if (key.length > 1 && cat.name.includes(key)) {
        ids.push(cat.id);
        matched = true;
        break;
      }
    }
    if (!matched) groups.set(cat.name.slice(0, 2), [cat.id]);
  }

  const suggestions = Array.from(groups.entries())
    .filter(([, ids]) => ids.length >= 2)
    .map(([key, ids]) => ({
      subAreaName: key + '类',
      memberIds: ids,
      rationale: '关键词匹配',
    }));

  return NextResponse.json({ suggestions });
}

/**
 * POST /api/knowledge/cluster-subareas/apply — 把建议应用到数据库
 * body: { areaId, suggestions }  建议列表，每个含 subAreaName + memberIds
 * 会自动创建子分类 Category，然后把 memberIds 挂进去
 */
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { areaId, suggestions } = body;
  if (!areaId || !Array.isArray(suggestions)) {
    return NextResponse.json({ error: 'areaId + suggestions[] required' }, { status: 400 });
  }

  let createdSubs = 0;
  let movedCats = 0;

  for (const s of suggestions) {
    if (!s.subAreaName || !Array.isArray(s.memberIds) || s.memberIds.length === 0) continue;

    // 先检查是否已存在同名子分类
    let subCat = await prisma.category.findFirst({
      where: { name: s.subAreaName, knowledgeAreaId: areaId, parentId: null },
    });
    if (!subCat) {
      subCat = await prisma.category.create({
        data: {
          name: s.subAreaName,
          knowledgeAreaId: areaId,
          color: '#654ACB',
        },
      });
      createdSubs++;
    }

    // 把成员挂进去
    for (const memberId of s.memberIds) {
      try {
        await prisma.category.update({
          where: { id: memberId },
          data: { parentId: subCat.id, knowledgeAreaId: areaId },
        });
        movedCats++;
      } catch {
        // 跳过
      }
    }
  }

  return NextResponse.json({ createdSubs, movedCats });
}
