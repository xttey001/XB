const fs = require('fs');
const notes = JSON.parse(fs.readFileSync('d:/XB/public-site/data/notes.json'));

// 找所有含 uploads 的笔记
const withUploads = notes.filter(n => {
  const j = JSON.stringify(n);
  return j.includes('uploads');
});

console.log('含 uploads 的笔记:', withUploads.length, '/', notes.length);
if (withUploads.length > 0) {
  const n = withUploads[0];
  console.log('\n第一条的字段:', Object.keys(n));
  console.log('content:', n.content?.slice(0, 500));
  // 看所有字段值
  for (const [k, v] of Object.entries(n)) {
    if (typeof v === 'string' && v.includes('uploads')) {
      console.log('  字段', k, ':', v.slice(0, 200));
    }
  }
}

// 查有没哪个笔记的 icon 字段里有 uploads
const withIconUploads = notes.filter(n => n.categoryIcon?.includes('uploads'));
console.log('\ncategoryIcon 含 uploads:', withIconUploads.length);

const withCatImgUploads = notes.filter(n => n.categoryIcon && !n.categoryIcon.startsWith('/icons/'));
console.log('categoryIcon 不是 /icons/ 开头的:', withCatImgUploads.length);
withCatImgUploads.forEach(n => console.log(' ', n.categoryName, '| icon:', n.categoryIcon));
