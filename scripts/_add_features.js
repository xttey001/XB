const fs = require('fs');

// ===== 1. 改 index.html =====
let h = fs.readFileSync('d:/XB/public-site/index.html', 'utf8');

// body 开头加进度条 + 返回顶部
h = h.replace('<body>', `<body>

<!-- 滚动进度条 -->
<div class="scroll-progress" id="scrollProgress"></div>

<!-- 返回顶部 -->
<button class="back-to-top" id="backToTop" aria-label="返回顶部">↑</button>`);

// header 加深色切换按钮
h = h.replace(
  `  </div>
</header>`,
  `  </div>
  <button class="theme-toggle" id="themeToggle" aria-label="切换深色模式">🌙</button>
</header>`
);

fs.writeFileSync('d:/XB/public-site/index.html', h, 'utf8');
console.log('✅ index.html done');

// ===== 2. 改 app.js =====
let c = fs.readFileSync('d:/XB/public-site/app.js', 'utf8');

const oldInit = `init().catch(e => console.error('Init failed:', e));`;
const newFeatures = `
// ===== 第一档增强功能 =====
// 深色模式
(function initTheme() {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (saved === 'dark' || (!saved && prefersDark)) {
    document.documentElement.classList.add('dark');
  }
  const btn = document.getElementById('themeToggle');
  if (btn) {
    btn.textContent = document.documentElement.classList.contains('dark') ? '☀️' : '🌙';
    btn.addEventListener('click', () => {
      document.documentElement.classList.toggle('dark');
      const isDark = document.documentElement.classList.contains('dark');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      btn.textContent = isDark ? '☀️' : '🌙';
    });
  }
})();

// 滚动进度条 + 返回顶部
(function initScrollFeatures() {
  const progress = document.getElementById('scrollProgress');
  const backTop = document.getElementById('backToTop');
  const list = document.getElementById('noteCards');

  const onScroll = () => {
    const sc = list ? list.scrollTop : document.documentElement.scrollTop;
    const max = (list ? list.scrollHeight : document.documentElement.scrollHeight) - (list ? list.clientHeight : window.innerHeight);
    const pct = max > 0 ? (sc / max * 100) : 0;
    if (progress) progress.style.width = pct + '%';
    if (backTop) backTop.classList.toggle('visible', sc > 400);
  };

  if (list) list.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });

  if (backTop) {
    backTop.addEventListener('click', () => {
      if (list) list.scrollTo({ top: 0, behavior: 'smooth' });
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
})();

// 阅读时间
(function initReadTime() {
  const wordsPerMinute = 400;
  const applyToCards = () => {
    const cards = document.querySelectorAll('.note-card .card-body');
    cards.forEach(card => {
      if (card.querySelector('.read-time')) return; // 已经加过
      const text = (card.textContent || '').replace(/\s+/g, '');
      const mins = Math.max(1, Math.round(text.length / wordsPerMinute));
      const badge = document.createElement('span');
      badge.className = 'read-time';
      badge.textContent = ' · 约 ' + mins + ' 分钟';
      const meta = card.closest('.note-card')?.querySelector('.card-meta');
      if (meta) meta.appendChild(badge);
    });
  };
  // 每次 renderNoteList 后重新 apply
  const origRender = window.renderNoteList;
  if (origRender) {
    window.renderNoteList = function() { origRender.apply(this, arguments); setTimeout(applyToCards, 50); };
  }
  applyToCards();
})();

init().catch(e => console.error('Init failed:', e));`;

if (c.includes(oldInit)) {
  c = c.replace(oldInit, newFeatures);
  fs.writeFileSync('d:/XB/public-site/app.js', c, 'utf8');
  console.log('✅ app.js done');
} else {
  console.log('❌ oldInit not found in app.js');
  const idx = c.indexOf("init().catch");
  console.log('Found at:', idx);
}
