/**
 * XB 静态站点 v2 - 完整逻辑（修复版）
 * 修复:
 *  1. highlightSearch 用 TreeWalker 操作 DOMParser 产物 → crash
 *  2. 分类排序 order 方向反了（原应用降序 b-a，我写成 a-b）
 *  3. 分类树按 parentId 递归嵌套（buildTree）
 *  4. updateViewTitle 用 textContent 干掉 viewCount 子元素
 *  5. 点击卡片 → 详情弹窗
 */

let state = {
  notes: [],
  categories: [],
  areas: [],
  dailyStats: {},

  view: 'all',
  currentFilterId: null,
  searchQuery: '',
  dateMode: 'single',
  dateSingle: null,
  dateRangeStart: null,
  dateRangeEnd: null,
  sortBy: 'updatedAt',

  calMonth: new Date(),
  expandedCards: new Set(),
  selectedNoteId: null,
};

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
    console.error(e);
    return;
  }

  updateCounts();
  renderSidebar();
  renderCategories();
  renderCalendar();
  renderNoteList();
  bindEvents();
}

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

function renderSidebar() {
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === state.view && !state.currentFilterId);
  });
}

function buildTree(flat) {
  const map = new Map();
  flat.forEach(c => map.set(c.id, { ...c, children: [] }));
  const roots = [];
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sort = (a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.order !== b.order) return (b.order || 0) - (a.order || 0);
    return (a.createdAt || '').localeCompare(b.createdAt || '');
  };
  roots.sort(sort);
  for (const node of map.values()) node.children.sort(sort);
  return roots;
}

function renderCategories() {
  const tree = document.getElementById('categoriesTree');
  const treeData = buildTree(state.categories);

  let html = '';
  const areas = {};
  for (const root of treeData) {
    const key = root.areaName || '_root';
    if (!areas[key]) areas[key] = [];
    areas[key].push(root);
  }

  for (const [areaName, roots] of Object.entries(areas)) {
    if (areaName !== '_root') {
      html += `<div class="area-group-title">${escapeHtml(areaName)}</div>`;
    }
    for (const root of roots) {
      html += renderCatNode(root, 0);
    }
  }

  tree.innerHTML = html;
}

function renderCatNode(node, depth) {
  const count = state.notes.filter(n => n.categoryId === node.id).length;
  const isActive = state.view === 'category' && state.currentFilterId === node.id;
  const childrenCount = countChildrenNotes(node.id);

  let iconHtml;
  const isImg = (node.icon || '').startsWith('/icons/');
  if (node.icon) {
    iconHtml = isImg
      ? `<span class="cat-icon"><img src="assets${node.icon.replace(/^\//, '')}" onerror="this.style.display='none'"></span>`
      : `<span class="cat-icon">${escapeHtml(node.icon)}</span>`;
  } else {
    iconHtml = `<span class="cat-icon-dot" style="background:${node.color || '#654acb'}"></span>`;
  }

  let html = `<button class="cat-btn ${isActive ? 'active' : ''} ${depth > 0 ? 'cat-child' : ''}" data-cat="${node.id}">
    ${iconHtml}
    <span style="flex:1;color:${node.color || '#1c1917'}">${escapeHtml(node.name)}</span>
    ${count > 0 || childrenCount > 0
      ? `<span class="cat-count">${count > 0 && childrenCount > 0 ? count + '+' + childrenCount : count || childrenCount}</span>`
      : ''}
  </button>`;
  for (const child of node.children) {
    html += renderCatNode(child, depth + 1);
  }
  return html;
}

function countChildrenNotes(parentId) {
  let count = 0;
  const queue = [parentId];
  while (queue.length) {
    const cur = queue.shift();
    const children = state.categories.filter(c => c.parentId === cur);
    queue.push(...children.map(c => c.id));
    count += state.notes.filter(n => n.categoryId === cur).length;
  }
  return count;
}

