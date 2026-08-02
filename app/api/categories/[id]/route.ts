import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: { id: string };
}

/** PUT /api/categories/[id] —— 修改分类 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const body = await req.json();
  const { name, color, icon, pinned, order } = body;

  try {
    const category = await prisma.category.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(color !== undefined && { color: String(color) }),
        ...(icon !== undefined && { icon: icon === '' ? null : String(icon) }),
        ...(pinned !== undefined && { pinned: Boolean(pinned) }),
        ...(order !== undefined && { order: Number(order) }),
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
