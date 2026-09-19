import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseJsonArray, stripHtml } from '@/lib/utils';

interface RouteParams {
  params: { id: string };
}

interface Suggestion {
  id: string;
  summary: string;
  tags: string[];
  categoryId: string | null;
  categoryName: string | null;
  importance: string | null;
  createdAt: string;
  // 为什么推荐这条
  reasons: string[];
  score: number;
}

/**
 * GET /api/notes/[id]/link-suggestions?limit=5
 *
 * 返回与指定笔记"可能相关但还没手动链接"的笔记。
 *
 * 推荐信号（加权求和）：
 *   - tag 交集数 × 3
 *   - 同分类 × 2
 *   - 内容关键词重叠 × 1
 *
 * 排除：
 *   - 自己
 *   - 已存在 NoteLink 的笔记（无论出链还是入链）
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const noteId = params.id;
  const url = new URL(_req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 5), 1), 20);

  const source = await prisma.note.findUnique({
    where: { id: noteId },
    include: { category: true },
  });
  if (!source) {
    return NextResponse.json({ error: '笔记不存在' }, { status: 404 });
  }

  const sourceTags = parseJsonArray<string>(source.tags);
  const sourceText = stripHtml(source.content).toLowerCase();
  // 简单分词：英文按空格，中文按单字 + 连续 2 字组合（粗糙但够用）
  const sourceWords = new Set<string>();
  const enWords = sourceText.split(/[^a-z0-9]+/).filter((w) => w.length >= 2);
  enWords.forEach((w) => sourceWords.add(w));
  // 中文 2-gram
  const zh = stripHtml(source.content).replace(/[\u4e00-\u9fff]/g, '');
  // 不对 zh 做进一步处理，避免极端情况误判，只靠 enWords + tags + category

  // 已链接的笔记 ID（双向都排除）
  const linked = await prisma.noteLink.findMany({
    where: { OR: [{ sourceId: noteId }, { targetId: noteId }] },
    select: { sourceId: true, targetId: true },
  });
  const linkedIds = new Set<string>();
  linked.forEach((l) => {
    if (l.sourceId === noteId) linkedIds.add(l.targetId);
    if (l.targetId === noteId) linkedIds.add(l.sourceId);
  });
  linkedIds.add(noteId); // 排除自身

  // 候选笔记：同分类 或 有至少一个 tag 匹配
  const where: any = {
    id: { notIn: Array.from(linkedIds) },
  };
  if (source.categoryId || sourceTags.length > 0) {
    const conditions: any[] = [];
    if (source.categoryId) conditions.push({ categoryId: source.categoryId });
    if (sourceTags.length > 0) {
      sourceTags.forEach((tag) => conditions.push({ tags: { contains: `"${tag}"` } }));
    }
    if (conditions.length > 1) {
      where.OR = conditions;
    } else {
      Object.assign(where, conditions[0]);
    }
  }

  const candidates = await prisma.note.findMany({
    where,
    include: { category: true },
    take: limit * 3, // 多取一些，后面按分数排序截取
  });

  const scored: Suggestion[] = candidates.map((c) => {
    const cTags = parseJsonArray<string>(c.tags);
    const reasons: string[] = [];
    let score = 0;

    // 信号 1：tag 交集
    const tagIntersection = cTags.filter((t) => sourceTags.includes(t));
    if (tagIntersection.length > 0) {
      score += tagIntersection.length * 3;
      reasons.push(`共享标签: ${tagIntersection.slice(0, 3).join(', ')}${tagIntersection.length > 3 ? ` +${tagIntersection.length - 3}` : ''}`);
    }

    // 信号 2：同分类
    if (source.categoryId && c.categoryId === source.categoryId) {
      score += 2;
      reasons.push(`同分类: ${c.category?.name || ''}`);
    }

    // 信号 3：内容关键词重叠（只在 tag/category 信号弱时作为补充）
    if (reasons.length <= 1 && sourceWords.size > 0) {
      const cText = stripHtml(c.content).toLowerCase();
      let overlap = 0;
      for (const w of sourceWords) {
        if (cText.includes(w)) overlap++;
      }
      if (overlap >= 2) {
        score += Math.min(overlap, 5);
        reasons.push(`内容关键词重叠 ${overlap} 个`);
      }
    }

    return {
      id: c.id,
      summary: stripHtml(c.content).slice(0, 100) + (c.content.length > 100 ? '…' : ''),
      tags: cTags,
      categoryId: c.categoryId,
      categoryName: c.category?.name || null,
      importance: c.importance,
      createdAt: c.createdAt.toISOString(),
      reasons,
      score,
    };
  });

  // 只返回有至少一个理由的，按分数降序
  const results = scored
    .filter((s) => s.reasons.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return NextResponse.json({ suggestions: results });
}
