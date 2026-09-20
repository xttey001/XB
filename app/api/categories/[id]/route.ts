import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: { id: string };
}

/** PUT /api/categories/[id] —— 修改分类（支持 parentId 重构） */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const body = await req.json();
  const { name, color, icon, pinned, order, parentId, knowledgeAreaId } = body;

  // 防止把自己挂到自己或自己的后代下面
  if (parentId) {
    if (parentId === params.id) {
      return NextResponse.json({ error: '不能把分类挂到自己下面' }, { status: 400 });
    }
    // 检查后代链（简单实现：不能挂到自己的直接 children 下面）
    const self = await prisma.category.findUnique({
      where: { id: params.id },
      include: { children: true },
    });
    if (self?.children.some((c) => c.id === parentId)) {
      return NextResponse.json({ error: '不能把分类挂到自己的子分类下面' }, { status: 400 });
    }
  }

  try {
    const category = await prisma.category.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(color !== undefined && { color: String(color) }),
        ...(icon !== undefined && { icon: icon === '' ? null : String(icon) }),
        ...(pinned !== undefined && { pinned: Boolean(pinned) }),
        ...(order !== undefined && { order: Number(order) }),
        ...(parentId !== undefined && { parentId: parentId || null }),
        ...(knowledgeAreaId !== undefined && { knowledgeAreaId: knowledgeAreaId || null }),
      },
    });
    return NextResponse.json({ category });
  } catch (e: any) {
    if (e?.code === 'P2025') {
      return NextResponse.json({ error: '分类不存在' }, { status: 404 });
    }
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: '分类名称已存在' }, { status: 409 });
    }
    throw e;
  }
}

/** DELETE /api/categories/[id] —— 删除分类（Note.categoryId 自动设为 null） */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    await prisma.category.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e?.code === 'P2025') {
      return NextResponse.json({ error: '分类不存在' }, { status: 404 });
    }
    throw e;
  }
}
