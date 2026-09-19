import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractEntitiesForNote, persistEntities } from '@/lib/ai-extract';
import { llmAvailable } from '@/lib/llm';

/**
 * POST /api/ai/batch-extract
 *
 * 触发全量实体抽取（后台跑）。返回进度统计。
 *
 * Query: ?onlyMissing=true  — 只处理还没抽过的笔记
 */
export async function GET(_req: NextRequest) {
  const url = new URL(_req.url);
  const onlyMissing = url.searchParams.get('onlyMissing') === 'true';

  // 统计数据
  const totalNotes = await prisma.note.count();
  const totalEntities = await prisma.entity.count();
  const totalSuggested = await prisma.noteLink.count({ where: { linkSource: 'ai_suggested' } });
  const totalManual = await prisma.noteLink.count({ where: { linkSource: 'manual' } });
  const totalAiAccepted = await prisma.noteLink.count({ where: { linkSource: 'ai_accepted' } });

  let notesToProcess = totalNotes;
  if (onlyMissing) {
    const processedIds = await prisma.noteEntity.findMany({
      select: { noteId: true },
      distinct: ['noteId'],
    });
    const processedSet = new Set(processedIds.map((r) => r.noteId));
    notesToProcess = totalNotes - processedSet.size;
  }

  return NextResponse.json({
    llmAvailable: llmAvailable(),
    stats: {
      totalNotes,
      totalEntities,
      totalManualLinks: totalManual,
      totalSuggestedLinks: totalSuggested,
      totalAiAcceptedLinks: totalAiAccepted,
      notesToProcess,
    },
  });
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const onlyMissing = url.searchParams.get('onlyMissing') === 'true';
  const { maxNotes } = await req.json().catch(() => ({ maxNotes: 0 }));

  // 找出要处理的笔记
  let noteIds: string[] = [];
  if (onlyMissing) {
    const processedIds = await prisma.noteEntity.findMany({
      select: { noteId: true },
      distinct: ['noteId'],
    });
    const processedSet = new Set(processedIds.map((r) => r.noteId));
    const all = await prisma.note.findMany({ select: { id: true } });
    noteIds = all.filter((n) => !processedSet.has(n.id)).map((n) => n.id);
  } else {
    const all = await prisma.note.findMany({ select: { id: true } });
    noteIds = all.map((n) => n.id);
  }

  if (maxNotes > 0) noteIds = noteIds.slice(0, maxNotes);

  // 顺序处理（逐笔记抽实体）
  let processed = 0;
  let newEntities = 0;
  const errors: string[] = [];

  for (const noteId of noteIds) {
    try {
      const entities = await extractEntitiesForNote(noteId);
      if (entities.length > 0) {
        await persistEntities(noteId, entities);
        newEntities += entities.length;
      }
      processed++;
    } catch (e) {
      errors.push(`${noteId.slice(0, 10)}: ${(e as Error).message}`);
    }
  }

  return NextResponse.json({
    processed,
    newEntities,
    errors: errors.slice(0, 20),
    llmUsed: llmAvailable(),
  });
}
