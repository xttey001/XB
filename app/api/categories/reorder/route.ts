import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { CategoryReorderInput } from '@/lib/types';

/**
 * POST /api/categories/reorder
 * 批量更新分类排序
 * body: { items: [{ id, order }] }
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as CategoryReorderInput;

  if (!Array.isArray(body.items)) {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    for (const item of body.items) {
      await tx.category.update({
        where: { id: item.id },
        data: { order: item.order },
      });
    }
  });

  return NextResponse.json({ success: true });
}
