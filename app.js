/**
 * XB 静态站点 v2 - 完整逻辑
 * 纯原生 JS，零依赖
 */

let state = {
  notes: [],
  categories: [],
  areas: [],
  dailyStats: {},

  // 筛选状态
  view: 'all',             // all | aClass | reviewed | pinned | favorite | important | veryImportant | liked | reposted | category
  currentFilterId: null,   // 分类筛选时用
  searchQuery: '',
  dateMode: 'single',      // single | range
  dateSingle: null,        // '2026-10-05'
  dateRangeStart: null,
  dateRangeEnd: null,
  sortBy: 'updatedAt',     // updatedAt | createdAt

  // 日历
  calMonth: new Date(),

  // 展开的卡片
  expandedCards: new Set(),
};

// ===== 初始化 =====
async function init() {
  try {
    const [notes, categories, areas, dailyStats] = await Promise.all([
      fetch('data/notes.json').then(r => r.json()),
      fetch('data/categories.json').then(r => r.json()),
      fetch('data/areas.json').then(r => r.json()),
      fetch('data/daily-stats.json').then(r => r.json()).catch(() => ({})),
    ]);
    state.notes = notes;
    state.categories = categories;
    state.areas = areas;
    state.dailyStats = dailyStats;
  } catch (e) {
    document.body.innerHTML = `<div style="padding:60px;text-align:center;color:#991b1b;font-family:sans-serif;">
      数据加载失败<br><small style="color:#7c2d12">请通过 HTTP 服务器访问（不要用 file://）</small></div>`;
    throw e;
  }

  updateCounts();
  renderSidebar();
  renderCategories();
  renderCalendar();
  renderNoteList();
  bindEvents();
}

// ===== 计数 =====
function updateCounts() {
  const n = state.notes;
  document.getElementById('countAll').textContent = n.length;
  document.getElementById('countAClass').textContent = n.filter(x => x.tags.includes('A类买点')).length;
  document.getElementById('countReviewed').textContent = n.filter(x => x.reviewAt !== null).length;
  document.getElementById('countPinned').textContent = n.filter(x => x.pinnedGlobal).length;
  document.getElementById('countFavorite').textContent = n.filter(x => x.isFavorite).length;
  document.getElementById('countImportant').textContent = n.filter(x => x.importance === 'important').length;
  document.getElementById('countVImp').textContent = n.filter(x => x.importance === 'veryImportant').length;
  document.getElementById('countLiked').textContent = n.filter(x => x.hasLiked).length;
  document.getElementById('countReposted').textContent = n.filter(x => x.isReposted).length;
}

// ===== 侧边栏：快捷视图 =====
function renderSidebar() {
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === state.view && !state.currentFilterId);
  });
}

// ===== 分类树 =====
function renderCategories() {
  const tree = document.getElementById('categoriesTree');

  // 按 area 分组
  const grouped = {};
  for (const c of state.categories) {
    const key = c.areaName || '_root';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(c);
  }
  // parent 分组
  for (const arr of Object.values(grouped)) {
    arr.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (a.parentId !== b.parentId) return (a.parentId || '').localeCompare(b.parentId || '');
      return (a.order || 0) - (b.order || 0);
    });
  }

  let html = '';
  for (const [areaName, cats] of Object.entries(grouped)) {
    if (areaName !== '_root') {
      html += `<div class="area-group-title">${escapeHtml(areaName)}</div>`;
    }
    // 顶层 + 子分类递归渲染
    const topCats = cats.filter(c => !c.parentId);
    for (const c of topCats) {
      html += renderCatBtn(c, 0, cats);
    }
  }
  // 孤立子分类（parent 不在 state.categories 里）
  const orphans = state.categories.filter(c => c.parentId && !state.categories.find(p => p.id === c.parentId));
  if (orphans.length > 0) {
    html += `<div class="area-group-title">未分类</div>`;
    for (const c of orphans) {
      html += renderCatBtn(c, 1, []);
    }
  }
  tree.innerHTML = html;
}

