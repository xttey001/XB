/**
 * 给 public-site/index.html 里的 styles.css?v=N 和 app.js?v=N 各 +1
 * 用法：node scripts/bump-cache.js
 */
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'public-site', 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

let changed = false;
html = html.replace(/\.css\?v=(\d+)/g, (m, v) => {
  changed = true;
  return `.css?v=${parseInt(v, 10) + 1}`;
});
html = html.replace(/\.js\?v=(\d+)/g, (m, v) => {
  changed = true;
  return `.js?v=${parseInt(v, 10) + 1}`;
});

if (changed) {
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log('[bump-cache] index.html cache version bumped ✅');
} else {
  console.log('[bump-cache] no ?v=N found in index.html');
}
