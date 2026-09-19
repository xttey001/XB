import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET  /api/ai/suggested-links   — 列出所有 AI 建议的链接（待审核）
 * POST /api/ai/suggested-links   — 批量审核
 *
 * Body: { action: 'accept' | 'reject', ids: string[] }
 */
export async function GET() {
  const links = await prisma.noteLink.findMany({
    where: { linkSource: 'ai_suggested' },
    orderBy: { confidence: 'desc' },
    include: {
      source: { select: { id: true, content: true } },
      target: { select: { id: true, content: true } },
    },
    take: 200,
  });

  const formatted = links.map((l) => ({
    id: l.id,
    sourceId: l.sourceId,
    targetId: l.targetId,
    linkType: l.linkType,
    confidence: l.confidence,
    sourceSummary: stripHtml(l.source.content).slice(0, 80),
    targetSummary: stripHtml(l.target.content).slice(0, 80),
    createdAt: l.createdAt,
  }));

  return NextResponse.json({ links: formatted });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const ids: string[] = body.ids || [];
  const action: 'accept' | 'reject' = body.action;

  if (ids.length === 0) {
    return NextResponse.json({ accepted: 0, rejected: 0 });
  }

  let accepted = 0;
  let rejected = 0;

  if (action === 'accept') {
    const r = await prisma.noteLink.updateMany({
      where: { id: { in: ids }, linkSource: 'ai_suggested' },
      data: { linkSource: 'ai_accepted' },
    });
    accepted = r.count;
  } else {
    const r = await prisma.noteLink.deleteMany({
      where: { id: { in: ids }, linkSource: 'ai_suggested' },
    });
    rejected = r.count;
  }

  return NextResponse.json({ accepted, rejected });
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