function renderCatBtn(cat, depth, allCats) {
  const count = state.notes.filter(n => n.categoryId === cat.id).length;
  const isActive = state.view === 'category' && state.currentFilterId === cat.id;
  const isImg = (cat.icon || '').startsWith('/icons/');
  const iconHtml = cat.icon
    ? isImg ? `<span class="cat-icon"><img src="${cat.icon.replace(/^\//, '')}"></span>` : `<span class="cat-icon">${cat.icon}</span>`
    : `<span class="cat-icon-dot" style="background:${cat.color || '#654acb'}"></span>`;
  let html = `<button class="cat-btn ${isActive ? 'active' : ''} ${depth > 0 ? 'cat-child' : ''}" data-cat="${cat.id}">
    ${iconHtml}
    <span style="flex:1;color:${cat.color || '#1c1917'}">${escapeHtml(cat.name)}</span>
    ${count > 0 ? `<span class="cat-count">${count}</span>` : ''}
  </button>`;
  // 子分类
  const children = allCats.filter(c => c.parentId === cat.id);
  for (const child of children) {
    html += renderCatBtn(child, depth + 1, allCats);
  }
  return html;
}

// ===== 日历 =====
function renderCalendar() {
  const d = state.calMonth;
  const year = d.getFullYear();
  const month = d.getMonth();
  document.getElementById('calMonthLabel').textContent = `${year}年${month + 1}月`;

  // 计算日历网格（周一为一周开始）
  const firstDay = new Date(year, month, 1);
  const startWeekday = (firstDay.getDay() + 6) % 7; // 周一=0
  const startDate = new Date(year, month, 1 - startWeekday);
  const days = [];
  for (let i = 0; i < 42; i++) {
    const dt = new Date(startDate);
    dt.setDate(startDate.getDate() + i);
    days.push(dt);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const grid = document.getElementById('calGrid');
  grid.innerHTML = days.map(dt => {
    const dateStr = formatDate(dt);
    const isOther = dt.getMonth() !== month;
    const isToday = +dt === +today;
    const stat = state.dailyStats[dateStr] || { count: 0, important: 0, veryImportant: 0 };

    let cls = 'cal-day';
    if (isOther) cls += ' other-month';
    if (isToday) cls += ' today';

    // 单日选择
    if (state.dateMode === 'single') {
      if (state.dateSingle === dateStr) cls += ' selected';
    } else {
      // 范围模式
      if (state.dateRangeStart === dateStr) cls += ' range-start';
      else if (state.dateRangeEnd === dateStr) cls += ' range-end';
      else if (state.dateRangeStart && state.dateRangeEnd) {
        if (dateStr > state.dateRangeStart && dateStr < state.dateRangeEnd) cls += ' in-range';
      }
    }

    const dotsHtml = stat.count > 0 ? `<span class="dot">${stat.count}</span>` : '';
    const impDots = (stat.important + stat.veryImportant) > 0
      ? `<span class="important-dots">
          ${stat.important > 0 ? `<span style="background:#3B82F6"></span>` : ''}
          ${stat.veryImportant > 0 ? `<span style="background:#EC4899"></span>` : ''}
         </span>` : '';

    return `<button class="${cls}" data-date="${dateStr}" title="${stat.count > 0 ? `${stat.count} 条笔记` : ''}">
      ${dt.getDate()}${dotsHtml}${impDots}
    </button>`;
  }).join('');

  // 范围模式提示
  const hint = document.getElementById('calRangeHint');
  if (state.dateMode === 'range') {
    if (state.dateRangeStart && state.dateRangeEnd) {
      hint.textContent = `${state.dateRangeStart} ~ ${state.dateRangeEnd}`;
      hint.classList.remove('hidden');
    } else if (state.dateRangeStart) {
      hint.textContent = `已选开始 ${state.dateRangeStart}，请选结束日期`;
      hint.classList.remove('hidden');
    } else {
      hint.classList.add('hidden');
    }
  } else {
    hint.classList.add('hidden');
  }

  // 清除按钮
  const calClear = document.getElementById('calClear');
  calClear.classList.toggle('hidden', !(state.dateSingle || state.dateRangeStart));
}

function formatDate(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

// ===== 筛选 & 渲染笔记列表 =====
function getFilteredNotes() {
  let notes = state.notes;

  // 视图筛选
  switch (state.view) {
    case 'all': break;
    case 'aClass': notes = notes.filter(n => n.tags.includes('A类买点')); break;
    case 'reviewed': notes = notes.filter(n => n.reviewAt !== null); break;
    case 'pinned': notes = notes.filter(n => n.pinnedGlobal); break;
    case 'favorite': notes = notes.filter(n => n.isFavorite); break;
    case 'important': notes = notes.filter(n => n.importance === 'important'); break;
    case 'veryImportant': notes = notes.filter(n => n.importance === 'veryImportant'); break;
    case 'liked': notes = notes.filter(n => n.hasLiked); break;
    case 'reposted': notes = notes.filter(n => n.isReposted); break;
    case 'category': notes = notes.filter(n => n.categoryId === state.currentFilterId); break;
  }

  // 日期筛选（按 createdAt）
  if (state.dateMode === 'single' && state.dateSingle) {
    notes = notes.filter(n => n.createdAt.startsWith(state.dateSingle));
  } else if (state.dateMode === 'range' && state.dateRangeStart && state.dateRangeEnd) {
    notes = notes.filter(n => {
      const d = n.createdAt.slice(0, 10);
      return d >= state.dateRangeStart && d <= state.dateRangeEnd;
    });
  }

  // 搜索
  if (state.searchQuery.trim()) {
    const q = state.searchQuery.toLowerCase();
    notes = notes.filter(n => {
      const content = stripHtml(n.content).toLowerCase();
      const tags = n.tags.join(' ').toLowerCase();
      const cat = (n.categoryName || '').toLowerCase();
      return content.includes(q) || tags.includes(q) || cat.includes(q);
    });
  }

  // 排序
  notes.sort((a, b) => {
    const key = state.sortBy;
    // 置顶始终在最前
    if (a.pinnedGlobal !== b.pinnedGlobal) return a.pinnedGlobal ? -1 : 1;
    return new Date(b[key]) - new Date(a[key]);
  });

  return notes;
}

function renderNoteList() {
  const notes = getFilteredNotes();
  const cards = document.getElementById('noteCards');
  const empty = document.getElementById('listEmpty');

  document.getElementById('viewCount').textContent = `${notes.length} 条`;
  updateViewTitle();

  if (notes.length === 0) {
    cards.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  cards.innerHTML = notes.map(n => renderCard(n)).join('');

  // 绑定展开/收起
  cards.querySelectorAll('.expand-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      const cardId = btn.closest('.note-card').dataset.id;
      toggleCard(cardId);
    });
  });

  // 绑定图片 lightbox
  cards.querySelectorAll('.card-body img').forEach(img => {
    img.addEventListener('click', e => {
      e.stopPropagation();
      showLightbox(img.src);
    });
  });
}

