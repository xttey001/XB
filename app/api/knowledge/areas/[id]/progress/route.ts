import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const VALID = ['unknown', 'aware', 'can_use', 'mastered'];

// PATCH /api/knowledge/areas/[id]/progress — 更新 Area 整体掌握程度
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const { progressStatus } = body;
  if (!VALID.includes(progressStatus)) {
    return NextResponse.json({ error: 'invalid progressStatus' }, { status: 400 });
  }

  const updated = await prisma.knowledgeArea.update({
    where: { id: params.id },
    data: { progressStatus },
  });
  return NextResponse.json({ area: updated });
}
