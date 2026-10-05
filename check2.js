const Database = require('d:/XB/node_modules/better-sqlite3');
const d = new Database('d:/XB/prisma/dev.db');

console.log('=== 数据库里的笔记 ===');
const total = d.prepare('SELECT COUNT(*) as c FROM Note').get();
console.log('总笔记数:', total.c);

const withUpload = d.prepare("SELECT COUNT(*) as c FROM Note WHERE content LIKE '%upload%' OR content LIKE '%uploads%'").get();
console.log('含 uploads 的:', withUpload.c);

const withImage = d.prepare("SELECT COUNT(*) as c FROM Note WHERE content LIKE '%image%'").get();
console.log('含 image 的:', withImage.c);

const withSlashUpload = d.prepare("SELECT COUNT(*) as c FROM Note WHERE content LIKE '%/uploads/%'").get();
console.log('含 /uploads/ 的:', withSlashUpload.c);

const withImg = d.prepare("SELECT COUNT(*) as c FROM Note WHERE content LIKE '%<img%'").get();
console.log('含 <img 的:', withImg.c);

// 看第一条有图片相关的
const anyImage = d.prepare("SELECT id, content FROM Note WHERE content LIKE '%upload%' OR content LIKE '%image%' LIMIT 1").get();
if (anyImage) {
  console.log('\n=== 第一条含图片相关的笔记 ===');
  console.log('id:', anyImage.id);
  console.log('content:', anyImage.content.slice(0, 800));
}

// 看随机 3 条的 content 结构
console.log('\n=== 随机 3 条笔记 content 前 300 字 ===');
const samples = d.prepare('SELECT id, content FROM Note ORDER BY RANDOM() LIMIT 3').all();
samples.forEach(r => {
  console.log('\n---', r.id);
  console.log(r.content.slice(0, 300));
});

// 查 categories 里顶级交易员下子分类的 icon
console.log('\n=== 顶级交易员子分类图标 ===');
const cats = d.prepare("SELECT id, name, icon, color FROM Category WHERE parentId IN (SELECT id FROM Category WHERE name='顶级交易员')").all();
cats.forEach(c => console.log(' ', c.name, '| icon:', JSON.stringify(c.icon)));

d.close();
