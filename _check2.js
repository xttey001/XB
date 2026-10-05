const notes = require('./data/notes.json');
console.log('=== 前15条标题 ===');
notes.slice(0, 15).forEach(n => console.log(' -', (n.title || '').substring(0, 40) || '(无标题)'));

// 统计内容里最常见的词
const words = {};
for (const n of notes) {
  const text = ((n.content || '') + ' ' + (n.title || '')).toLowerCase();
  ['react','next','前端','组件','hooks','python','股票','交易','系统','架构','设计','思考','编程','code','api','数据','模型'].forEach(w => {
    if (text.includes(w)) words[w] = (words[w] || 0) + 1;
  });
}
console.log('\n=== 关键词出现次数 ===');
Object.entries(words).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(`  ${k}: ${v}`));
