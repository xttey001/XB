const d = require('./data/notes.json');
const titles = d.notes.slice(0, 20).map(n => n.title);
console.log('=== 前20条标题 ===');
titles.forEach(t => console.log(' -', t || '(无标题)'));
console.log('\n=== 关键词统计 ===');
const keywords = ['前端', 'react', '组件', 'next', '股票', 'python', 'AI', '工程'];
for (const kw of keywords) {
  const c = d.notes.filter(n => 
    (n.title || '').toLowerCase().includes(kw.toLowerCase()) || 
    (n.content || '').toLowerCase().includes(kw.toLowerCase())
  ).length;
  console.log(`  "${kw}": ${c} 条`);
}
console.log('\n=== 用 Fuse.js 测一下 ===');
const Fuse = require('fuse.js');
const docs = d.notes.map(n => ({
  id: n.id,
  title: (n.title || '').trim() || '',
  content: (n.content || '').substring(0, 2000),
  tags: (n.tags || []).join(' '),
  category: n.categoryName || ''
}));
const fuse = new Fuse(docs, {
  keys: ['title', 'content', 'tags', 'category'],
  threshold: 0.4, ignoreLocation: true, minMatchCharLength: 2
});
console.log('  搜"组件":', fuse.search('组件').length, '条');
console.log('  搜"react":', fuse.search('react').length, '条');
console.log('  搜"gch":', fuse.search('gch').length, '条');
console.log('  搜"stock":', fuse.search('stock').length, '条');
