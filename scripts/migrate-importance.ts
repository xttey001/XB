import { prisma } from '../lib/prisma';
import { parseJsonArray, stringifyJsonArray } from '../lib/utils';

/**
 * 一次性迁移脚本：把旧标签「重要」「极重要」迁移到独立的 importance 字段
 * 运行方式：npx tsx scripts/migrate-importance.ts
 */
async function main() {
  const notes = await prisma.note.findMany({
    where: {
      tags: {
        contains: '重要',
      },
    },
  });

  let migrated = 0;
  let skipped = 0;

  for (const note of notes) {
    const tags = parseJsonArray<string>(note.tags);
    const hasVeryImportant = tags.includes('极重要');
    const hasImportant = tags.includes('重要');

    if (!hasImportant && !hasVeryImportant) {
      skipped++;
      continue;
    }

    // 极重要优先级高于重要
    const importance = hasVeryImportant
      ? 'very_important'
      : hasImportant
      ? 'important'
      : null;

    const newTags = tags.filter((t) => t !== '重要' && t !== '极重要');

    await prisma.note.update({
      where: { id: note.id },
      data: {
        importance,
        tags: stringifyJsonArray(newTags),
      },
    });

    migrated++;
    console.log(
      `Migrated ${note.id}: importance=${importance}, removed tags=[${tags
        .filter((t) => t === '重要' || t === '极重要')
        .join(', ')}]`
    );
  }

  console.log(`\n迁移完成：${migrated} 条已迁移，${skipped} 条跳过`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
