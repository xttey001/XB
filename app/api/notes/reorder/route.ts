import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { NoteReorderInput } from '@/lib/types';

/**
 * POST /api/notes/reorder
 * 批量更新笔记排序
 *
 * body: {
 *   scope: 'all' | 'favorite' | 'category',
 *   items: [{ id, order }],
 *   pinUpdates?: [{ id, pinned, pinOrder }]
 * }
 *
 * - scope 决定更新哪个 order 字段（globalOrder/favoriteOrder/categoryOrder）
 * - items 是该 scope 下新的完整排序（前端计算好顺序后整体提交）
 * - pinUpdates 可选，用于同时更新置顶状态
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as NoteReorderInput;

  if (!body.scope || !Array.isArray(body.items)) {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }

  const orderField =
    body.scope === 'favorite'
      ? 'favoriteOrder'
      : body.scope === 'important'
      ? 'importantOrder'
      : body.scope === 'veryImportant'
      ? 'importantOrder'
      : body.scope === 'category'
      ? 'categoryOrder'
      : body.scope === 'liked'
      ? 'likedPinOrder'
      : body.scope === 'reposted'
      ? 'repostedPinOrder'
      : body.scope === 'allPinned'
      ? 'globalPinOrder'
      : 'globalOrder';

  const pinnedField =
    body.scope === 'favorite'
      ? 'pinnedFavorite'
      : body.scope === 'important'
      ? 'pinnedImportant'
      : body.scope === 'veryImportant'
      ? 'pinnedVeryImportant'
      : body.scope === 'category'
      ? 'pinnedCategory'
      : body.scope === 'liked'
      ? 'pinnedLiked'
      : body.scope === 'reposted'
      ? 'pinnedReposted'
      : body.scope === 'allPinned'
      ? 'pinnedGlobal'
      : 'pinnedGlobal';

  const pinOrderField =
    body.scope === 'favorite'
      ? 'favoritePinOrder'
      : body.scope === 'important'
      ? 'importantPinOrder'
      : body.scope === 'veryImportant'
      ? 'veryImportantPinOrder'
      : body.scope === 'category'
      ? 'categoryPinOrder'
      : body.scope === 'liked'
      ? 'likedPinOrder'
      : body.scope === 'reposted'
      ? 'repostedPinOrder'
      : body.scope === 'allPinned'
      ? 'globalPinOrder'
      : 'globalPinOrder';

  // 用事务批量更新
  await prisma.$transaction(async (tx) => {
    // 1. 更新排序
    for (const item of body.items) {
      await tx.note.update({
        where: { id: item.id },
        data: { [orderField]: item.order },
      });
    }

    // 2. 可选：更新置顶状态（按 scope 更新对应字段）
    if (body.pinUpdates?.length) {
      for (const p of body.pinUpdates) {
        await tx.note.update({
          where: { id: p.id },
          data: {
            [pinnedField]: p.pinned,
            [pinOrderField]: p.pinOrder,
          },
        });
      }
    }
  });

  return NextResponse.json({ success: true });
}
