const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  // 今天更新的
  const notes = await p.note.findMany({
    where: { updatedAt: { gte: new Date('2026-10-04') } },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, content: true, createdAt: true, updatedAt: true },
    take: 10
  });
  console.log('=== 10月4日后更新的笔记 ===');
  notes.forEach(n => console.log('created:', n.createdAt.toISOString(), '| updated:', n.updatedAt.toISOString(), '|', n.content.slice(0, 60)));

  // 今天创建的
  const newNotes = await p.note.findMany({
    where: { createdAt: { gte: new Date('2026-10-04') } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, content: true, createdAt: true },
    take: 10
  });
  console.log('\n=== 10月4日后新创建的笔记 ===');
  newNotes.forEach(n => console.log(n.createdAt.toISOString(), '|', n.content.slice(0, 60)));

  await p.$disconnect();
}
main();
