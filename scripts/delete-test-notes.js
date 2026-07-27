const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    // 删除内容以“【测试笔记”开头的笔记
    const result = await prisma.note.deleteMany({
      where: {
        content: { startsWith: '【测试笔记' },
      },
    });
    console.log(`Deleted ${result.count} test notes`);

    // 删除空的“性能测试”分类
    const perfCategory = await prisma.category.findUnique({
      where: { name: '性能测试' },
      include: { _count: { select: { notes: true } } },
    });
    if (perfCategory && perfCategory._count.notes === 0) {
      await prisma.category.delete({ where: { id: perfCategory.id } });
      console.log('Deleted empty category: 性能测试');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
