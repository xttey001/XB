const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    // 按截图中的笔记内容模糊匹配
    const note = await prisma.note.findFirst({
      where: {
        content: {
          contains: '看什么正在影响他的决策',
        },
      },
      include: { category: true },
    });

    if (!note) {
      console.log('未找到目标笔记');
      return;
    }

    console.log('=== 目标笔记置顶状态 ===');
    console.log('ID:', note.id);
    console.log('分类:', note.category?.name || '未分类');
    console.log('pinnedGlobal (全部笔记):', note.pinnedGlobal);
    console.log('pinnedFavorite (收藏):', note.pinnedFavorite);
    console.log('pinnedImportant (重要):', note.pinnedImportant);
    console.log('pinnedCategory (分类):', note.pinnedCategory);
    console.log('globalPinOrder:', note.globalPinOrder);
    console.log('favoritePinOrder:', note.favoritePinOrder);
    console.log('importantPinOrder:', note.importantPinOrder);
    console.log('categoryPinOrder:', note.categoryPinOrder);
    console.log('内容前 60 字:', note.content.slice(0, 60));

    // 同时统计所有笔记的置顶字段分布
    const stats = await prisma.note.groupBy({
      by: ['pinnedGlobal', 'pinnedFavorite', 'pinnedImportant', 'pinnedCategory'],
      _count: { id: true },
    });
    console.log('\n=== 全库置顶组合分布 ===');
    for (const row of stats) {
      console.log(
        `global=${row.pinnedGlobal} favorite=${row.pinnedFavorite} important=${row.pinnedImportant} category=${row.pinnedCategory}: ${row._count.id} 条`
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
