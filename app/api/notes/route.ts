import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseJsonArray, stringifyJsonArray, generateSummary } from '@/lib/utils';
import { syncNoteLinks } from '@/lib/link-parser';
import type { NoteDTO, NoteInput } from '@/lib/types';

type SortBy = 'createdAt' | 'updatedAt' | 'custom';
type Scope = 'all' | 'favorite' | 'important' | 'veryImportant' | 'category' | 'liked' | 'reposted' | 'allPinned' | 'reviewed';

/**
 * GET /api/notes
 * 查询参数：
 *   - q: 关键词搜索（模糊匹配 content / tags）
 *   - categoryId: 按分类筛选
 *   - favorite: "true" 时只返回收藏
 *   - tag: 按标签精确匹配
 *   - importance: 按重要等级筛选，支持单个值（important / very_important）
 *                 或多个值用逗号分隔（important,very_important）
 *   - sortBy: createdAt | updatedAt | custom (默认 createdAt)
 *   - scope: all | favorite | category (决定 custom 排序用哪个字段)
 *   - startDate: 起始日期（含）
 *   - endDate: 结束日期（含）
 *   - withSocial: "true" 时返回每条笔记的评论/点赞/转发统计
 *   - limit: 限制条数（默认 20，最大 200）
 *   - offset: 分页偏移量（默认 0）
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim() || '';
  const categoryId = searchParams.get('categoryId') || undefined;
  const favorite = searchParams.get('favorite') === 'true';
  const tag = searchParams.get('tag') || undefined;
  const importanceParam = searchParams.get('importance')?.trim();
  const liked = searchParams.get('liked') === 'true';
  const reposted = searchParams.get('reposted') === 'true';
  const veryImportant = searchParams.get('veryImportant') === 'true';
  const sortBy = (searchParams.get('sortBy') as SortBy) || 'createdAt';
  const scope = (searchParams.get('scope') as Scope) || 'all';
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const withSocial = searchParams.get('withSocial') === 'true';
  const reviewDue = searchParams.get('reviewDue') === 'true';
  const limit = Math.min(Number(searchParams.get('limit') || 20), 200);
  const offset = Math.max(Number(searchParams.get('offset') || 0), 0);

  const VALID_IMPORTANCE = ['important', 'very_important'];

  const where: any = {};
  if (q) {
    where.OR = [
      { content: { contains: q } },
      { tags: { contains: q } },
    ];
  }
  if (categoryId) where.categoryId = categoryId;
  if (favorite) where.isFavorite = true;
  if (tag) {
    where.tags = { contains: `"${tag}"` };
  }
  if (liked) {
    where.likes = { some: {} };
  }
  if (reposted) {
    where.repostOfId = { not: null };
  }
  if (veryImportant) {
    where.importance = 'very_important';
  }
  if (importanceParam) {
    const values = importanceParam
      .split(',')
      .map((v) => v.trim())
      .filter((v) => VALID_IMPORTANCE.includes(v));
    if (values.length === 1) {
      where.importance = values[0];
    } else if (values.length > 1) {
      where.importance = { in: values };
    }
  }
  // 日期字符串按本地时间解析，避免 `new Date('2026-07-28')` 被解析为 UTC
  function parseLocalDate(dateStr: string, endOfDay = false) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return endOfDay
      ? new Date(y, m - 1, d, 23, 59, 59, 999)
      : new Date(y, m - 1, d);
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = parseLocalDate(startDate);
    if (endDate) where.createdAt.lte = parseLocalDate(endDate, true);
  }

  // scope 筛选：重要/极重要视图按 importance 字段过滤
  if (scope === 'important') {
    where.importance = 'important';
  } else if (scope === 'veryImportant') {
    where.importance = 'very_important';
  } else if (scope === 'allPinned') {
    // 全局置顶：所有视图中被置顶的笔记（OR 所有置顶字段）
    where.OR = [
      { pinnedGlobal: true },
      { pinnedFavorite: true },
      { pinnedImportant: true },
      { pinnedVeryImportant: true },
      { pinnedCategory: true },
      { pinnedLiked: true },
      { pinnedReposted: true },
    ];
  } else if (scope === 'reviewed') {
    // 回顾视图：所有设置了回顾提醒的笔记
    where.reviewAt = { not: null };
  }

  if (reviewDue) {
    const now = new Date();
    where.reviewAt = { lte: now };
  }

  const orderField =
    sortBy === 'custom'
      ? scope === 'favorite'
        ? 'favoriteOrder'
        : scope === 'important'
        ? 'importantOrder'
        : scope === 'veryImportant'
        ? 'importantOrder'
        : scope === 'category'
        ? 'categoryOrder'
        : scope === 'liked'
        ? 'likedPinOrder'
        : scope === 'reposted'
        ? 'repostedPinOrder'
        : scope === 'allPinned'
        ? 'globalPinOrder'
        : 'globalOrder'
      : sortBy;

  const pinnedField =
    scope === 'favorite'
      ? 'pinnedFavorite'
      : scope === 'important'
      ? 'pinnedImportant'
      : scope === 'veryImportant'
      ? 'pinnedVeryImportant'
      : scope === 'category'
      ? 'pinnedCategory'
      : scope === 'liked'
      ? 'pinnedLiked'
      : scope === 'reposted'
      ? 'pinnedReposted'
      : scope === 'allPinned'
      ? 'pinnedGlobal'
      : 'pinnedGlobal';

  const pinOrderField =
    scope === 'favorite'
      ? 'favoritePinOrder'
      : scope === 'important'
      ? 'importantPinOrder'
      : scope === 'veryImportant'
      ? 'veryImportantPinOrder'
      : scope === 'category'
      ? 'categoryPinOrder'
      : scope === 'liked'
      ? 'likedPinOrder'
      : scope === 'reposted'
      ? 'repostedPinOrder'
      : scope === 'allPinned'
      ? 'globalPinOrder'
      : 'globalPinOrder';

  const baseOrderBy =
    scope === 'reviewed'
      ? [{ reviewAt: 'asc' as const }]
      : [{ [pinnedField]: 'desc' as const }, { [pinOrderField]: 'desc' as const }, { [orderField]: 'desc' as const }];

  const notes = await prisma.note.findMany({
    where,
    include: {
      category: true,
      repostOf: { include: { category: true } },
      ...(withSocial
        ? {
            _count: {
              select: { likes: true, comments: true, reposts: true },
            },
            likes: true,
          }
        : {}),
    },
    orderBy: baseOrderBy,
    take: limit,
    skip: offset,
  });

  const total = await prisma.note.count({ where });

  // allPinned 视图：检查是否在任意视图中被置顶
  const isAnyPinned = (n: any) =>
    n.pinnedGlobal || n.pinnedFavorite || n.pinnedImportant ||
    n.pinnedVeryImportant || n.pinnedCategory || n.pinnedLiked || n.pinnedReposted;

  const data: NoteDTO[] = notes.map((n: any) => ({
    id: n.id,
    content: n.content,
    summary: generateSummary(n.content),
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
    pinned: scope === 'allPinned' ? isAnyPinned(n) : n[pinnedField],
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
    repostOf: n.repostOf
      ? {
          id: n.repostOf.id,
          content: n.repostOf.content,
          images: parseJsonArray<string>(n.repostOf.images),
          tags: parseJsonArray<string>(n.repostOf.tags),
          categoryId: n.repostOf.categoryId,
          category: n.repostOf.category
            ? {
                id: n.repostOf.category.id,
                name: n.repostOf.category.name,
                color: n.repostOf.category.color,
                icon: n.repostOf.category.icon,
                order: n.repostOf.category.order,
                pinned: n.repostOf.category.pinned,
                createdAt: n.repostOf.category.createdAt.toISOString(),
              }
            : null,
          isFavorite: n.repostOf.isFavorite,
          importance: (n.repostOf.importance as 'important' | 'very_important' | null) || null,
          pinned: scope === 'allPinned' ? isAnyPinned(n.repostOf) : n.repostOf[pinnedField],
          pinnedGlobal: n.repostOf.pinnedGlobal,
          pinnedFavorite: n.repostOf.pinnedFavorite,
          pinnedImportant: n.repostOf.pinnedImportant,
          pinnedVeryImportant: n.repostOf.pinnedVeryImportant,
          pinnedCategory: n.repostOf.pinnedCategory,
          pinnedLiked: n.repostOf.pinnedLiked,
          pinnedReposted: n.repostOf.pinnedReposted,
          globalPinOrder: n.repostOf.globalPinOrder,
          favoritePinOrder: n.repostOf.favoritePinOrder,
          importantPinOrder: n.repostOf.importantPinOrder,
          veryImportantPinOrder: n.repostOf.veryImportantPinOrder,
          categoryPinOrder: n.repostOf.categoryPinOrder,
          likedPinOrder: n.repostOf.likedPinOrder,
          repostedPinOrder: n.repostOf.repostedPinOrder,
          globalOrder: n.repostOf.globalOrder,
          favoriteOrder: n.repostOf.favoriteOrder,
          importantOrder: n.repostOf.importantOrder,
          categoryOrder: n.repostOf.categoryOrder,
          repostOfId: n.repostOf.repostOfId || null,
          repostOf: null,
          createdAt: n.repostOf.createdAt.toISOString(),
          updatedAt: n.repostOf.updatedAt.toISOString(),
          reviewAt: n.repostOf.reviewAt?.toISOString() || null,
          reviewRepeat: n.repostOf.reviewRepeat || null,
          reviewStep: n.repostOf.reviewStep ?? 0,
          reviewLastSent: n.repostOf.reviewLastSent?.toISOString() || null,
        }
      : null,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
    reviewAt: n.reviewAt?.toISOString() || null,
    reviewRepeat: n.reviewRepeat || null,
    reviewStep: n.reviewStep ?? 0,
    reviewLastSent: n.reviewLastSent?.toISOString() || null,
    ...(withSocial
      ? {
          _social: {
            likeCount: n._count.likes,
            commentCount: n._count.comments,
            repostCount: n._count.reposts,
            liked: n.likes.length > 0,
            comments: [],
            reposts: [],
          },
        }
      : {}),
  }));

  return NextResponse.json({
    notes: data,
    total,
    hasMore: offset + data.length < total,
  });
}

/**
 * POST /api/notes
 * 创建新笔记
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as NoteInput;

  if (!body.content?.trim() && !(body.images?.length ?? 0)) {
    return NextResponse.json(
      { error: '笔记内容和图片不能同时为空' },
      { status: 400 }
    );
  }

  // 新建笔记时，把它放在自定义排序列表的顶部（order 取当前最大值 + 1）
  const maxOrder = await prisma.note.aggregate({
    _max: { globalOrder: true },
  });
  const newOrder = (maxOrder._max.globalOrder ?? 0) + 1;

  const note = await prisma.note.create({
    data: {
      content: body.content?.trim() || '',
      images: stringifyJsonArray(body.images ?? []),
      tags: stringifyJsonArray(body.tags ?? []),
      categoryId: body.categoryId ?? null,
      isFavorite: body.isFavorite ?? false,
      importance: body.importance ?? null,
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
      reviewAt: body.reviewAt ? new Date(body.reviewAt) : null,
      reviewRepeat: body.reviewRepeat || null,
      reviewStep: body.reviewStep ?? 0,
      reviewLastSent: body.reviewLastSent ? new Date(body.reviewLastSent) : null,
    },
    include: { category: true },
  });

  // 同步链接关系
  await syncNoteLinks(note.id, note.content);

  const data: NoteDTO = {
    id: note.id,
    content: note.content,
    images: parseJsonArray<string>(note.images),
    tags: parseJsonArray<string>(note.tags),
    categoryId: note.categoryId,
    category: note.category
      ? {
          id: note.category.id,
          name: note.category.name,
          color: note.category.color,
          icon: note.category.icon,
          order: note.category.order,
          pinned: note.category.pinned,
          createdAt: note.category.createdAt.toISOString(),
        }
      : null,
    isFavorite: note.isFavorite,
    importance: (note.importance as 'important' | 'very_important' | null) || null,
    pinned: note.pinnedGlobal,
    pinnedGlobal: note.pinnedGlobal,
    pinnedFavorite: note.pinnedFavorite,
    pinnedImportant: note.pinnedImportant,
    pinnedVeryImportant: note.pinnedVeryImportant,
    pinnedCategory: note.pinnedCategory,
    pinnedLiked: note.pinnedLiked,
    pinnedReposted: note.pinnedReposted,
    globalPinOrder: note.globalPinOrder,
    favoritePinOrder: note.favoritePinOrder,
    importantPinOrder: note.importantPinOrder,
    veryImportantPinOrder: note.veryImportantPinOrder,
    categoryPinOrder: note.categoryPinOrder,
    likedPinOrder: note.likedPinOrder,
    repostedPinOrder: note.repostedPinOrder,
    globalOrder: note.globalOrder,
    favoriteOrder: note.favoriteOrder,
    importantOrder: note.importantOrder,
    categoryOrder: note.categoryOrder,
    repostOfId: note.repostOfId || null,
    repostOf: null,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    reviewAt: note.reviewAt?.toISOString() || null,
    reviewRepeat: note.reviewRepeat || null,
    reviewStep: note.reviewStep ?? 0,
    reviewLastSent: note.reviewLastSent?.toISOString() || null,
  };

  return NextResponse.json({ note: data }, { status: 201 });
}
