const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function removeUploads(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      removeUploads(full);
      fs.rmdirSync(full);
    } else if (entry.name !== '.gitkeep') {
      fs.unlinkSync(full);
    }
  }
}

async function main() {
  await prisma.comment.deleteMany({});
  await prisma.like.deleteMany({});
  await prisma.repost.deleteMany({});
  await prisma.note.deleteMany({});
  await prisma.category.deleteMany({});
  await removeUploads(path.join(__dirname, '..', 'public', 'uploads'));
  console.log('All notes, comments, likes, reposts, categories and uploads cleared.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