function renderCalendar() {
  const d = state.calMonth;
  const year = d.getFullYear();
  const month = d.getMonth();
  document.getElementById('calMonthLabel').textContent = `${year}年${month + 1}月`;

  const firstDay = new Date(year, month, 1);
  const startWeekday = (firstDay.getDay() + 6) % 7;
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
    if (state.dateMode === 'single') {
      if (state.dateSingle === dateStr) cls += ' selected';
    } else {
      if (state.dateRangeStart === dateStr) cls += ' range-start';
      else if (state.dateRangeEnd === dateStr) cls += ' range-end';
      else if (state.dateRangeStart && state.dateRangeEnd
               && dateStr > state.dateRangeStart && dateStr < state.dateRangeEnd) cls += ' in-range';
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

  const calClear = document.getElementById('calClear');
  calClear.classList.toggle('hidden', !(state.dateSingle || state.dateRangeStart));
}

function formatDate(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function getFilteredNotes() {
  let notes = state.notes;

  try {
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
      case 'category':
        const idsToInclude = collectCategoryIds(state.currentFilterId);
        notes = notes.filter(n => idsToInclude.has(n.categoryId));
        break;
    }

    if (state.dateMode === 'single' && state.dateSingle) {
      notes = notes.filter(n => (n.createdAt || '').startsWith(state.dateSingle));
    } else if (state.dateMode === 'range' && state.dateRangeStart && state.dateRangeEnd) {
      notes = notes.filter(n => {
        const d = (n.createdAt || '').slice(0, 10);
        return d >= state.dateRangeStart && d <= state.dateRangeEnd;
      });
    }

    if (state.searchQuery.trim()) {
      const q = state.searchQuery.toLowerCase();
      notes = notes.filter(n => {
        const content = stripHtml(n.content || '').toLowerCase();
        const tags = (n.tags || []).join(' ').toLowerCase();
        const cat = (n.categoryName || '').toLowerCase();
        return content.includes(q) || tags.includes(q) || cat.includes(q);
      });
    }
  } catch (e) {
    console.error('筛选出错:', e);
  }

  notes.sort((a, b) => {
    if (a.pinnedGlobal !== b.pinnedGlobal) return a.pinnedGlobal ? -1 : 1;
    const key = state.sortBy;
    return new Date(b[key] || 0) - new Date(a[key] || 0);
  });

  return notes;
}

function collectCategoryIds(rootId) {
  if (!rootId) return new Set();
  const ids = new Set([rootId]);
  const queue = [rootId];
  while (queue.length) {
    const cur = queue.shift();
    const children = state.categories.filter(c => c.parentId === cur);
    for (const c of children) {
      ids.add(c.id);
      queue.push(c.id);
    }
  }
  return ids;
}

function renderNoteList() {
  try {
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

    cards.querySelectorAll('.note-card').forEach(el => {
      el.addEventListener('click', e => {
        if (e.target.closest('button, a, img')) return;
        openDetail(el.dataset.id);
      });
    });

    cards.querySelectorAll('.expand-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        toggleCard(btn.closest('.note-card').dataset.id);
      });
    });

    cards.querySelectorAll('.card-body img').forEach(img => {
      img.addEventListener('click', e => {
        e.stopPropagation();
        showLightbox(img.src);
      });
    });
  } catch (e) {
    console.error('渲染笔记列表出错:', e);
    const cards = document.getElementById('noteCards');
    if (cards) cards.innerHTML = `<div class="list-empty">渲染出错: ${e.message}</div>`;
  }
}

function renderCard(note) {
  const isExpanded = state.expandedCards.has(note.id);
  const content = stripHtml(note.content || '');
  const isCollapsible = (note.content || '').length > 800 || content.split('\n').length > 12;
  const collapsedClass = isCollapsible && !isExpanded ? 'collapsed' : '';

  let catBadge = '';
  if (note.categoryName) {
    const bg = note.categoryColor ? hexToRgba(note.categoryColor, 0.08) : '#f4f4f5';
    const color = note.categoryColor || '#1c1917';
    catBadge = `<span class="cat-badge" style="background:${bg};color:${color}">${escapeHtml(note.categoryName)}</span>`;
  }

  let impBadge = '';
  if (note.importance === 'important') impBadge = `<span class="importance-badge important">🔥 重要</span>`;
  else if (note.importance === 'veryImportant') impBadge = `<span class="importance-badge veryImportant">💎 极重要</span>`;

  const dateStr = formatNiceDate(note.createdAt);

  let tagsHtml = '';
  if (note.tags && note.tags.length > 0) {
    tagsHtml = `<div class="tags-row">${note.tags.map(t => `<span class="tag-chip">#${escapeHtml(t)}</span>`).join('')}</div>`;
  }

  const pinHtml = note.pinnedGlobal ? `<span class="pin-badge">📌 置顶</span>` : '';

  const expandBtn = isCollapsible
    ? `<button class="expand-btn">${isExpanded ? '收起' : '查看全文'} ${isExpanded ? '↑' : '↓'}</button>`
    : '';

  const bodyHtml = safeHighlightSearch(note.content || '');

  return `<article class="note-card ${note.pinnedGlobal ? 'pinned' : ''}" data-id="${note.id}">
    ${pinHtml}
    <div class="card-header">
      <div class="card-header-left">${catBadge}${impBadge}</div>
      <span class="card-date">${dateStr}</span>
    </div>
    <div class="card-body ${collapsedClass}">${bodyHtml}</div>
    <div class="card-footer">${tagsHtml}${expandBtn}</div>
  </article>`;
}

function toggleCard(id) {
  if (state.expandedCards.has(id)) state.expandedCards.delete(id);
  else state.expandedCards.add(id);
  renderNoteList();
}

