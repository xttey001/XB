const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    // 创建测试分类（如果不存在）
    const category = await prisma.category.upsert({
      where: { name: '性能测试' },
      update: {},
      create: { name: '性能测试', color: '#F59E0B' },
    });

    const baseContent = `这是一段用于测试分页和摘要功能的笔记内容。我们需要生成足够多的文字来确保摘要功能能够正常工作。当内容长度超过两百个字符时，列表页应该只显示摘要，并显示“查看全文”按钮。用户可以点击按钮进入详情页查看完整内容。`;

    for (let i = 1; i <= 25; i++) {
      await prisma.note.create({
        data: {
          content: `【测试笔记 ${i}】${baseContent} 这是第 ${i} 条测试笔记的额外内容，用于区分不同笔记。`,
          images: '[]',
          tags: '["测试", "性能"]',
          categoryId: i % 3 === 0 ? category.id : null,
          isFavorite: i % 5 === 0,
          pinned: false,
          pinnedGlobal: false,
          pinnedFavorite: false,
          pinnedCategory: false,
          pinOrder: 0,
          globalOrder: i,
          categoryOrder: i,
          favoriteOrder: i,
        },
      });
    }

    console.log('Created 25 test notes');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
