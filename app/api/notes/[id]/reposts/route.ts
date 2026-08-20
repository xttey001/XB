import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseJsonArray, stringifyJsonArray } from '@/lib/utils';
import type { NoteDTO } from '@/lib/types';

interface RouteParams {
  params: { id: string };
}

function toNoteDTO(n: any): NoteDTO {
  return {
    id: n.id,
    content: n.content,
    images: parseJsonArray<string>(n.images),
    tags: parseJsonArray<string>(n.tags),
    categoryId: n.categoryId,
    category: n.category
      ? {
          id: n.category.id,
          name: n.category.name,
          color: n.category.color,
          icon: n.category.icon,
          order: n.category.order,
          pinned: n.category.pinned,
          createdAt: n.category.createdAt.toISOString(),
        }
      : null,
    isFavorite: n.isFavorite,
    importance: (n.importance as 'important' | 'very_important' | null) || null,
    pinned: n.pinnedGlobal,
    pinnedGlobal: n.pinnedGlobal,
    pinnedFavorite: n.pinnedFavorite,
    pinnedImportant: n.pinnedImportant,
    pinnedVeryImportant: n.pinnedVeryImportant,
    pinnedCategory: n.pinnedCategory,
    pinnedLiked: n.pinnedLiked,
    pinnedReposted: n.pinnedReposted,
    globalPinOrder: n.globalPinOrder,
    favoritePinOrder: n.favoritePinOrder,
    importantPinOrder: n.importantPinOrder,
    veryImportantPinOrder: n.veryImportantPinOrder,
    categoryPinOrder: n.categoryPinOrder,
    likedPinOrder: n.likedPinOrder,
    repostedPinOrder: n.repostedPinOrder,
    globalOrder: n.globalOrder,
    favoriteOrder: n.favoriteOrder,
    importantOrder: n.importantOrder,
    categoryOrder: n.categoryOrder,
    repostOfId: n.repostOfId || null,
    repostOf: n.repostOf ? toNoteDTO(n.repostOf) : null,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  };
}

/**
 * POST /api/notes/[id]/reposts
 * body: { content: string; images?: string[] }
 * 创建一条转发：生成一条新笔记，repostOfId 指向原笔记
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const note = await prisma.note.findUnique({ where: { id: params.id } });
  if (!note) {
    return NextResponse.json({ error: '笔记不存在' }, { status: 404 });
  }

  const body = (await req.json()) as { content?: string; images?: string[] };
  const content = body.content?.trim() || '';
  const images = body.images ?? [];

  if (!content && images.length === 0) {
    return NextResponse.json({ error: '转发内容或图片不能同时为空' }, { status: 400 });
  }

  const maxOrder = await prisma.note.aggregate({
    _max: { globalOrder: true },
  });
  const newOrder = (maxOrder._max.globalOrder ?? 0) + 1;

  const created = await prisma.note.create({
    data: {
      content,
      images: stringifyJsonArray(images),
      tags: note.tags,
      categoryId: note.categoryId,
      importance: note.importance,
      repostOfId: params.id,
      pinnedGlobal: false,
      pinnedFavorite: false,
      pinnedImportant: false,
      pinnedVeryImportant: false,
      pinnedCategory: false,
      pinnedLiked: false,
      pinnedReposted: false,
      globalPinOrder: 0,
      favoritePinOrder: 0,
      importantPinOrder: 0,
      veryImportantPinOrder: 0,
      categoryPinOrder: 0,
      likedPinOrder: 0,
      repostedPinOrder: 0,
      globalOrder: newOrder,
      favoriteOrder: newOrder,
      importantOrder: newOrder,
      categoryOrder: newOrder,
    },
    include: { category: true, repostOf: { include: { category: true } } },
  });

  return NextResponse.json({ note: toNoteDTO(created) }, { status: 201 });
}
