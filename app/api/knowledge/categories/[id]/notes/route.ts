import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/knowledge/categories/[id]/notes
 * Query params:
 *   includeDescendants=true  → 递归拉所有子分类的笔记
 *   limit=100
 * Returns: { notes: [...], categoryId, total }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const url = new URL(req.url);
  const includeDescendants = url.searchParams.get('includeDescendants') === 'true';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '200'), 500);

  // 先确认分类存在
  const cat = await prisma.category.findUnique({ where: { id: params.id } });
  if (!cat) return NextResponse.json({ error: 'category not found' }, { status: 404 });

  let catIds = [cat.id];

  if (includeDescendants) {
    // 递归找所有后代 ID
    const allCats = await prisma.category.findMany();
    catIds = collectDescendantIds(allCats, cat.id);
  }

  const notes = await prisma.note.findMany({
    where: { categoryId: { in: catIds } },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      category: true,
      _count: { select: { likes: true, comments: true } },
    },
  });

  return NextResponse.json({
    notes: notes.map(n => ({
      id: n.id,
      content: n.content,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      category: n.category ? { id: n.category.id, name: n.category.name } : null,
      isFavorite: n.isFavorite,
      importance: n.importance,
      pinnedGlobal: n.pinnedGlobal,
      likeCount: n._count.likes,
      commentCount: n._count.comments,
    })),
    total: notes.length,
    categoryId: cat.id,
    categoryName: cat.name,
  });
}

function collectDescendantIds(allCats: any[], rootId: string): string[] {
  const childrenMap = new Map<string, string[]>();
  for (const c of allCats) {
    if (c.parentId) {
      const arr = childrenMap.get(c.parentId) || [];
      arr.push(c.id);
      childrenMap.set(c.parentId, arr);
    }
  }

  const result: string[] = [rootId];
  const stack = [rootId];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    const kids = childrenMap.get(cur) || [];
    for (const kid of kids) {
      result.push(kid);
      stack.push(kid);
    }
  }
  return result;
}
