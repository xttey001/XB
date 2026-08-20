import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseJsonArray } from '@/lib/utils';
import type { NoteDTO } from '@/lib/types';

interface RouteParams {
  params: { id: string };
}

interface LinkedNote {
  id: string;
  summary: string;
  createdAt: string;
  tags: string[];
}

/**
 * GET /api/notes/[id]/links
 * 返回笔记的链接关系：
 * - outgoing: 本笔记链接到的笔记（出链）
 * - incoming: 链接到本笔记的笔记（反链/背链）
 * - related: 同标签的相关笔记（排除已有的出链和反链）
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const noteId = params.id;

  const note = await prisma.note.findUnique({ where: { id: noteId } });
  if (!note) {
    return NextResponse.json({ error: '笔记不存在' }, { status: 404 });
  }

  const noteTags = parseJsonArray<string>(note.tags);

  // 1. 出链：本笔记手动链接到的笔记
  const outgoingLinks = await prisma.noteLink.findMany({
    where: { sourceId: noteId },
    include: { target: true },
    orderBy: { createdAt: 'asc' },
  });

  // 2. 反链：链接到本笔记的笔记
  const incomingLinks = await prisma.noteLink.findMany({
    where: { targetId: noteId },
    include: { source: true },
    orderBy: { createdAt: 'desc' },
  });

  // 已链接的笔记 ID 集合（用于排除同标签推荐中的重复）
  const linkedIds = new Set<string>();
  outgoingLinks.forEach((l) => linkedIds.add(l.targetId));
  incomingLinks.forEach((l) => linkedIds.add(l.sourceId));
  linkedIds.add(noteId); // 排除自身

  // 3. 同标签的相关笔记（排除已链接的和自身）
  let relatedByTag: any[] = [];
  if (noteTags.length > 0) {
    // 构建 tags 查询条件
    const tagConditions = noteTags.map((tag) => ({
      tags: { contains: `"${tag}"` },
    }));

    const relatedNotes = await prisma.note.findMany({
      where: {
        OR: tagConditions,
        id: { notIn: Array.from(linkedIds) },
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
    });

    relatedByTag = relatedNotes;
  }

  const toLinkedNote = (item: any, isIncoming: boolean): LinkedNote => {
    const n = isIncoming ? item.source : item.target;
    const plain = n.content
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return {
      id: n.id,
      summary: plain.length > 120 ? plain.slice(0, 120) + '…' : plain,
      createdAt: n.createdAt.toISOString(),
      tags: parseJsonArray<string>(n.tags),
    };
  };

  return NextResponse.json({
    outgoing: outgoingLinks.map((l) => toLinkedNote(l, false)),
    incoming: incomingLinks.map((l) => toLinkedNote(l, true)),
    relatedByTag: relatedByTag.map((n) => {
      const plain = n.content
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return {
        id: n.id,
        summary: plain.length > 120 ? plain.slice(0, 120) + '…' : plain,
        createdAt: n.createdAt.toISOString(),
        tags: parseJsonArray<string>(n.tags),
      };
    }),
  });
}