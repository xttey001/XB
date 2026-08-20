import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { CategoryDTO } from '@/lib/types';

/** GET /api/categories —— 列出所有分类，按 order 排序，附带笔记数 */
export async function GET() {
  const categories = await prisma.category.findMany({
    include: { _count: { select: { notes: true } } },
    orderBy: [{ pinned: 'desc' }, { order: 'desc' }, { createdAt: 'asc' }],
  });

  const data: CategoryDTO[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    icon: c.icon,
    order: c.order,
    pinned: c.pinned,
    createdAt: c.createdAt.toISOString(),
    _count: { notes: c._count.notes },
  }));

  return NextResponse.json({ categories: data });
}

/** POST /api/categories —— 创建分类 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, color, icon } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: '分类名称不能为空' }, { status: 400 });
  }

  // 新建分类默认放在末尾（order 取当前最大值 + 1）
  const maxOrder = await prisma.category.aggregate({ _max: { order: true } });
  const newOrder = (maxOrder._max.order ?? 0) + 1;

  try {
    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        color: color || '#6B7280',
        icon: icon || null,
        order: newOrder,
      },
    });
    const data: CategoryDTO = {
      id: category.id,
      name: category.name,
      color: category.color,
      icon: category.icon,
      order: category.order,
      pinned: category.pinned,
      createdAt: category.createdAt.toISOString(),
    };
    return NextResponse.json({ category: data }, { status: 201 });
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: '分类名称已存在' }, { status: 409 });
    }
    throw e;
  }
}
