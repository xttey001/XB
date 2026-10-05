const fs = require('fs');
const p = 'd:/XB/public-site/app.js';
let c = fs.readFileSync(p, 'utf8');

// 1. 给 cat-btn 加动态 padding-left（depth*14px）
// 原: <button class="cat-btn ${isActive ? 'active' : ''} ${depth > 0 ? 'cat-child' : ''}">
// 新: <button class="cat-btn ... cat-child" style="padding-left: ${depth * 14}px">
const oldBtn = '<button class="cat-btn ${isActive ? \'active\' : \'\'} ${depth > 0 ? \'cat-child\' : \'\'}">';
const newBtn = '<button class="cat-btn ${isActive ? \'active\' : \'\'} ${depth > 0 ? \'cat-child\' : \'\'}" style="padding-left: ${depth * 14}px">';
if (c.includes(oldBtn)) {
  c = c.replace(oldBtn, newBtn);
  console.log('✅ cat-btn style added');
} else {
  console.log('❌ oldBtn not found, searching...');
  const idx = c.indexOf('cat-btn ${isActive');
  console.log('Found at index:', idx);
  if (idx >= 0) console.log('Context:', c.substring(idx, idx + 100));
}

fs.writeFileSync(p, c, 'utf8');
console.log('\nDone');
