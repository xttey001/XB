import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateKnowledgeMap } from '@/lib/ai-extract';

/**
 * POST /api/ai/knowledge-maps/generate
 *
 * 生成一张知识地图（Mermaid mindmap）并保存到 KnowledgeMap 表。
 *
 * Body:
 *   - categoryId: string  — 按分类生成（会拉该分类下所有笔记）
 *   - title: string        — 地图标题
 *   - description?: string
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { categoryId, title, description } = body;

  let noteIds: string[] = [];

  if (categoryId) {
    const notes = await prisma.note.findMany({
      where: { categoryId },
      select: { id: true },
    });
    noteIds = notes.map((n) => n.id);
  }

  if (noteIds.length === 0) {
    return NextResponse.json({ error: '没有找到笔记，请先为这个分类添加笔记' }, { status: 400 });
  }

  const { mermaid, markdown } = await generateKnowledgeMap(noteIds, title || '知识地图');

  const km = await prisma.knowledgeMap.create({
    data: {
      title: title || '知识地图',
      description: description || null,
      scopeType: 'category',
      scopeValue: categoryId,
      mermaid,
      markdown: markdown || null,
    },
  });

  return NextResponse.json({ id: km.id, mermaid, markdown });
}
