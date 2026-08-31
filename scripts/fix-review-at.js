/**
 * 迁移脚本：修复 reviewRepeat 有值但 reviewAt=null 的历史脏数据
 * 运行：node scripts/fix-review-at.js
 */
const { PrismaClient } = require('../node_modules/.prisma/client');
const p = new PrismaClient();

const EBBINGHAUS_INTERVALS = [1, 3, 7, 14, 30];

function calcNextReviewAt(repeat, step) {
  const now = Date.now();
  switch (repeat) {
    case 'ebbinghaus': {
      const s = step ?? 0;
      const days = EBBINGHAUS_INTERVALS[s] ?? EBBINGHAUS_INTERVALS[0];
      return new Date(now + days * 24 * 60 * 60 * 1000);
    }
    case 'daily': return new Date(now + 24 * 60 * 60 * 1000);
    case 'weekly': return new Date(now + 7 * 24 * 60 * 60 * 1000);
    case 'biweekly': return new Date(now + 14 * 24 * 60 * 60 * 1000);
    case 'monthly': {
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      return d;
    }
    default: return null;
  }
}

async function main() {
  // 找 reviewRepeat 有值但 reviewAt 为 null 的笔记
  const dirtyNotes = await p.note.findMany({
    where: {
      reviewRepeat: { not: null, not: 'none' },
      reviewAt: null,
    },
    select: { id: true, reviewRepeat: true, reviewStep: true },
  });

  console.log(`Found ${dirtyNotes.length} dirty notes (reviewRepeat set but reviewAt null)`);

  let fixed = 0;
  for (const note of dirtyNotes) {
    const nextAt = calcNextReviewAt(note.reviewRepeat, note.reviewStep);
    if (!nextAt) {
      console.log(`  SKIP ${note.id.slice(0, 8)}: repeat=${note.reviewRepeat}, cannot calc`);
      continue;
    }
    await p.note.update({
      where: { id: note.id },
      data: { reviewAt: nextAt },
    });
    fixed++;
    console.log(`  FIX ${note.id.slice(0, 8)}: repeat=${note.reviewRepeat} step=${note.reviewStep} → reviewAt=${nextAt.toISOString()}`);
  }

  console.log(`\nDone. Fixed ${fixed} / ${dirtyNotes.length}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => p.$disconnect());