function renderCard(note) {
  const isExpanded = state.expandedCards.has(note.id);
  const isCollapsible = note.content.length > 800 || stripHtml(note.content).split('\n').length > 12;
  const collapsedClass = isCollapsible && !isExpanded ? 'collapsed' : '';

  // 分类徽章
  let catBadge = '';
  if (note.categoryName) {
    const bg = note.categoryColor ? hexToRgba(note.categoryColor, 0.08) : '#f4f4f5';
    const color = note.categoryColor || '#1c1917';
    const isImg = (note.categoryIcon || '').startsWith('/icons/');
    const iconHtml = note.categoryIcon
      ? isImg ? `<span class="cat-badge-icon"><img src="assets${note.categoryIcon}"></span>` : `<span class="cat-badge-icon">${note.categoryIcon}</span>`
      : '';
    catBadge = `<span class="cat-badge" style="background:${bg};color:${color}">${iconHtml}${escapeHtml(note.categoryName)}</span>`;
  }

  // 重要性徽章
  let impBadge = '';
  if (note.importance === 'important') impBadge = `<span class="importance-badge important">🔥 重要</span>`;
  else if (note.importance === 'veryImportant') impBadge = `<span class="importance-badge veryImportant">💎 极重要</span>`;

  // 日期
  const dateStr = formatNiceDate(note.createdAt);

  // 标签
  let tagsHtml = '';
  if (note.tags && note.tags.length > 0) {
    tagsHtml = `<div class="tags-row">${note.tags.map(t => `<span class="tag-chip">#${escapeHtml(t)}</span>`).join('')}</div>`;
  }

  const pinHtml = note.pinnedGlobal ? `<span class="pin-badge">📌 置顶</span>` : '';

  const expandBtn = isCollapsible
    ? `<button class="expand-btn">${isExpanded ? '收起' : '查看全文'} ${isExpanded ? '↑' : '↓'}</button>`
    : '';

  return `<article class="note-card ${note.pinnedGlobal ? 'pinned' : ''}" data-id="${note.id}">
    ${pinHtml}
    <div class="card-header">
      <div class="card-header-left">${catBadge}${impBadge}</div>
      <span class="card-date">${dateStr}</span>
    </div>
    <div class="card-body ${collapsedClass}">${highlightSearch(note.content)}</div>
    <div class="card-footer">${tagsHtml}${expandBtn}</div>
  </article>`;
}

