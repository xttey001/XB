import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseJsonArray, stripHtml } from '@/lib/utils';

interface RouteParams {
  params: { rootId: string };
}

interface TreeNode {
  id: string;
  summary: string;
  tags: string[];
  categoryId: string | null;
  categoryName: string | null;
  importance: string | null;
  createdAt: string;
  depth: number;
  links: TreeNode[]; // 下游（本笔记手动链接到的）
}

/**
 * GET /api/topic/[rootId]?depth=2
 *
 * 返回以 rootId 为根的 NoteLink 手动链接树。
 * 只走 NoteLink（手动链接），不自动推断任何边。
 *
 * 参数：
 *   - depth: 向下展开几层（1 = 只看直接下游，2 = 再下一层，默认 2，最大 4）
 *   - direction: outgoing（只看下游，默认）| incoming（只看上游）| both（双向）
 *
 * 返回：一个以 rootId 为根的嵌套树结构，每层只展开 note 手动链接到的笔记。
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const rootId = params.rootId;
  const url = new URL(req.url);
  const depth = Math.min(Math.max(Number(url.searchParams.get('depth') || 2), 1), 4);
  let direction = (url.searchParams.get('direction') || 'auto') as 'outgoing' | 'incoming' | 'both' | 'auto';

  const root = await prisma.note.findUnique({
    where: { id: rootId },
    include: { category: true },
  });
  if (!root) {
    return NextResponse.json({ error: '根笔记不存在' }, { status: 404 });
  }

  // auto 模式：自动选出链/反链多的那个（用户从子节点进来默认向上看主题）
  if (direction === 'auto') {
    const [outgoingCnt, incomingCnt] = await Promise.all([
      prisma.noteLink.count({ where: { sourceId: rootId } }),
      prisma.noteLink.count({ where: { targetId: rootId } }),
    ]);
    direction = incomingCnt > outgoingCnt ? 'incoming' : 'outgoing';
  }

  // BFS 逐层遍历，每层只查当前层节点的 NoteLink
  // 我们把所有会出现在树里的节点先拉平查一次，避免 N+1 查询
  const visited = new Set<string>([rootId]);
  const layers: string[][] = [[rootId]];

  for (let d = 1; d <= depth; d++) {
    const currentLayer = layers[d - 1];
    const nextIds = new Set<string>();

    // 查这些节点的出链 / 入链
    const linkWhere: any = {};
    if (direction === 'outgoing') {
      linkWhere.sourceId = { in: currentLayer };
    } else if (direction === 'incoming') {
      linkWhere.targetId = { in: currentLayer };
    } else {
      linkWhere.OR = [
        { sourceId: { in: currentLayer } },
        { targetId: { in: currentLayer } },
      ];
    }

    const allLinks = await prisma.noteLink.findMany({ where: linkWhere });

    for (const link of allLinks) {
      if (direction === 'outgoing') {
        if (!visited.has(link.targetId)) nextIds.add(link.targetId);
      } else if (direction === 'incoming') {
        if (!visited.has(link.sourceId)) nextIds.add(link.sourceId);
      } else {
        // both：需要知道 direction 才能决定 parent-child，这里简化为 outgoing
        if (link.sourceId === currentLayer.find((x) => x === link.sourceId)) {
          if (!visited.has(link.targetId)) nextIds.add(link.targetId);
        }
      }
    }

    nextIds.forEach((id) => visited.add(id));
    layers.push(Array.from(nextIds));
  }

  // 把所有需要的节点一次性查出来
  const allIds = Array.from(visited);
  const allNotes = await prisma.note.findMany({
    where: { id: { in: allIds } },
    include: { category: true },
  });
  const noteMap = new Map(allNotes.map((n) => [n.id, n]));

  // 所有涉及的 NoteLink（用于构建树边）
  const allLinks = await prisma.noteLink.findMany({
    where: { OR: [{ sourceId: { in: allIds } }, { targetId: { in: allIds } }] },
  });

  // 构建 parent → children 映射（只走 outgoing）
  const childrenMap = new Map<string, string[]>();
  for (const link of allLinks) {
    const parentLayerIdx = layers.findIndex((layer) => layer.includes(link.sourceId));
    const childLayerIdx = layers.findIndex((layer) => layer.includes(link.targetId));
    // 确保 parent 在 child 上一层（或同级也允许，因为 NoteLink 不要求严格层级）
    if (parentLayerIdx !== -1 && childLayerIdx !== -1 && childLayerIdx > parentLayerIdx) {
      const arr = childrenMap.get(link.sourceId) || [];
      if (!arr.includes(link.targetId)) arr.push(link.targetId);
      childrenMap.set(link.sourceId, arr);
    }
  }

  // 递归构建树
  const seen = new Set<string>();
  function buildNode(id: string, d: number): TreeNode {
    seen.add(id);
    const n = noteMap.get(id)!;
    const summary = stripHtml(n.content).slice(0, 120) + (n.content.length > 120 ? '…' : '');
    const children = (childrenMap.get(id) || [])
      .filter((cid) => !seen.has(cid))
      .map((cid) => buildNode(cid, d + 1));
    return {
      id: n.id,
      summary,
      tags: parseJsonArray<string>(n.tags),
      categoryId: n.categoryId,
      categoryName: n.category?.name || null,
      importance: n.importance,
      createdAt: n.createdAt.toISOString(),
      depth: d,
      links: children,
    };
  }

  const tree = buildNode(rootId, 0);

  // 统计
  const totalNodes = allIds.length;
  const totalLinks = allLinks.filter(
    (l) => layers.findIndex((la) => la.includes(l.sourceId)) !== -1 &&
           layers.findIndex((la) => la.includes(l.targetId)) !== -1
  ).length;

  return NextResponse.json({
    rootId,
    depth,
    direction,
    tree,
    stats: { totalNodes, totalManualLinks: totalLinks },
  });
}
