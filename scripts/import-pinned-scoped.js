const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const backupPath = path.join(__dirname, 'pinned-legacy-backup.json');
    if (!fs.existsSync(backupPath)) {
      console.log('No backup file found, skipping import');
      return;
    }

    const notes = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
    let migrated = 0;

    for (const n of notes) {
      const data = {
        // 只信任新系统的 scope 字段；旧的 pinned 字段已被详情页 bug 污染，不再同步
        pinnedGlobal: n.pinnedGlobal || false,
        pinnedFavorite: n.pinnedFavorite || false,
        pinnedCategory: n.pinnedCategory || false,
        globalPinOrder: 0,
        favoritePinOrder: 0,
        categoryPinOrder: 0,
        importantPinOrder: 0,
      };

      // 按 scope 分配旧 pinOrder
      if (n.pinnedCategory) {
        data.categoryPinOrder = n.pinOrder || 0;
      } else if (n.pinnedFavorite) {
        data.favoritePinOrder = n.pinOrder || 0;
      } else if (n.pinnedGlobal) {
        data.globalPinOrder = n.pinOrder || 0;
      }

      await prisma.note.update({ where: { id: n.id }, data });
      migrated++;
    }

    console.log(`Imported ${migrated} notes`);
    fs.unlinkSync(backupPath);
    console.log('Removed backup file');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
