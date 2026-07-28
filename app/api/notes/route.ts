import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseJsonArray, stringifyJsonArray, generateSummary } from '@/lib/utils';
import type { NoteDTO, NoteInput } from '@/lib/types';

type SortBy = 'createdAt' | 'updatedAt' | 'custom';
type Scope = 'all' | 'favorite' | 'important' | 'category';

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
  const sortBy = (searchParams.get('sortBy') as SortBy) || 'createdAt';
  const scope = (searchParams.get('scope') as Scope) || 'all';
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const withSocial = searchParams.get('withSocial') === 'true';
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

  const orderField =
    sortBy === 'custom'
      ? scope === 'favorite'
        ? 'favoriteOrder'
        : scope === 'important'
        ? 'importantOrder'
        : scope === 'category'
        ? 'categoryOrder'
        : 'globalOrder'
      : sortBy;

  const pinnedField =
    scope === 'favorite'
      ? 'pinnedFavorite'
      : scope === 'important'
      ? 'pinnedImportant'
      : scope === 'category'
      ? 'pinnedCategory'
      : 'pinnedGlobal';

  const pinOrderField =
    scope === 'favorite'
      ? 'favoritePinOrder'
      : scope === 'important'
      ? 'importantPinOrder'
      : scope === 'category'
      ? 'categoryPinOrder'
      : 'globalPinOrder';

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
    orderBy: [{ [pinnedField]: 'desc' }, { [pinOrderField]: 'desc' }, { [orderField]: 'desc' }],
    take: limit,
    skip: offset,
  });

  const total = await prisma.note.count({ where });

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
          createdAt: n.category.createdAt.toISOString(),
        }
      : null,
    isFavorite: n.isFavorite,
    importance: (n.importance as 'important' | 'very_important' | null) || null,
    pinned: n[pinnedField],
    pinnedGlobal: n.pinnedGlobal,
    pinnedFavorite: n.pinnedFavorite,
    pinnedImportant: n.pinnedImportant,
    pinnedCategory: n.pinnedCategory,
    globalPinOrder: n.globalPinOrder,
    favoritePinOrder: n.favoritePinOrder,
    importantPinOrder: n.importantPinOrder,
    categoryPinOrder: n.categoryPinOrder,
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
                createdAt: n.repostOf.category.createdAt.toISOString(),
              }
            : null,
          isFavorite: n.repostOf.isFavorite,
          importance: (n.repostOf.importance as 'important' | 'very_important' | null) || null,
          pinned: n.repostOf[pinnedField],
          pinnedGlobal: n.repostOf.pinnedGlobal,
          pinnedFavorite: n.repostOf.pinnedFavorite,
          pinnedImportant: n.repostOf.pinnedImportant,
          pinnedCategory: n.repostOf.pinnedCategory,
          globalPinOrder: n.repostOf.globalPinOrder,
          favoritePinOrder: n.repostOf.favoritePinOrder,
          importantPinOrder: n.repostOf.importantPinOrder,
          categoryPinOrder: n.repostOf.categoryPinOrder,
          globalOrder: n.repostOf.globalOrder,
          favoriteOrder: n.repostOf.favoriteOrder,
          importantOrder: n.repostOf.importantOrder,
          categoryOrder: n.repostOf.categoryOrder,
          repostOfId: n.repostOf.repostOfId || null,
          repostOf: null,
          createdAt: n.repostOf.createdAt.toISOString(),
          updatedAt: n.repostOf.updatedAt.toISOString(),
        }
      : null,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
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
      pinnedCategory: false,
      globalPinOrder: 0,
      favoritePinOrder: 0,
      importantPinOrder: 0,
      categoryPinOrder: 0,
      globalOrder: newOrder,
      favoriteOrder: newOrder,
      importantOrder: newOrder,
      categoryOrder: newOrder,
    },
    include: { category: true },
  });

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
          createdAt: note.category.createdAt.toISOString(),
        }
      : null,
    isFavorite: note.isFavorite,
    importance: (note.importance as 'important' | 'very_important' | null) || null,
    pinned: note.pinnedGlobal,
    pinnedGlobal: note.pinnedGlobal,
    pinnedFavorite: note.pinnedFavorite,
    pinnedImportant: note.pinnedImportant,
    pinnedCategory: note.pinnedCategory,
    globalPinOrder: note.globalPinOrder,
    favoritePinOrder: note.favoritePinOrder,
    importantPinOrder: note.importantPinOrder,
    categoryPinOrder: note.categoryPinOrder,
    globalOrder: note.globalOrder,
    favoriteOrder: note.favoriteOrder,
    importantOrder: note.importantOrder,
    categoryOrder: note.categoryOrder,
    repostOfId: note.repostOfId || null,
    repostOf: null,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };

  return NextResponse.json({ note: data }, { status: 201 });
}
