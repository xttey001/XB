const d = require('./public-site/data/notes.json');
const hit = d.filter(n => (n.content || '').includes('color:') && !n.content.includes('style="background'));
hit.slice(0, 3).forEach(n => {
  const c = n.content;
  const m = c.match(/style="[^"]*"/gi);
  console.log(n.id);
  if (m) m.forEach(s => console.log('  ', s.substring(0, 80)));
  // 也看看有没有不带引号的 style
  const m2 = c.match(/color:[^;"'<\s]+/gi);
  if (m2) m2.forEach(s => console.log('  direct:', s));
});
console.log('\n还有 color 的:', hit.length);
