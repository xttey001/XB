import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PATCH /api/knowledge/categories/[id]/reparent — 把 Category 移到另一个父分类下
// body: { parentId: string | null, knowledgeAreaId?: string }
//   parentId = null  → 提升为顶层分类
//   parentId = someId → 成为某个父分类的子分类
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const { parentId, knowledgeAreaId } = body;

  const data: any = { parentId: parentId || null };
  if (knowledgeAreaId) data.knowledgeAreaId = knowledgeAreaId;

  // 防止把自己挂到自己下面
  if (parentId === params.id) {
    return NextResponse.json({ error: 'cannot reparent to self' }, { status: 400 });
  }

  const updated = await prisma.category.update({
    where: { id: params.id },
    data,
  });
  return NextResponse.json({ category: updated });
}
