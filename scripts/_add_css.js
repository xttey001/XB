const fs = require('fs');
const p = 'd:/XB/public-site/styles.css';
let c = fs.readFileSync(p, 'utf8');

const darkVars = `/* ===== 深色模式覆盖 ===== */
:root.dark {
  --bg: #0a0a0b;
  --surface: #17171a;
  --surface-alt: #1f1f23;
  --border: #27272a;
  --border-light: #18181b;
  --text: #fafafa;
  --text-secondary: #a1a1aa;
  --text-tertiary: #71717a;
  --primary: #8b7cf6;
  --primary-light: #2a2550;
  --primary-bg: #1e1a3d;
  --accent: #8b7cf6;
  --card-shadow: 0 1px 3px rgba(0,0,0,.5);
}

/* ===== 滚动进度条 ===== */
.scroll-progress {
  position: fixed;
  top: 0;
  left: 0;
  height: 3px;
  background: var(--primary);
  z-index: 10000;
  width: 0;
  transition: width .1s ease-out;
  box-shadow: 0 0 8px rgba(101, 74, 203, .5);
}

/* ===== 返回顶部按钮 ===== */
.back-to-top {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--primary);
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(101, 74, 203, .4);
  opacity: 0;
  visibility: hidden;
  transform: translateY(20px);
  transition: all .2s ease;
  z-index: 9999;
  font-size: 20px;
}
.back-to-top.visible {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}
.back-to-top:active { transform: scale(.9); }

/* ===== 深色模式切换按钮 ===== */
.theme-toggle {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  color: var(--text-tertiary);
  font-size: 16px;
  transition: all .15s;
  line-height: 1;
}
.theme-toggle:hover { color: var(--text); background: var(--surface-alt); }

/* ===== 阅读时间徽章 ===== */
.read-time {
  font-size: 11px;
  color: var(--text-tertiary);
  margin-left: 4px;
}

`;

// 在 :root { 前面插入深色变量
if (!c.includes(':root.dark')) {
  c = c.replace(/^\s*\/\*\s*=====\s*基础/, darkVars + '/* ===== 基础');
  fs.writeFileSync(p, c, 'utf8');
  console.log('✅ CSS 深色/进度条/返回顶部/阅读时间 全部添加');
} else {
  console.log('⚠️ 已经有 :root.dark 了，跳过');
}
