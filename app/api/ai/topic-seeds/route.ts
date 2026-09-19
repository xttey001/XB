import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseJsonArray, stripHtml } from '@/lib/utils';

/**
 * GET /api/ai/topic-seeds
 *
 * 返回 NoteLink 统计前 N 的笔记，适合当主题树的根。
 * 按入链数 + 出链数降序。
 */
export async function GET() {
  const topNotes = await prisma.$queryRaw<Array<{ id: string; inCnt: bigint; outCnt: bigint }>>`
    SELECT n.id,
      COUNT(DISTINCT CASE WHEN l.targetId = n.id THEN l.sourceId END) as inCnt,
      COUNT(DISTINCT CASE WHEN l.sourceId = n.id THEN l.targetId END) as outCnt
    FROM Note n
    LEFT JOIN NoteLink l ON l.sourceId = n.id OR l.targetId = n.id
    GROUP BY n.id
    HAVING inCnt > 0 OR outCnt > 0
    ORDER BY (inCnt + outCnt) DESC
    LIMIT 80
  `;

  if (topNotes.length === 0) {
    return NextResponse.json({ seeds: [] });
  }

  const ids = topNotes.map((n) => n.id);
  const notes = await prisma.note.findMany({
    where: { id: { in: ids } },
    include: { category: true },
  });
  const noteMap = new Map(notes.map((n) => [n.id, n]));

  const seeds = topNotes.map((row) => {
    const n = noteMap.get(row.id)!;
    return {
      id: row.id,
      summary: stripHtml(n.content).slice(0, 120),
      categoryName: n.category?.name || null,
      importance: n.importance,
      isFavorite: n.isFavorite,
      tags: parseJsonArray<string>(n.tags),
      inCount: Number(row.inCnt),
      outCount: Number(row.outCnt),
      totalCount: Number(row.inCnt) + Number(row.outCnt),
    };
  });

  return NextResponse.json({ seeds });
}
