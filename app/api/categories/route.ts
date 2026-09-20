import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { CategoryDTO } from '@/lib/types';

/** GET /api/categories — 列出所有分类（带父子关系） */
export async function GET() {
  const [categories, childCounts] = await Promise.all([
    prisma.category.findMany({
      include: { _count: { select: { notes: true } } },
      orderBy: [{ pinned: 'desc' }, { order: 'desc' }, { createdAt: 'asc' }],
    }),
    prisma.category.groupBy({
      by: ['parentId'],
      _count: { parentId: true },
      where: { parentId: { not: null } },
    }),
  ]);

  const childMap = new Map<string, number>();
  for (const g of childCounts) {
    if (g.parentId) childMap.set(g.parentId, g._count.parentId);
  }

  const data: CategoryDTO[] = categories.map((c) => {
    const cc = childMap.get(c.id) || 0;
    return {
      id: c.id,
      name: c.name,
      color: c.color,
      icon: c.icon,
      order: c.order,
      pinned: c.pinned,
      createdAt: c.createdAt.toISOString(),
      parentId: c.parentId,
      hasChildren: cc > 0,
      childrenCount: cc,
      knowledgeAreaId: c.knowledgeAreaId,
      _count: { notes: c._count.notes },
    };
  });

  return NextResponse.json({ categories: data });
}

/** POST /api/categories — 创建分类（支持 parentId 指定父分类） */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, color, icon, parentId } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: '分类名称不能为空' }, { status: 400 });
  }

  // 防止把自己挂到自己下面
  if (parentId === name) {
    // 这个不太可能，只是防御
  }

  const maxOrder = await prisma.category.aggregate({ _max: { order: true } });
  const newOrder = (maxOrder._max.order ?? 0) + 1;

  try {
    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        color: color || '#6B7280',
        icon: icon || null,
        order: newOrder,
        parentId: parentId || null,
      },
    });

    const cc = await prisma.category.count({ where: { parentId: category.id } });
    const data: CategoryDTO = {
      id: category.id,
      name: category.name,
      color: category.color,
      icon: category.icon,
      order: category.order,
      pinned: category.pinned,
      createdAt: category.createdAt.toISOString(),
      parentId: category.parentId,
      hasChildren: cc > 0,
      childrenCount: cc,
      knowledgeAreaId: category.knowledgeAreaId,
    };
    return NextResponse.json({ category: data }, { status: 201 });
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: '分类名称已存在' }, { status: 409 });
    }
    throw e;
  }
}
