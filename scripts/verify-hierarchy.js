const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const areas = await p.knowledgeArea.findMany({ orderBy: { order: 'asc' } });
  const cats = await p.category.findMany();

  console.log(`=== 验证: ${areas.length} Areas, ${cats.length} Categories ===`);

  for (const area of areas) {
    const topLevel = cats.filter((c) => c.knowledgeAreaId === area.id && !c.parentId);
    const totalLeaf = cats.filter((c) => c.knowledgeAreaId === area.id).length;
    console.log(`\n📂 ${area.name} — ${topLevel.length} 顶层 / ${totalLeaf} 总数`);
    for (const cat of topLevel) {
      const children = cats.filter((c) => c.parentId === cat.id);
      if (children.length > 0) {
        console.log(`  📁 ${cat.name} (${children.length} 子分类)`);
        for (const child of children) console.log(`    📄 ${child.name}`);
      } else {
        console.log(`  📄 ${cat.name} (叶子)`);
      }
    }
  }

  const unassigned = cats.filter((c) => !c.knowledgeAreaId);
  if (unassigned.length > 0) {
    console.log(`\n⚠️ ${unassigned.length} 个未归类:`);
    unassigned.forEach((c) => console.log(`  - ${c.name}`));
  } else {
    console.log('\n✅ 所有分类都已归到某个 Area');
  }

  await p.$disconnect();
})();