function toggleCard(id) {
  if (state.expandedCards.has(id)) state.expandedCards.delete(id);
  else state.expandedCards.add(id);
  renderNoteList();
}

function showLightbox(src) {
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.innerHTML = `<img src="${src}">`;
  lb.addEventListener('click', () => lb.remove());
  document.body.appendChild(lb);
}

function updateViewTitle() {
  const h = document.getElementById('viewTitle');
  const titles = {
    all: '全部笔记',
    aClass: 'A类买点',
    reviewed: '回顾',
    pinned: '置顶',
    favorite: '收藏',
    important: '重要',
    veryImportant: '极重要',
    liked: '点赞',
    reposted: '转发',
  };
  if (state.view === 'category') {
    const cat = state.categories.find(c => c.id === state.currentFilterId);
    h.innerHTML = `${cat ? cat.name : '分类'} <span class="view-count"></span>`;
    // 同步 viewCount
    setTimeout(() => {
      const countEl = document.getElementById('viewCount');
      h.querySelector('.view-count').textContent = countEl ? countEl.textContent : '';
    }, 0);
  } else {
    h.innerHTML = `${titles[state.view] || '笔记'} <span class="view-count"></span>`;
  }
}

// ===== 事件绑定 =====
function bindEvents() {
  // 快捷视图
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.view = btn.dataset.view;
      state.currentFilterId = null;
      renderSidebar();
      renderNoteList();
    });
  });

  // 分类
  document.getElementById('categoriesTree').addEventListener('click', e => {
    const btn = e.target.closest('.cat-btn');
    if (!btn) return;
    state.view = 'category';
    state.currentFilterId = btn.dataset.cat;
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderSidebar();
    renderNoteList();
  });

  // 日历：模式切换
  document.querySelectorAll('.cal-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cal-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.dateMode = btn.dataset.mode;
      if (state.dateMode === 'single') {
        state.dateRangeStart = null;
        state.dateRangeEnd = null;
      } else {
        state.dateSingle = null;
      }
      renderCalendar();
      renderNoteList();
    });
  });

  // 日历：月份导航
  document.getElementById('calPrevMonth').addEventListener('click', () => {
    const m = new Date(state.calMonth);
    m.setMonth(m.getMonth() - 1);
    state.calMonth = m;
    renderCalendar();
  });
  document.getElementById('calNextMonth').addEventListener('click', () => {
    const m = new Date(state.calMonth);
    m.setMonth(m.getMonth() + 1);
    state.calMonth = m;
    renderCalendar();
  });

  // 日历：日期点击（事件委托）
  document.getElementById('calGrid').addEventListener('click', e => {
    const btn = e.target.closest('.cal-day');
    if (!btn) return;
    const dateStr = btn.dataset.date;
    handleDateClick(dateStr);
  });

  // 日历清除
  document.getElementById('calClear').addEventListener('click', () => {
    state.dateSingle = null;
    state.dateRangeStart = null;
    state.dateRangeEnd = null;
    renderCalendar();
    renderNoteList();
  });

  // 搜索
  const searchInput = document.getElementById('searchInput');
  const clearSearch = document.getElementById('clearSearch');
  let searchTimer;
  searchInput.addEventListener('input', e => {
    clearSearch.classList.toggle('hidden', !e.target.value);
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.searchQuery = e.target.value;
      renderNoteList();
    }, 150);
  });
  clearSearch.addEventListener('click', () => {
    searchInput.value = '';
    clearSearch.classList.add('hidden');
    state.searchQuery = '';
    renderNoteList();
    searchInput.focus();
  });

  // 排序
  document.getElementById('sortUpdated').addEventListener('click', () => setSort('updatedAt'));
  document.getElementById('sortCreated').addEventListener('click', () => setSort('createdAt'));

  // 移动端
  document.getElementById('mobileMenuBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('hidden');
  });
  document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);

  // ESC 关闭日历/移动端
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSidebar();
  });
}

