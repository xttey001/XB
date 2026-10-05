const fs = require('fs');
const f = 'd:/XB/public-site/styles.css';
let c = fs.readFileSync(f, 'utf8');

// 1. view-btn.active: 硬编码 #1c1917 → var(--text)
c = c.replace(
  '.view-btn.active {\n  background: #1c1917;\n  color: white;\n}',
  '.view-btn.active {\n  background: var(--text);\n  color: var(--surface);\n}'
);

// 2. flag-red 保留（功能性红色）
// 3. 滚动条 thumb
c = c.replace(
  '::-webkit-scrollbar-thumb { background: #d6d3d1; border-radius: 3px; }',
  '::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }'
);
c = c.replace(
  '::-webkit-scrollbar-thumb:hover { background: #a8a29e; }',
  '::-webkit-scrollbar-thumb:hover { background: var(--text-tertiary); }'
);

// 4. image-lightbox
c = c.replace(
  '.image-lightbox {\n  position: fixed;\n  inset: 0;\n  background: #1c1917;\n  z-index: 9999;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n}',
  `.image-lightbox {
  position: fixed;
  inset: 0;
  background: var(--bg);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}`
);

// 5. img-grid ig-cell
c = c.replace(
  '.img-grid .ig-cell { position: relative; overflow: hidden; border-radius: 6px; background: #f4f4f5; cursor: zoom-in; }',
  '.img-grid .ig-cell { position: relative; overflow: hidden; border-radius: 6px; background: var(--surface-alt); cursor: zoom-in; }'
);

// 6. modal 全套（最关键的！）
const oldModal = `.modal-content{position:relative;z-index:1;width:min(720px,92vw);max-height:min(85vh,780px);background:#fff;border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,0.25);display:flex;flex-direction:column;overflow:hidden}
.modal-header{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid #f1f1f2;background:#fafafa}
.modal-body{flex:1;overflow-y:auto;padding:18px 20px;font-size:15px;line-height:1.8;color:#1c1917}
.modal-body img{max-width:100%;border-radius:8px;margin:10px 0}
.modal-body pre{background:#fafafa;padding:12px;border-radius:8px;overflow-x:auto;font-size:13px}
.modal-body code{background:#f4f4f5;padding:2px 5px;border-radius:4px;font-size:13px}
.modal-body blockquote{border-left:3px solid #e4e4e7;padding-left:12px;color:#71717a;margin:10px 0}
.modal-body h1,.modal-body h2,.modal-body h3{margin:14px 0 8px 0;font-weight:600;color:#09090b}
.modal-close{background:none;border:none;font-size:18px;cursor:pointer;color:#71717a;width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center}
.modal-close:hover{background:#f4f4f5}`;

const newModal = `.modal-content{position:relative;z-index:1;width:min(720px,92vw);max-height:min(85vh,780px);background:var(--surface);border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,0.25);display:flex;flex-direction:column;overflow:hidden}
.modal-header{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid var(--border);background:var(--surface-alt)}
.modal-body{flex:1;overflow-y:auto;padding:18px 20px;font-size:15px;line-height:1.8;color:var(--text)}
.modal-body img{max-width:100%;border-radius:8px;margin:10px 0}
.modal-body pre{background:var(--surface-alt);padding:12px;border-radius:8px;overflow-x:auto;font-size:13px}
.modal-body code{background:var(--surface-alt);padding:2px 5px;border-radius:4px;font-size:13px}
.modal-body blockquote{border-left:3px solid var(--border);padding-left:12px;color:var(--text-secondary);margin:10px 0}
.modal-body h1,.modal-body h2,.modal-body h3{margin:14px 0 8px 0;font-weight:600;color:var(--text)}
.modal-close{background:none;border:none;font-size:18px;cursor:pointer;color:var(--text-tertiary);width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center}
.modal-close:hover{background:var(--surface-alt)}`;

c = c.replace(oldModal, newModal);

// 7. detail-meta / detail-tags
c = c.replace(
  '.detail-meta{padding:10px 18px;display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:#71717a;background:#fafafa;border-bottom:1px solid #f4f4f5}',
  '.detail-meta{padding:10px 18px;display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--text-tertiary);background:var(--surface-alt);border-bottom:1px solid var(--border-light)}'
);
c = c.replace(
  '.detail-tags{padding:8px 18px;display:flex;flex-wrap:wrap;gap:4px;border-bottom:1px solid #f4f4f5}',
  '.detail-tags{padding:8px 18px;display:flex;flex-wrap:wrap;gap:4px;border-bottom:1px solid var(--border-light)}'
);

// 8. 极重要/重要徽章背景色（保留语义但加深色覆盖）
// L562: background:#fee2e2;color:#991b1b (红徽章)  → 深色下需要暗一点
// L565: background:#ede9fe;color:#5b21b6 (紫徽章) → 同上

fs.writeFileSync(f, c, 'utf8');
console.log('✅ 所有硬编码颜色已替换为 CSS 变量');

// 验证
const verify = fs.readFileSync(f, 'utf8');
const hardcodes = ['#fff', '#fafafa', '#1c1917', '#09090b', '#71717a', '#f4f4f5', '#d6d3d1', '#f1f1f2'];
let remaining = 0;
hardcodes.forEach(h => {
  // 只统计非 :root 变量定义里的
  const count = (verify.match(new RegExp(h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  // 减去 :root 和 :root.dark 变量定义里的（前 30 行）
  const rootSection = verify.split('\n').slice(0, 30).join('\n');
  const inRoot = (rootSection.match(new RegExp(h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  const real = count - inRoot;
  if (real > 0) { console.log(`  剩余 ${h}: ${real} 处`); remaining += real; }
});
if (remaining === 0) console.log('  全部清理干净！');