function openDetail(noteId) {
  const note = state.notes.find(n => n.id === noteId);
  if (!note) return;
  state.selectedNoteId = noteId;

  let catBadge = '';
  if (note.categoryName) {
    const bg = note.categoryColor ? hexToRgba(note.categoryColor, 0.08) : '#f4f4f5';
    catBadge = `<span class="cat-badge" style="background:${bg};color:${note.categoryColor || '#1c1917'}">${escapeHtml(note.categoryName)}</span>`;
  }
  let impBadge = '';
  if (note.importance === 'important') impBadge = `<span class="importance-badge important">🔥 重要</span>`;
  else if (note.importance === 'veryImportant') impBadge = `<span class="importance-badge veryImportant">💎 极重要</span>`;

  const tagsHtml = (note.tags || []).length > 0
    ? `<div class="detail-tags">${note.tags.map(t => `<span class="tag-chip">#${escapeHtml(t)}</span>`).join('')}</div>`
    : '';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-backdrop" onclick="this.parentElement.remove()"></div>
    <div class="modal-content">
      <div class="modal-header">
        <div class="modal-header-left">${catBadge}${impBadge}</div>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div class="detail-meta">
        <span>🕐 创建 ${formatNiceDate(note.createdAt)}</span>
        <span>🔄 更新 ${formatNiceDate(note.updatedAt)}</span>
        ${note.isFavorite ? '<span>⭐ 收藏</span>' : ''}
        ${note.pinnedGlobal ? '<span>📌 置顶</span>' : ''}
      </div>
      ${tagsHtml}
      <div class="modal-body card-body">${safeHighlightSearch(note.content || '')}</div>
    </div>
  `;
  document.body.appendChild(overlay);

  const onKey = e => {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
    }
  };
  document.addEventListener('keydown', onKey);

  overlay.querySelectorAll('img').forEach(img => {
    img.addEventListener('click', e => {
      e.stopPropagation();
      showLightbox(img.src);
    });
  });
}

function showLightbox(src) {
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.innerHTML = `<img src="${src}">`;
  lb.addEventListener('click', () => lb.remove());
  document.body.appendChild(lb);
}

// 安全版搜索高亮 - 纯正则替换 HTML 字符串，不操作 DOM
function safeHighlightSearch(html) {
  if (!state.searchQuery.trim()) return html;
  const q = state.searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try {
    return html.replace(
      new RegExp(`(>[^<]*)(${q})([^<]*<)`, 'gi'),
      (match, before, hit, after) => `${before}<mark style="background:#fef08a;padding:0 2px;border-radius:2px;">${hit}</mark>${after}`
    );
  } catch {
    return html;
  }
}

function updateViewTitle() {
  const h = document.getElementById('viewTitle');
  if (!h) return;
  const titles = {
    all: '全部笔记', aClass: 'A类买点', reviewed: '回顾', pinned: '置顶',
    favorite: '收藏', important: '重要', veryImportant: '极重要',
    liked: '点赞', reposted: '转发',
  };
  const label = state.view === 'category'
    ? (state.categories.find(c => c.id === state.currentFilterId)?.name || '分类')
    : (titles[state.view] || '笔记');
  h.innerHTML = `${escapeHtml(label)} <span class="view-count" id="viewCount"></span>`;
}

function bindEvents() {
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.view = btn.dataset.view;
      state.currentFilterId = null;
      renderSidebar();
      renderNoteList();
    });
  });

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

  document.querySelectorAll('.cal-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cal-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.dateMode = btn.dataset.mode;
      if (state.dateMode === 'single') { state.dateRangeStart = null; state.dateRangeEnd = null; }
      else { state.dateSingle = null; }
      renderCalendar();
      renderNoteList();
    });
  });

  document.getElementById('calPrevMonth').addEventListener('click', () => {
    const m = new Date(state.calMonth); m.setMonth(m.getMonth() - 1); state.calMonth = m; renderCalendar();
  });
  document.getElementById('calNextMonth').addEventListener('click', () => {
    const m = new Date(state.calMonth); m.setMonth(m.getMonth() + 1); state.calMonth = m; renderCalendar();
  });

  document.getElementById('calGrid').addEventListener('click', e => {
    const btn = e.target.closest('.cal-day');
    if (!btn) return;
    handleDateClick(btn.dataset.date);
  });

  document.getElementById('calClear').addEventListener('click', () => {
    state.dateSingle = null; state.dateRangeStart = null; state.dateRangeEnd = null;
    renderCalendar(); renderNoteList();
  });

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
    searchInput.value = ''; clearSearch.classList.add('hidden');
    state.searchQuery = ''; renderNoteList(); searchInput.focus();
  });

  document.getElementById('sortUpdated').addEventListener('click', () => setSort('updatedAt'));
  document.getElementById('sortCreated').addEventListener('click', () => setSort('createdAt'));

  document.getElementById('mobileMenuBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('hidden');
  });
  document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSidebar(); });
}

function handleDateClick(dateStr) {
  if (state.dateMode === 'single') {
    state.dateSingle = state.dateSingle === dateStr ? null : dateStr;
  } else {
    if (!state.dateRangeStart || (state.dateRangeStart && state.dateRangeEnd)) {
      state.dateRangeStart = dateStr; state.dateRangeEnd = null;
    } else {
      let start = state.dateRangeStart, end = dateStr;
      if (start > end) [start, end] = [end, start];
      state.dateRangeStart = start; state.dateRangeEnd = end;
    }
  }
  renderCalendar(); renderNoteList();
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

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function stripHtml(html) {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || '';
}

function formatNiceDate(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return `今天 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  if (diffDays === 1) return `昨天`;
  if (diffDays < 7) return `${diffDays}天前`;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

init().catch(e => console.error('Init failed:', e));
