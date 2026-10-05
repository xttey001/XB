const fs = require('fs');
const path = require('path');

// ====== 1. 修 styles.css 剩余硬编码 ======
let css = fs.readFileSync('d:/XB/public-site/styles.css', 'utf8');

css = css.replace(
  '.modal-close{background:none;border:none;font-size:18px;cursor:pointer;color:#71717a;width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center}',
  '.modal-close{background:none;border:none;font-size:18px;cursor:pointer;color:var(--text-tertiary);width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center}'
);
css = css.replace(
  '.modal-close:hover{background:#f4f4f5}',
  '.modal-close:hover{background:var(--surface-alt)}'
);

fs.writeFileSync('d:/XB/public-site/styles.css', css, 'utf8');
console.log('✅ styles.css 所有硬编码颜色 → CSS 变量');

// ====== 2. 修 app.js 硬编码 fallback ======
let js = fs.readFileSync('d:/XB/public-site/app.js', 'utf8');

// L169: category name color fallback
js = js.replace(
  "color:${node.color || '#1c1917'}",
  "color:${node.color || 'var(--text)'}"
);

// L401/457: note card 背景 fallback
js = js.replace(
  "? hexToRgba(note.categoryColor, 0.08) : '#f4f4f5'",
  "? hexToRgba(note.categoryColor, 0.08) : 'var(--surface-alt)'"
);

// L402/458: note card color fallback
js = js.replace(
  "note.categoryColor || '#1c1917'",
  "note.categoryColor || 'var(--text)'"
);

// L530: 搜索高亮 mark
js = js.replace(
  '<mark style="background:#fef08a;padding:0 2px;border-radius:2px;">',
  '<mark style="background:#fef08a;color:#000;padding:0 2px;border-radius:2px;">'
);

// L720: ig-img onerror background
js = js.replace(
  "this.style.background='#f4f4f5'",
  "this.style.background='var(--surface-alt)'"
);

fs.writeFileSync('d:/XB/public-site/app.js', js, 'utf8');
console.log('✅ app.js 硬编码 fallback 已替换');

// ====== 3. 返回顶部修复 ======
// 之前可能只监听了 noteCards 滚动，但还有日历等区域
// 让我也监听 window scroll，并确保 backToTop 在任何滚动容器里都出现
// 这部分在后面改 initScrollFeatures

// ====== 4. 写 PWA 文件 ======
const sw = `const CACHE_NAME = 'xb-notes-v1';
const STATIC = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './data/notes.json',
  './data/categories.json',
  './data/areas.json',
  './data/daily-stats.json',
  './data/meta.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // 网络优先，失败回退缓存
  e.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(req, copy);
        });
        return res;
      })
      .catch(() => caches.match(req).then(r => r))
  );
});
`;
fs.writeFileSync('d:/XB/public-site/sw.js', sw, 'utf8');
console.log('✅ sw.js 写入');

const manifest = `{
  "name": "XB 笔记",
  "short_name": "XB",
  "description": "我的个人笔记库",
  "start_url": "./",
  "display": "standalone",
  "background_color": "#0a0a0b",
  "theme_color": "#654acb",
  "icons": [
    {
      "src": "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📝</text></svg>",
      "sizes": "100x100",
      "type": "image/svg+xml"
    }
  ]
}
`;
fs.writeFileSync('d:/XB/public-site/manifest.json', manifest, 'utf8');
console.log('✅ manifest.json 写入');

// ====== 5. 改 index.html: 加 manifest + 注册 sw ======
let h = fs.readFileSync('d:/XB/public-site/index.html', 'utf8');
if (!h.includes('manifest.json')) {
  h = h.replace(
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    `<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#654acb">
<link rel="manifest" href="manifest.json">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📝</text></svg">`
  );
}
// 在 </body> 前加 sw 注册
if (!h.includes('navigator.serviceWorker')) {
  h = h.replace('</body>', `
<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(console.error);
  });
}
</script>
</body>`);
}
fs.writeFileSync('d:/XB/public-site/index.html', h, 'utf8');
console.log('✅ index.html 加了 manifest + sw 注册');

console.log('\n=== 全部完成 ===');
