const fs = require('fs');
const notes = JSON.parse(fs.readFileSync('d:/XB/public-site/data/notes.json'));

console.log('=== 笔记 content 格式 ===');
console.log('类型:', typeof notes[0].content);
console.log('长度:', notes[0].content.length);
console.log('前300字:', notes[0].content.slice(0, 300));
console.log();
console.log('=== 各种特征 ===');
console.log('有 <img>:', notes.filter(n => n.content.includes('<img')).length);
console.log('有 upload:', notes.filter(n => n.content.includes('upload')).length);
console.log('有 /uploads:', notes.filter(n => n.content.includes('/uploads')).length);
console.log('有 uploads/2026:', notes.filter(n => n.content.includes('uploads/2026')).length);
console.log('有 "type":', notes.filter(n => n.content.includes('"type"')).length);
console.log('有 Tiptap JSON（{type,content}）:', notes.filter(n => n.content.startsWith('{') || n.content.startsWith('[')).length);

// 找一个有图片相关内容的笔记
const withUploads = notes.find(n => n.content.includes('uploads'));
if (withUploads) {
  console.log('\n=== 含 uploads 的笔记 ===');
  console.log(withUploads.content.slice(0, 500));
}

const imgNote = notes.find(n => n.content.includes('<img'));
if (imgNote) {
  console.log('\n=== 含 <img> 的笔记 ===');
  console.log(imgNote.content.slice(0, 500));
}

const jsonNote = notes.find(n => n.content.startsWith('{'));
if (jsonNote) {
  console.log('\n=== 看起来是 JSON 的笔记 ===');
  console.log(jsonNote.content.slice(0, 500));
}

// 查 categories 里 lisa 图标类型
const cats = JSON.parse(fs.readFileSync('d:/XB/public-site/data/categories.json'));
const lisa = cats.find(c => c.name === 'lisa');
console.log('\n=== lisa 分类图标 ===');
console.log('icon:', lisa.icon);
console.log('startsWith /icons/:', lisa.icon?.startsWith('/icons/'));
console.log('文件存在:', fs.existsSync('d:/XB/public-site/' + lisa.icon));
