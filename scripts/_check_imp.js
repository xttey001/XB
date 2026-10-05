const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  const vImp = await p.note.count({ where: { importance: 'very_important' } });
  const vImp2 = await p.note.count({ where: { importance: 'veryImportant' } });
  const imp = await p.note.count({ where: { importance: 'important' } });
  const nullImp = await p.note.count({ where: { importance: null } });
  console.log('DB very_important:', vImp);
  console.log('DB veryImportant:', vImp2);
  console.log('DB important:', imp);
  console.log('DB null:', nullImp);

  // 看 export-static.js 里怎么映射的
  console.log('\n=== 查几条 very_important 样本 ===');
  const samples = await p.note.findMany({
    where: { importance: { in: ['very_important', 'important'] } },
    select: { id: true, importance: true, content: true },
    take: 5
  });
  samples.forEach(s => console.log(s.importance, '|', s.content.slice(0, 40)));

  await p.$disconnect();
}
main();
