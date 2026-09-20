const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const areas = await p.knowledgeArea.findMany({ orderBy: { order: 'asc' } });
  const cats = await p.category.findMany({
    include: { knowledgeArea: true, children: true, _count: { select: { notes: true } } },
    orderBy: { knowledgeAreaId: 'asc' },
  });

  console.log('=== KnowledgeAreas ===');
  areas.forEach((a) => console.log(a.id, '|', a.name, '| progressStatus:', a.progressStatus));

  console.log('\n=== Categories (' + cats.length + ') ===');
  const groups = {};
  cats.forEach((c) => {
    const aid = c.knowledgeAreaId || 'none';
    if (!groups[aid]) groups[aid] = [];
    groups[aid].push(c);
  });

  for (const [aid, arr] of Object.entries(groups)) {
    const aname = areas.find((a) => a.id === aid)?.name || '未归类';
    console.log(`\n--- ${aname} (${arr.length}) ---`);
    arr.forEach((c) => {
      console.log(
        `  ${c.id.slice(-4)} | ${c.name} | parent: ${c.parentId?.slice(-4) || 'null'} | children: ${c.children.length} | notes: ${c._count.notes}`
      );
    });
  }

  await p.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
