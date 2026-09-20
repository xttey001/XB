import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const VALID_STATUSES = ['unknown', 'aware', 'can_use', 'mastered'];
const STATUS_WEIGHT: Record<string, number> = { unknown: 0, aware: 30, can_use: 70, mastered: 100 };

interface CategoryNode {
  id: string;
  name: string;
  icon: string | null;
  noteCount: number;
  progressStatus: string;
  isParent: boolean;
  progressPct: number; // 只有父分类才有意义（= children 的加权平均）
  children: CategoryNode[];
}

/** 把扁平 Category 列表构建成两层树：子分类（有 children）→ 叶子 */
function buildCategoryTree(flatCats: any[]): CategoryNode[] {
  const allById = new Map(flatCats.map((c) => [c.id, c]));
  const result: CategoryNode[] = [];

  for (const cat of flatCats) {
    if (cat.parentId) continue; // 子分类会被父分类拉进去，跳过

    // 找这个父分类的直接 children
    const children = flatCats.filter((c) => c.parentId === cat.id);
    const childNodes: CategoryNode[] = children.map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      noteCount: c._count?.notes ?? 0,
      progressStatus: c.progressStatus || 'unknown',
      isParent: false,
      progressPct: 0,
      children: [],
    }));

    // 父分类的进度 = children 的加权平均（如果有 children），否则 = 自己的 progressStatus
    const isParent = childNodes.length > 0;
    let progressPct = 0;
    if (isParent) {
      if (childNodes.length > 0) {
        const sum = childNodes.reduce((s, c) => s + STATUS_WEIGHT[c.progressStatus], 0);
        progressPct = Math.round(sum / childNodes.length);
      }
    } else {
      progressPct = STATUS_WEIGHT[cat.progressStatus || 'unknown'];
    }

    result.push({
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      noteCount: cat._count?.notes ?? 0,
      progressStatus: cat.progressStatus || 'unknown',
      isParent,
      progressPct,
      children: childNodes,
    });
  }

  return result;
}

// GET /api/knowledge/areas — 列出所有一级主干（带嵌套分类树）
export async function GET() {
  const areas = await prisma.knowledgeArea.findMany({
    orderBy: { order: 'asc' },
    include: {
      categories: {
        where: { parentId: null }, // 只拉顶层 Category，children 单独查
        orderBy: { name: 'asc' },
        include: {
          _count: { select: { notes: true } },
        },
      },
    },
  });

  // 拉所有 Category（用于构建树 + 统计）
  const allCats = await prisma.category.findMany({
    include: {
      _count: { select: { notes: true } },
    },
  });

  const enriched = areas.map((a) => {
    const areaCats = allCats.filter((c) => c.knowledgeAreaId === a.id);
    const tree = buildCategoryTree(areaCats);

    let totalNotes = 0;
    let masteredCount = 0;
    let canUseCount = 0;
    let awareCount = 0;
    let unknownCount = 0;

    // 只统计叶子节点的进度（叶子才是你真正要学的东西）
    for (const cat of tree) {
      if (cat.isParent) {
        for (const child of cat.children) {
          totalNotes += child.noteCount;
          increment(child.progressStatus);
        }
      } else {
        totalNotes += cat.noteCount;
        increment(cat.progressStatus);
      }
    }

    function increment(st: string) {
      if (st === 'mastered') masteredCount++;
      else if (st === 'can_use') canUseCount++;
      else if (st === 'aware') awareCount++;
      else unknownCount++;
    }

    const totalLeaves = masteredCount + canUseCount + awareCount + unknownCount;
    // Area 自身的 progressPct = 所有叶子的加权平均
    const autoPct =
      totalLeaves > 0
        ? Math.round(
            (masteredCount * 100 + canUseCount * 70 + awareCount * 30 + unknownCount * 0) / totalLeaves
          )
        : 0;
    // 如果 Area 手动设过 progressStatus 且不是 unknown，优先用手动值；否则用自动汇总
    const areaManualPct = STATUS_WEIGHT[a.progressStatus] ?? 0;
    const progressPct = a.progressStatus !== 'unknown' ? areaManualPct : autoPct;

    return {
      id: a.id,
      name: a.name,
      icon: a.icon,
      color: a.color,
      description: a.description,
      order: a.order,
      areaProgressStatus: a.progressStatus, // Area 自己的手动标记
      totalNotes,
      totalCategories: areaCats.length,
      totalLeaves,
      progressPct,
      masteredCount,
      canUseCount,
      awareCount,
      unknownCount,
      categories: tree,
    };
  });

  return NextResponse.json({ areas: enriched });
}

// POST /api/knowledge/areas — 创建或更新
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { id, name, icon, color, description, order } = body;

  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  if (id) {
    const updated = await prisma.knowledgeArea.update({
      where: { id },
      data: { name, icon, color, description, order },
    });
    return NextResponse.json({ area: updated });
  } else {
    const created = await prisma.knowledgeArea.create({
      data: { name, icon, color, description, order: order || 0 },
    });
    return NextResponse.json({ area: created });
  }
}
