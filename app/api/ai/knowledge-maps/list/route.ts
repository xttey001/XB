import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const maps = await prisma.knowledgeMap.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({
    maps: maps.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      scopeType: m.scopeType,
      scopeValue: m.scopeValue,
      mermaid: m.mermaid,
      markdown: m.markdown,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    })),
  });
}
