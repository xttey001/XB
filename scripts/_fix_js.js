const fs = require('fs');
const p = 'd:/XB/public-site/app.js';
let c = fs.readFileSync(p, 'utf8');

// 1. 重写 initScrollFeatures
const oldScroll = `// 滚动进度条 + 返回顶部
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
})();`;

const newScroll = `// 滚动进度条 + 返回顶部
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

if (c.includes(oldScroll)) {
  c = c.replace(oldScroll, newScroll);
  console.log('✅ initScrollFeatures 重写');
} else {
  console.log('❌ oldScroll not found');
  const idx = c.indexOf('initScrollFeatures');
  if (idx >= 0) console.log('Found at:', idx);
}

// 2. 在 closeSidebar 后面加右滑打开侧边栏手势
const oldCloseSidebar = `function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.add('hidden');
}

// ===== 图片路径映射 =====`;

const newCloseSidebar = `function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.add('hidden');
}

// 手机右滑打开侧边栏手势（屏幕左边缘 30px 内开始滑动）
(function initSwipeOpenSidebar() {
  let startX = 0, startY = 0, touching = false, edgeTouch = false;
  const EDGE_WIDTH = 30; // 左边缘 30px 内触发
  const MIN_DX = 60;     // 至少右滑 60px 才打开
  
  document.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    touching = true;
    edgeTouch = startX <= EDGE_WIDTH;
  }, { passive: true });
  
  document.addEventListener('touchend', e => {
    if (!touching || !edgeTouch) { touching = false; return; }
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const dx = endX - startX;
    const dy = Math.abs(endY - startY);
    
    if (dx > MIN_DX && dx > dy) {
      // 右滑足够多且水平为主 → 打开侧边栏
      document.getElementById('sidebar').classList.add('open');
      document.getElementById('sidebarOverlay').classList.remove('hidden');
    }
    touching = false;
    edgeTouch = false;
  }, { passive: true });
})();

// ===== 图片路径映射 =====`;

if (c.includes(oldCloseSidebar)) {
  c = c.replace(oldCloseSidebar, newCloseSidebar);
  console.log('✅ closeSidebar 后加了右滑手势');
} else {
  console.log('❌ oldCloseSidebar not found');
  const idx = c.indexOf('closeSidebar');
  if (idx >= 0) console.log('Found at:', idx, c.substring(idx, idx + 100));
}

fs.writeFileSync(p, c, 'utf8');
console.log('\n✅ app.js 全部更新');
