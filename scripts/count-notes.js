const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const count = await prisma.note.count();
    console.log('notes:', count);
  } finally {
    await prisma.$disconnect();
  }
}

main();
