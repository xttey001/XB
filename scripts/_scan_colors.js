const fs = require('fs');

// 扫描 styles.css 里所有硬编码颜色
const css = fs.readFileSync('d:/XB/public-site/styles.css', 'utf8');
const cssLines = css.split('\n');

console.log('=== styles.css 硬编码颜色（非 var(--xxx)）===\n');
cssLines.forEach((line, i) => {
  // 跳过注释行和变量定义行
  if (line.includes(':root') || line.trim().startsWith('/*') || line.trim().startsWith('*') || line.includes('var(--') || line.includes('rgba(101,74,203')) return;
  
  // 匹配 #xxx / #xxxxxx / rgb(...) / color / background
  if (/#[0-9a-fA-F]{3,8}/.test(line) || /color\s*:\s*[^v;]+/.test(line) || /background[^-]\s*:\s*[^v;]+/.test(line)) {
    if (line.includes('#') || (line.includes('color:') && !line.includes('var('))) {
      console.log(`L${i+1}: ${line.trim()}`);
    }
  }
});

console.log('\n=== app.js 里硬编码颜色 ===\n');
const js = fs.readFileSync('d:/XB/public-site/app.js', 'utf8');
const jsLines = js.split('\n');
jsLines.forEach((line, i) => {
  if (/#[0-9a-fA-F]{3,8}/.test(line) || /color\s*:\s*['"]/.test(line) || /bgcolor/.test(line)) {
    console.log(`L${i+1}: ${line.trim().substring(0, 120)}`);
  }
});
