import { NextRequest, NextResponse } from 'next/server';
import { format } from 'date-fns';
import { prisma } from '@/lib/prisma';
import type { DailyStatsDTO } from '@/lib/types';

type Scope = 'all' | 'favorite' | 'category';

/**
 * GET /api/notes/daily-stats
 * 查询参数：
 *   - year: 年份（必填）
 *   - month: 月份 1-12（必填）
 *   - scope: all | favorite | category（默认 all）
 *   - categoryId: scope=category 时必填
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get('year'));
  const month = Number(searchParams.get('month'));
  const scope = (searchParams.get('scope') as Scope) || 'all';
  const categoryId = searchParams.get('categoryId') || undefined;

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'year 和 month 参数无效' }, { status: 400 });
  }

  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);

  const where: any = {
    createdAt: {
      gte: start,
      lte: end,
    },
  };

  if (scope === 'favorite') {
    where.isFavorite = true;
  } else if (scope === 'category') {
    if (!categoryId) {
      return NextResponse.json({ error: 'scope=category 时必须提供 categoryId' }, { status: 400 });
    }
    where.categoryId = categoryId;
  }

  const notes = await prisma.note.findMany({
    where,
    select: {
      id: true,
      createdAt: true,
      importance: true,
    },
  });

  const map = new Map<string, DailyStatsDTO>();

  for (const note of notes) {
    // 按本地日期分组，与列表 API / 前端展示保持一致
    const dateStr = format(note.createdAt, 'yyyy-MM-dd');

    if (!map.has(dateStr)) {
      map.set(dateStr, {
        date: dateStr,
        count: 0,
        important: 0,
        veryImportant: 0,
      });
    }

    const stat = map.get(dateStr)!;
    stat.count += 1;

    if (note.importance === 'very_important') stat.veryImportant += 1;
    else if (note.importance === 'important') stat.important += 1;
  }

  const stats = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({ stats });
}
