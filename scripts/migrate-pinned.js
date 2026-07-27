const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const result = await prisma.note.updateMany({
      where: { pinned: true },
      data: { pinnedGlobal: true },
    });
    console.log(`Migrated ${result.count} pinned notes to pinnedGlobal`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
