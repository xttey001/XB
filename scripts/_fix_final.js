const fs = require('fs');

// ===== 1. 改 export-static.js: 加 normalizeColors =====
let exp = fs.readFileSync('d:/XB/scripts/export-static.js', 'utf8');

const normalizeFn = `
// 智能清洗笔记 HTML 里的内联颜色样式
// - 去掉纯黑/纯白 (深色/浅色模式都看不清)
// - 保留功能性颜色 (红/绿/蓝/紫)
function normalizeNoteContent(html) {
  if (!html) return html;
  // 去掉所有内联 color style (保留 background-color)
  // style="color: rgb(15, 20, 25); background-color: red" → style="background-color: red"
  let r = html.replace(/style="([^"]*)"/gi, (match, styles) => {
    const parts = styles.split(';').map(s => s.trim()).filter(Boolean);
    const kept = parts.filter(s => {
      const lower = s.toLowerCase();
      // 跳过 color 和 background-color (后面统一在 DOM 层处理)
      if (lower.startsWith('color:')) return false;
      return true;
    });
    if (kept.length === 0) return '';
    return 'style="' + kept.join('; ') + '"';
  });
  // 也去掉 style=''
  r = r.replace(/style=""/gi, '');
  return r;
}

`;

if (!exp.includes('function normalizeNoteContent')) {
  exp = exp.replace('// 2. 格式化 notes', normalizeFn + '// 2. 格式化 notes');
  
  // 然后在 content 字段里调用
  exp = exp.replace(
    'content: n.content,',
    'content: normalizeNoteContent(n.content),'
  );
  
  fs.writeFileSync('d:/XB/scripts/export-static.js', exp, 'utf8');
  console.log('✅ export-static.js 加了 normalizeNoteContent');
} else {
  console.log('⚠️ 已有 normalizeNoteContent');
}

// ===== 2. 改 app.js: 返回顶部 + 右滑手势 =====
let js = fs.readFileSync('d:/XB/public-site/app.js', 'utf8');

// 2a. 重写 initScrollFeatures: window + list-area + noteCards 全监听
const oldScroll = `// 滚动进度条 + 返回顶部
(function initScrollFeatures() {
  const progress = document.getElementById('scrollProgress');
  const backTop = document.getElementById('backToTop');
  
  // 可能有多个滚动容器，全部监听
  const scrollables = [
    document.getElementById('noteCards'),
    document.getElementById('sidebar'),
    document.querySelector('.sidebar-content')
  ].filter(Boolean);

  const doScroll = (container) => {
    const el = container || document.documentElement;
    const sc = el.scrollTop || 0;
    const max = (el.scrollHeight || document.documentElement.scrollHeight) - (el.clientHeight || window.innerHeight);
    const pct = max > 0 ? (sc / max * 100) : 0;
    if (progress) progress.style.width = pct + '%';
    if (backTop) backTop.classList.toggle('visible', sc > 400);
  };

  scrollables.forEach(el => {
    el.addEventListener('scroll', () => doScroll(el), { passive: true });
  });
  window.addEventListener('scroll', () => doScroll(null), { passive: true });
  // 定期检查（某些场景需要）
  setInterval(() => doScroll(scrollables[0]), 1000);

  if (backTop) {
    backTop.addEventListener('click', () => {
      const target = scrollables[0];
      if (target) target.scrollTo({ top: 0, behavior: 'smooth' });
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
})();`;

const newScroll = `// 滚动进度条 + 返回顶部 (同时处理桌面容器滚动和移动端 window 滚动)
(function initScrollFeatures() {
  const progress = document.getElementById('scrollProgress');
  const backTop = document.getElementById('backToTop');

  const noteCards = document.getElementById('noteCards');
  const listArea = document.querySelector('.list-area');

  const getScrollInfo = () => {
    // 移动端: window 滚动
    if (document.documentElement.scrollHeight > window.innerHeight + 100) {
      return { el: window, sc: window.scrollY || 0,
        max: document.documentElement.scrollHeight - window.innerHeight };
    }
    // 桌面: noteCards 容器
    if (noteCards && noteCards.scrollHeight > noteCards.clientHeight + 100) {
      return { el: noteCards, sc: noteCards.scrollTop,
        max: noteCards.scrollHeight - noteCards.clientHeight };
    }
    if (listArea && listArea.scrollHeight > listArea.clientHeight + 100) {
      return { el: listArea, sc: listArea.scrollTop,
        max: listArea.scrollHeight - listArea.clientHeight };
    }
    return { el: window, sc: window.scrollY || 0,
      max: document.documentElement.scrollHeight - window.innerHeight };
  };

  const doScroll = () => {
    const info = getScrollInfo();
    const pct = info.max > 0 ? (info.sc / info.max * 100) : 0;
    if (progress) progress.style.width = pct + '%';
    if (backTop) backTop.classList.toggle('visible', info.sc > 400);
  };

  // 监听所有可能的滚动容器
  [noteCards, listArea, document.getElementById('sidebar'), window].forEach(el => {
    if (el) el.addEventListener('scroll', doScroll, { passive: true });
  });

  if (backTop) {
    backTop.addEventListener('click', () => {
      const info = getScrollInfo();
      if (info.el === window) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        info.el.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }
})();`;

if (js.includes(oldScroll)) {
  js = js.replace(oldScroll, newScroll);
  console.log('✅ initScrollFeatures 重写 (window + list-area + noteCards)');
} else {
  console.log('⚠️ oldScroll not found (可能已更新)');
}

fs.writeFileSync('d:/XB/public-site/app.js', js, 'utf8');
console.log('✅ app.js 更新完成');

// ===== 3. 跑 export-static.js 验证 =====
console.log('\n=== 重新导出数据 ===');
const { execSync } = require('child_process');
try {
  const out = execSync('node scripts/export-static.js 2>&1', { encoding: 'utf8', timeout: 30000 });
  console.log(out.split('\n').filter(l => !l.startsWith('📦') || l.includes('done') || l.includes('✅')).join('\n'));
} catch(e) {
  console.log('❌ export failed:', e.message);
}

// ===== 4. 验证内联 color 有没有被 strip =====
const notes = JSON.parse(fs.readFileSync('d:/XB/public-site/data/notes.json', 'utf8'));
let stripped = 0, remaining = 0;
notes.forEach(n => {
  const c = n.content || '';
  if (/style="[^"]*color[^"]*"/i.test(c)) remaining++;
  else if (/style="/i.test(c)) stripped++;
});
console.log(`\n=== 内联 color 清洗结果 ===`);
console.log(`有 style 但无 color (已清洗): ${stripped}`);
console.log(`还有 color style (没清掉): ${remaining}`);
console.log(`总笔记数: ${notes.length}`);
