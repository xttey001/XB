import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { autoClusterCategories, applyClusters } from '@/lib/knowledge-cluster';

// POST /api/knowledge/cluster — 触发自动聚类
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const autoApply = body.autoApply === true;

  try {
    const suggestions = await autoClusterCategories();
    let applied = 0;
    if (autoApply) {
      applied = await applyClusters(suggestions);
    }
    return NextResponse.json({
      suggestions,
      totalSuggestions: suggestions.length,
      applied,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '聚类失败' }, { status: 400 });
  }
}
