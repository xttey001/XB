import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/entities
 * 列出所有实体（按被引用数降序）
 */
export async function GET() {
  const entities = await prisma.entity.findMany({
    orderBy: { noteCount: 'desc' },
    take: 300,
  });

  return NextResponse.json({
    entities: entities.map((e) => ({
      id: e.id,
      name: e.name,
      aliases: JSON.parse(e.aliases || '[]'),
      entityType: e.entityType,
      definition: e.definition,
      noteCount: e.noteCount,
      updatedAt: e.updatedAt,
    })),
  });
}
