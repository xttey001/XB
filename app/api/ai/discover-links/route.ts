import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { discoverNoteLinks, persistSuggestedLinks } from '@/lib/ai-extract';

/**
 * POST /api/ai/discover-links
 *
 * 跨笔记自动发现关联。基于已抽取的 Entity 找候选对，然后调 LLM 或用共享 entity 数判断。
 *
 * Body: { minSharedEntities?: number, maxPairs?: number }
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const minShared = body.minSharedEntities ?? 2;
  const maxPairs = body.maxPairs ?? 100;

  // 找出共享 entity ≥ minShared 的候选笔记对
  const pairs = await prisma.$queryRaw<Array<{ sourceId: string; targetId: string; cnt: number }>>`
    SELECT a.noteId as sourceId, b.noteId as targetId, COUNT(*) as cnt
    FROM NoteEntity a
    JOIN NoteEntity b ON a.entityId = b.entityId AND a.noteId < b.noteId
    GROUP BY a.noteId, b.noteId
    HAVING cnt >= ${minShared}
    ORDER BY cnt DESC
    LIMIT ${maxPairs}
  `;

  const candidatePairs = pairs.map((p) => ({ sourceId: p.sourceId, targetId: p.targetId }));

  const discovered = await discoverNoteLinks(candidatePairs);
  const persisted = await persistSuggestedLinks(discovered);

  return NextResponse.json({
    candidatePairs: candidatePairs.length,
    discovered: discovered.length,
    persisted,
  });
}
