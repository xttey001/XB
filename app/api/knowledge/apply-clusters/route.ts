import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/knowledge/apply-clusters — 批量应用聚类建议（给 KnowledgeArea 聚类用）
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { suggestions } = body as {
    suggestions: Array<{ categoryId: string; suggestedAreaId: string }>;
  };

  if (!suggestions?.length) {
    return NextResponse.json({ applied: 0 });
  }

  let count = 0;
  for (const s of suggestions) {
    try {
      await prisma.category.update({
        where: { id: s.categoryId },
        data: { knowledgeAreaId: s.suggestedAreaId },
      });
      count++;
    } catch {
      // skip
    }
  }

  return NextResponse.json({ applied: count });
}
