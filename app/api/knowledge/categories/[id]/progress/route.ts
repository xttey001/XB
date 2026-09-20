import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const VALID = ['unknown', 'aware', 'can_use', 'mastered'];

// PATCH /api/knowledge/categories/[id]/progress — 更新 Category 掌握程度
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const { progressStatus } = body;
  if (!VALID.includes(progressStatus)) {
    return NextResponse.json({ error: 'invalid progressStatus' }, { status: 400 });
  }

  const updated = await prisma.category.update({
    where: { id: params.id },
    data: { progressStatus },
  });
  return NextResponse.json({ category: updated });
}
