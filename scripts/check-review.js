const { PrismaClient } = require('../node_modules/.prisma/client');
const p = new PrismaClient();

async function main() {
  // 所有 reviewAt != null 的
  const reviewed = await p.note.findMany({
    where: { reviewAt: { not: null } },
    select: { id: true, reviewAt: true, reviewRepeat: true, reviewStep: true, reviewLastSent: true, updatedAt: true },
    orderBy: { reviewAt: 'asc' },
  });
  console.log('=== reviewAt != null:', reviewed.length, '===');
  reviewed.forEach((x) => {
    console.log(`${x.id.slice(0, 8)} repeat=${x.reviewRepeat} step=${x.reviewStep} reviewAt=${x.reviewAt} lastSent=${x.reviewLastSent} updated=${x.updatedAt}`);
  });

  // reviewRepeat 有值但 reviewAt 为 null 的
  const dirty = await p.note.findMany({
    where: { reviewRepeat: { not: null, not: 'none' }, reviewAt: null },
    select: { id: true, reviewRepeat: true, reviewStep: true, updatedAt: true },
  });
  console.log('\n=== reviewRepeat 有值但 reviewAt=null:', dirty.length, '===');
  dirty.forEach((x) => {
    console.log(`${x.id.slice(0, 8)} repeat=${x.reviewRepeat} step=${x.reviewStep} updated=${x.updatedAt}`);
  });

  // reviewLastSent 有值的（可能说明被回顾过？）
  const sent = await p.note.findMany({
    where: { reviewLastSent: { not: null } },
    select: { id: true, reviewAt: true, reviewLastSent: true },
  });
  console.log('\n=== reviewLastSent != null:', sent.length, '===');
  sent.forEach((x) => {
    console.log(`${x.id.slice(0, 8)} reviewAt=${x.reviewAt} lastSent=${x.reviewLastSent}`);
  });
}

main().catch((e) => console.error(e.message)).finally(() => p.$disconnect());
