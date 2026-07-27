const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const note = await prisma.note.create({
    data: {
      content: '这是一条测试笔记，用于验证点赞、评论、转发和日历筛选功能。\n\n- 功能1：点赞\n- 功能2：评论\n- 功能3：转发\n- 功能4：日历筛选',
      images: JSON.stringify([]),
      tags: JSON.stringify(['测试', '功能验证']),
      globalOrder: 1,
      categoryOrder: 1,
      favoriteOrder: 1,
    },
  });
  console.log('Created note:', note.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