function handleDateClick(dateStr) {
  if (state.dateMode === 'single') {
    if (state.dateSingle === dateStr) {
      state.dateSingle = null;
    } else {
      state.dateSingle = dateStr;
    }
  } else {
    // 范围模式
    if (!state.dateRangeStart || (state.dateRangeStart && state.dateRangeEnd)) {
      // 开始新范围
      state.dateRangeStart = dateStr;
      state.dateRangeEnd = null;
    } else {
      // 完成范围
      let start = state.dateRangeStart;
      let end = dateStr;
      if (start > end) [start, end] = [end, start];
      state.dateRangeStart = start;
      state.dateRangeEnd = end;
    }
  }
  renderCalendar();
  renderNoteList();
}

function setSort(key) {
  state.sortBy = key;
  document.getElementById('sortUpdated').classList.toggle('active', key === 'updatedAt');
  document.getElementById('sortCreated').classList.toggle('active', key === 'createdAt');
  renderNoteList();
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.add('hidden');
}

// ===== 工具函数 =====
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function stripHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || '';
}

function formatNiceDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) {
    return `今天 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  } else if (diffDays === 1) {
    return `昨天`;
  } else if (diffDays < 7) {
    return `${diffDays}天前`;
  } else {
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }
}

function highlightSearch(html) {
  if (!state.searchQuery.trim()) return html;
  const q = state.searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // 只对纯文本节点做高亮（避免破坏 HTML 标签）
  try {
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
    const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (node.nodeValue && new RegExp(q, 'i').test(node.nodeValue)) {
        const div = document.createElement('div');
        div.innerHTML = node.nodeValue.replace(new RegExp(`(${q})`, 'gi'), '<mark style="background:#fef08a;padding:0 2px;border-radius:2px;">$1</mark>');
        node.replaceWith(...div.childNodes);
      }
    }
    return doc.body.innerHTML;
  } catch {
    return html;
  }
}

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// 启动
init().catch(console.error);
