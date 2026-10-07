/**
 * XB 静态站点 v2 - 完整逻辑（修复版）
 * Bug 修复：
 *  1. highlightSearch 用 TreeWalker 操作 DOMParser 产物 → crash
 *  2. 分类排序 order 方向反了（原应用降序 b-a，我写成 a-b）
 *  3. 分类树按 areaName 分组导致 parentId 嵌套丢失 → 改用 buildTree
 *  4. 点击卡片没有详情弹窗（原应用点卡片进详情页）
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
  orderDir: 'desc', // desc=最新在前, asc=最早在前

  calMonth: new Date(),
  expandedCards: new Set(),
  expandedCats: new Set(), // 哪些父分类是展开的（默认空=全收起）
  selectedNoteId: null,
};

// ===== 初始化 =====
async function init() {
  try {
    const [notes, categories, areas, dailyStats] = await Promise.all([
      fetch('data/notes.json?v=1791366128002').then(r => r.json()),
      fetch('data/categories.json?v=1791366128002').then(r => r.json()),
      fetch('data/areas.json?v=1791366128002').then(r => r.json()),
      fetch('data/daily-stats.json?v=1791366128002').then(r => r.json()).catch(() => ({})),
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

  // 🔥 Fuse.js 索引在 init 后立即构建一次（缓存复用，不在 filterNotes 里懒构建）
  window._fuseIndex = new Fuse(state.notes.map(n => ({
    id: n.id,
    title: (n.title || '').trim(),
    summary: (n.summary || '').trim(),
    content: stripHtml(n.content || '').substring(0, 3000),
    tags: (n.tags || []).join(' '),
    category: n.categoryName || ''
  })), {
    keys: ['title', 'summary', 'content', 'tags', 'category'],
    threshold: 0.4,
    ignoreLocation: true,
    minMatchCharLength: 2
  });

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

// ===== 快捷视图 =====
function renderSidebar() {
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === state.view && !state.currentFilterId);
  });
}

// ===== buildTree 扁平化分类 → 两层树（跟原应用一样的逻辑）=====
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
    if (a.order !== b.order) return (b.order || 0) - (a.order || 0);  // 降序！
    return (a.createdAt || '').localeCompare(b.createdAt || '');
  };
  roots.sort(sort);
  for (const node of map.values()) node.children.sort(sort);
  return roots;
}

// ===== 分类树渲染（按 parentId 递归，带 areaName 分组标题）=====
function renderCategories() {
  const tree = document.getElementById('categoriesTree');
  const treeData = buildTree(state.categories);

  let html = '';
  // 先按 areaName 分组 roots
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

  // 没 areaName 的孤立分类
  const orphans = state.categories.filter(c => !c.areaName && !c.parentId);
  if (orphans.length > 0 && areas['_root']?.length === orphans.length) {
    // 已经渲染过了
  }

  tree.innerHTML = html;
}

function renderCatNode(node, depth) {
  // 直接挂在这个分类下的笔记数（不是所有子孙笔记数！）
  const directNotes = state.notes.filter(n => n.categoryId === node.id).length;
  const childrenCount = node.children.length; // 子分类数量（不是笔记数！）
  const hasChildren = childrenCount > 0;
  const isExpanded = state.expandedCats.has(node.id);
  const isActive = state.view === 'category' && state.currentFilterId === node.id;

  let iconHtml;
  const isImg = (node.icon || '').startsWith('/icons/');
  if (node.icon) {
    iconHtml = isImg
      ? `<span class="cat-icon"><img src="assets/${node.icon.replace(/^\//, '')}" onerror="this.style.display='none'"></span>`
      : `<span class="cat-icon">${escapeHtml(node.icon)}</span>`;
  } else {
    iconHtml = `<span class="cat-icon-dot" style="background:${node.color || '#654acb'}"></span>`;
  }

  // 数字显示逻辑：跟原版一致
  let countLabel = '';
  if (directNotes > 0 && childrenCount > 0) countLabel = `${directNotes}+${childrenCount}`;
  else if (directNotes > 0) countLabel = `${directNotes}`;
  else if (childrenCount > 0) countLabel = `${childrenCount}`;

  const chevron = hasChildren
    ? `<button class="cat-chevron" data-chevron="${node.id}" aria-label="展开/折叠">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="${isExpanded ? 'rotated' : ''}"><polyline points="9 18 15 12 9 6"/></svg>
       </button>`
    : `<span class="cat-chevron-placeholder"></span>`;

  let html = `<div class="cat-node" data-cat="${node.id}">
    <button class="cat-btn ${isActive ? 'active' : ''} ${depth > 0 ? 'cat-child' : ''}" style="padding-left: ${depth * 14}px">
      ${chevron}
      ${iconHtml}
      <span style="flex:1;color:${node.color || 'var(--text)'}">${escapeHtml(node.name)}</span>
      ${countLabel ? `<span class="cat-count">${countLabel}</span>` : ''}
    </button>`;

  if (hasChildren && isExpanded) {
    html += `<div class="cat-children">`;
    for (const child of node.children) {
      html += renderCatNode(child, depth + 1);
    }
    html += `</div>`;
  }
  html += `</div>`;
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

// ===== 日历 =====
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

// ===== 筛选逻辑（加 try-catch 防 crash）=====
function getFilteredNotes() {
  let notes = state.notes;

  try {
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
      case 'category':
        // 递归包含子分类
        const idsToInclude = collectCategoryIds(state.currentFilterId);
        notes = notes.filter(n => idsToInclude.has(n.categoryId));
        break;
    }

    // 日期筛选
    if (state.dateMode === 'single' && state.dateSingle) {
      notes = notes.filter(n => (n.createdAt || '').startsWith(state.dateSingle));
    } else if (state.dateMode === 'range' && state.dateRangeStart && state.dateRangeEnd) {
      notes = notes.filter(n => {
        const d = (n.createdAt || '').slice(0, 10);
        return d >= state.dateRangeStart && d <= state.dateRangeEnd;
      });
    }

    // 搜索（Fuse.js fuzzy — 用 init 时构建好的全局索引）
    if (state.searchQuery.trim() && window._fuseIndex) {
      const results = window._fuseIndex.search(state.searchQuery);
      const matchedIds = new Set(results.map(r => r.item.id));
      notes = notes.filter(n => matchedIds.has(n.id));
      // 匹配度高的排前面
      notes.sort((a, b) => {
        const ra = results.find(r => r.item.id === a.id)?.score ?? 1;
        const rb = results.find(r => r.item.id === b.id)?.score ?? 1;
        return ra - rb;
      });
    }
  } catch (e) {
    console.error('筛选出错:', e);
  }

  // 排序
  notes.sort((a, b) => {
    if (a.pinnedGlobal !== b.pinnedGlobal) return a.pinnedGlobal ? -1 : 1;
    const key = state.sortBy;
    const delta = new Date(b[key] || 0) - new Date(a[key] || 0);
    return state.orderDir === 'asc' ? -delta : delta;
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

// ===== 渲染 =====
function renderNoteList() {
  try {
    const notes = getFilteredNotes();
    const cards = document.getElementById('noteCards');
    const empty = document.getElementById('listEmpty');
    const viewCountEl = document.getElementById('viewCount');
    if (viewCountEl) viewCountEl.textContent = `${notes.length} 条`;
    updateViewTitle();

    if (notes.length === 0) {
      cards.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    cards.innerHTML = notes.map(n => renderCard(n)).join('');

    // 绑定卡片点击 → 打开详情
    cards.querySelectorAll('.note-card').forEach(el => {
      el.addEventListener('click', e => {
        if (e.target.closest('button, a, img')) return;
        openDetail(el.dataset.id);
      });
    });

    // 绑定展开
    cards.querySelectorAll('.expand-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
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
  } catch (e) {
    console.error('渲染笔记列表出错:', e);
    document.getElementById('noteCards').innerHTML = `<div class="list-empty">渲染出错: ${e.message}</div>`;
  }
}

function renderCard(note) {
  const isExpanded = state.expandedCards.has(note.id);
  const content = stripHtml(note.content || '');
  const isCollapsible = (note.content || '').length > 800 || content.split('\n').length > 12;
  const collapsedClass = isCollapsible && !isExpanded ? 'collapsed' : '';

  let catBadge = '';
  if (note.categoryName) {
    const bg = note.categoryColor ? hexToRgba(note.categoryColor, 0.08) : 'var(--surface-alt)';
    const color = note.categoryColor || 'var(--text)';
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

  // 修 content 里可能有的 img src + 搜索高亮
  const bodyHtml = safeHighlightSearch(fixNoteLinksInHtml(fixImgSrcInHtml(note.content || '')));

  // 图片网格（images 字段）
  const imagesHtml = note.images && note.images.length > 0
    ? `<div class="card-images" onclick="event.stopPropagation()">${renderImagesGrid(note.images)}</div>`
    : '';

  return `<article class="note-card ${note.pinnedGlobal ? 'pinned' : ''}" data-id="${note.id}">
    ${pinHtml}
    <div class="card-header">
      <div class="card-header-left">${catBadge}${impBadge}</div>
      <span class="card-date">${dateStr}</span>
    </div>
    <div class="card-body ${collapsedClass}">${bodyHtml}</div>
    ${imagesHtml}
    <div class="card-footer">${tagsHtml}${expandBtn}</div>
  </article>`;
}

function toggleCard(id) {
  if (state.expandedCards.has(id)) state.expandedCards.delete(id);
  else state.expandedCards.add(id);
  renderNoteList();
}

// ===== 详情弹窗 =====
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

  // 图片网格
  const imagesHtml = note.images && note.images.length > 0
    ? `<div class="card-images">${renderImagesGrid(note.images)}</div>`
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
      <div class="modal-body card-body">${safeHighlightSearch(fixNoteLinksInHtml(fixImgSrcInHtml(note.content || '')))}</div>
      ${imagesHtml}
    </div>
  `;
  document.body.appendChild(overlay);

  // ESC 关闭
  const onKey = e => {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
    }
  };
  document.addEventListener('keydown', onKey);

  // 图片 lightbox
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

// ===== 搜索高亮（安全版）=====
// 直接对 HTML 字符串做正则替换，不操作 DOM，零 crash 风险
function safeHighlightSearch(html) {
  if (!state.searchQuery.trim()) return html;
  const q = state.searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try {
    // 用正则替换，但跳过 HTML 标签内部
    return html.replace(
      new RegExp(`(>[^<]*)(${q})([^<]*<)`, 'gi'),
      (match, before, hit, after) => `${before}<mark style="background:#fef08a;color:#000;padding:0 2px;border-radius:2px;">${hit}</mark>${after}`
    );
  } catch {
    return html;
  }
}

function updateViewTitle() {
  const h = document.getElementById('viewTitle');
  const titles = {
    all: '全部笔记', aClass: 'A类买点', reviewed: '回顾', pinned: '置顶',
    favorite: '收藏', important: '重要', veryImportant: '极重要',
    liked: '点赞', reposted: '转发',
  };
  if (state.view === 'category') {
    const cat = state.categories.find(c => c.id === state.currentFilterId);
    h.textContent = cat ? cat.name : '分类';
  } else {
    h.textContent = titles[state.view] || '笔记';
  }
}

// ===== 事件绑定 =====
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
    // 箭头点击 → 只切换折叠，不选分类
    const chevron = e.target.closest('[data-chevron]');
    if (chevron) {
      e.stopPropagation();
      const id = chevron.dataset.chevron;
      if (state.expandedCats.has(id)) state.expandedCats.delete(id);
      else state.expandedCats.add(id);
      renderCategories();
      return;
    }
    // 分类按钮点击
    const btn = e.target.closest('.cat-btn');
    if (!btn) return;
    const catId = btn.closest('.cat-node').dataset.cat;
    state.view = 'category';
    state.currentFilterId = catId;
    // 自动展开选中分类的父链（跟原版一致）
    let cur = state.categories.find(c => c.id === catId);
    while (cur?.parentId) {
      state.expandedCats.add(cur.parentId);
      cur = state.categories.find(c => c.id === cur.parentId);
    }
    renderCategories();
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
  if (state.sortBy === key) {
    // 点击同一个按钮 → 切换升降序
    state.orderDir = state.orderDir === 'desc' ? 'asc' : 'desc';
  } else {
    state.sortBy = key;
  }
  const dirLabel = state.orderDir === 'desc' ? '↓ 最新在前' : '↑ 最早在前';
  // 更新按钮样式 + 方向箭头
  const btnUpd = document.getElementById('sortUpdated');
  const btnCrt = document.getElementById('sortCreated');
  btnUpd.title = `修改时间 (${state.sortBy === 'updatedAt' ? dirLabel : '点击切换'})`;
  btnCrt.title = `创建时间 (${state.sortBy === 'createdAt' ? dirLabel : '点击切换'})`;
  btnUpd.classList.toggle('active', state.sortBy === 'updatedAt');
  btnCrt.classList.toggle('active', state.sortBy === 'createdAt');
  // 更新箭头方向
  const [activeBtn, otherBtn] = state.sortBy === 'updatedAt' ? [btnUpd, btnCrt] : [btnCrt, btnUpd];
  otherBtn.querySelector('.sort-arrow').textContent = '▾';
  const arrow = activeBtn.querySelector('.sort-arrow');
  arrow.textContent = state.orderDir === 'desc' ? '▾' : '▴';
  arrow.style.color = state.orderDir === 'asc' ? '#10b981' : '';
  renderNoteList();
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.add('hidden');
}

// ===== 手机右滑/左滑手势抽屉 =====
(function initDrawerGesture() {
  let sx = 0, sy = 0, tracking = false, scrolledTop = true;
  const OPEN_DX = 50, CLOSE_DX = -40;

  function top() {
    const nc = document.getElementById('noteCards');
    const la = document.querySelector('.list-area');
    if (nc) return nc.scrollTop <= 2;
    if (la) return la.scrollTop <= 2;
    return window.scrollY <= 2;
  }

  document.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
    tracking = true;
    scrolledTop = top();
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (!tracking) return;
    tracking = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = Math.abs(t.clientY - sy);
    if (Math.abs(dx) <= dy || Math.abs(dx) < 25) return;
    const d = document.getElementById('sidebar');
    const o = document.getElementById('sidebarOverlay');
    if (!d) return;
    if (!d.classList.contains('open') && dx > OPEN_DX && scrolledTop) {
      d.classList.add('open'); o && o.classList.remove('hidden');
    } else if (d.classList.contains('open') && dx < CLOSE_DX) {
      d.classList.remove('open'); o && o.classList.add('hidden');
    }
  }, { passive: true });

  document.addEventListener('touchcancel', () => { tracking = false; });
})();

// ===== 图片路径映射 =====
// API 返回 "/uploads/..." 或 "uploads/..." → 静态站 "assets/uploads/..."
function resolveUploadPath(url) {
  if (!url) return '';
  // 已是完整 URL 不动
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  // 去掉前导斜杠，加 assets/ 前缀
  let p = url.replace(/^\/+/, '');
  if (p.startsWith('uploads/')) return 'assets/' + p;
  return 'assets/' + p;
}

// 批量修正 HTML 里的 <img src="/uploads/xxx"> → <img src="assets/uploads/xxx">
function fixImgSrcInHtml(html) {
  if (!html) return '';
  return html.replace(/(<img[^>]*\bsrc=["'])([^"']+)(["'])/gi, (m, prefix, src, suffix) => {
    if (src.startsWith('data:') || src.startsWith('http')) return m;
    return prefix + resolveUploadPath(src) + suffix;
  });
}

// 修正笔记内链接：Next.js 路由 /note/[id] → 静态站 openDetail(noteId)
// 同时移除 target="_blank"（否则浏览器会新开 about:blank 空页）
function fixNoteLinksInHtml(html) {
  if (!html) return '';
  // 先删掉 target="_blank" / target='_blank'（带或不带引号）
  html = html.replace(/\s+target\s*=\s*["']?_blank["']?/gi, '');
  // 再把 href="/note/xxx" 改成模态框调用
  html = html.replace(/href=["']\/note\/([a-zA-Z0-9]+)["']/gi, (m, noteId) => {
    return `href="javascript:void(0)" data-note-id="${noteId}" onclick="openDetail('${noteId}')"`;
  });
  return html;
}

// ===== Twitter 风格图片网格 =====
function renderImagesGrid(images) {
  if (!images || images.length === 0) return '';
  const urls = images.slice(0, 9).map(resolveUploadPath);
  const count = urls.length;
  const remaining = images.length - 9;

  const imgTag = (src, extra = '') =>
    `<img src="${src}" loading="lazy" class="ig-img" onerror="this.style.background='var(--surface-alt)';this.style.backgroundImage='none'"${extra}>`;

  const handleClick = (idx) => {
    const urlsJson = JSON.stringify(images.map(resolveUploadPath)).replace(/"/g, '&quot;');
    return 'onclick="openLightboxGallery(' + urlsJson + ', ' + idx + ')"';
  };

  let html = '<div class="img-grid" data-images="' + encodeURIComponent(JSON.stringify(images.map(resolveUploadPath))) + '">';

  if (count === 1) {
    html += `<div class="ig-single" ${handleClick(0)}>${imgTag(urls[0])}</div>`;
  } else if (count === 2) {
    html += `<div class="ig-row2">${urls.map((u, i) => `<div class="ig-cell" ${handleClick(i)}>${imgTag(u)}</div>`).join('')}</div>`;
  } else if (count === 3) {
    html += `<div class="ig-3row">
      <div class="ig-cell ig-main" ${handleClick(0)}>${imgTag(urls[0])}</div>
      <div class="ig-col2">${urls.slice(1).map((u, i) => `<div class="ig-cell" ${handleClick(i + 1)}>${imgTag(u)}</div>`).join('')}</div>
    </div>`;
  } else if (count === 4) {
    html += `<div class="ig-2x2">${urls.map((u, i) => `<div class="ig-cell" ${handleClick(i)}>${imgTag(u)}</div>`).join('')}</div>`;
  } else {
    html += `<div class="ig-cols3">${urls.map((u, i) => {
      const showMore = remaining > 0 && i === urls.length - 1;
      return `<div class="ig-cell" ${handleClick(i)}>${imgTag(u)}${showMore ? `<div class="ig-more">+${remaining}</div>` : ''}</div>`;
    }).join('')}</div>`;
  }
  html += '</div>';
  return html;
}

// ===== 批量图片 Lightbox =====


/**
 * 全屏 Lightbox Gallery — 对齐原版 ImageLightbox
 * 功能：方向键翻页、ESC 关闭、左右按钮、底部指示点、切换动画、背景锁定、touch 滑动
 */
function openLightboxGallery(urls, startIdx) {
  startIdx = startIdx || 0;
  let idx = startIdx;
  let animating = false;

  const lb = document.createElement('div');
  lb.className = 'lightbox lightbox-gallery';
  
  // 底部指示点 HTML（只有多图时）
  const dotsHtml = urls.length > 1 
    ? '<div class="lb-dots">' + urls.map((_, i) => 
        '<button class="lb-dot' + (i === idx ? ' lb-dot-active' : '') + '" data-idx="' + i + '"></button>'
      ).join('') + '</div>' 
    : '';

  const navHtml = urls.length > 1 
    ? '<button class="lb-prev" aria-label="上一张">‹</button><button class="lb-next" aria-label="下一张">›</button>' 
    : '';

  lb.innerHTML = '\
    <div class="lb-backdrop"></div>\
    <div class="lb-header">\
      <span class="lb-counter">' + (idx + 1) + ' / ' + urls.length + '</span>\
      <button class="lb-close" aria-label="关闭">✕</button>\
    </div>\
    ' + navHtml + '\
    <div class="lb-img-wrap">\
      <img class="lb-img" src="' + urls[idx] + '">\
    </div>\
    ' + dotsHtml;

  document.body.appendChild(lb);
  // 锁背景滚动
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  const imgEl = lb.querySelector('.lb-img');
  const counterEl = lb.querySelector('.lb-counter');
  const dotsContainer = lb.querySelector('.lb-dots');

  const updateDots = () => {
    if (!dotsContainer) return;
    dotsContainer.querySelectorAll('.lb-dot').forEach((d, i) => {
      d.classList.toggle('lb-dot-active', i === idx);
    });
  };

  // 翻页动画：先淡出滑出 → 切 src → 淡入滑入
  const goTo = (newIdx, direction) => {
    if (animating || newIdx === idx || urls.length <= 1) return;
    animating = true;

    // 退出动画
    imgEl.style.transition = 'opacity .12s, transform .12s';
    imgEl.style.opacity = '0';
    imgEl.style.transform = 'translateX(' + (direction > 0 ? '-20px' : '20px') + ') scale(.96)';

    setTimeout(() => {
      idx = newIdx;
      counterEl.textContent = (idx + 1) + ' / ' + urls.length;
      updateDots();
      imgEl.src = urls[idx];
      // 进入动画
      imgEl.style.transition = 'none';
      imgEl.style.opacity = '0';
      imgEl.style.transform = 'translateX(' + (direction > 0 ? '20px' : '-20px') + ') scale(.96)';
      void imgEl.offsetWidth; // 强制 reflow
      requestAnimationFrame(() => {
        imgEl.style.transition = 'opacity .2s ease-out, transform .2s ease-out';
        imgEl.style.opacity = '1';
        imgEl.style.transform = 'translateX(0) scale(1)';
        setTimeout(() => { animating = false; }, 220);
      });
    }, 130);
  };

  const close = () => {
    document.body.style.overflow = prevOverflow;
    document.removeEventListener('keydown', onKey);
    lb.remove();
  };

  // 事件绑定
  lb.querySelector('.lb-close').onclick = close;
  lb.querySelector('.lb-backdrop').onclick = close;
  
  const prevBtn = lb.querySelector('.lb-prev');
  const nextBtn = lb.querySelector('.lb-next');
  if (prevBtn) prevBtn.onclick = (e) => { e.stopPropagation(); goTo((idx - 1 + urls.length) % urls.length, -1); };
  if (nextBtn) nextBtn.onclick = (e) => { e.stopPropagation(); goTo((idx + 1) % urls.length, 1); };

  // 底部指示点点击
  if (dotsContainer) {
    dotsContainer.addEventListener('click', (e) => {
      const dot = e.target.closest('.lb-dot');
      if (!dot) return;
      const targetIdx = parseInt(dot.dataset.idx);
      if (targetIdx === idx) return;
      goTo(targetIdx, targetIdx > idx ? 1 : -1);
    });
  }

  // 键盘
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft' && urls.length > 1) goTo((idx - 1 + urls.length) % urls.length, -1);
    else if (e.key === 'ArrowRight' && urls.length > 1) goTo((idx + 1) % urls.length, 1);
  };
  document.addEventListener('keydown', onKey);

  // Touch 手势（手机左右滑动翻页）
  // MDN 关键：必须用 passive:false + preventDefault() 阻止浏览器抢手势
  let touchStartX = 0, touchStartY = 0, touched = false, isTwoFinger = false;
  lb.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) { isTwoFinger = true; return; } // 两指捏合 → 让浏览器处理缩放
    if (e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touched = true;
  }, { passive: false });
  lb.addEventListener('touchmove', (e) => {
    if (!touched) return;
    e.preventDefault(); // 🔥 关键：阻止浏览器滚动页面
  }, { passive: false });
  lb.addEventListener('touchend', (e) => {
    if (isTwoFinger) { isTwoFinger = false; touched = false; return; }
    if (!touched) return;
    touched = false;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;

    // ⬇️ 下滑关闭（Instagram Story 同款）
    if (dy > 80 && Math.abs(dy) > Math.abs(dx)) { close(); return; }

    // ← → 左右滑动翻页
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) goTo((idx + 1) % urls.length, 1);
      else goTo((idx - 1 + urls.length) % urls.length, -1);
    } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      close();
    }
  }, { passive: false });
}
window.openLightboxGallery = openLightboxGallery;

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

// 滚动进度条 + 返回顶部 (同时处理桌面容器滚动和移动端 window 滚动)
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
})();

// 阅读时间
(function initReadTime() {
  const wordsPerMinute = 400;
  const applyToCards = () => {
    const cards = document.querySelectorAll('.note-card .card-body');
    cards.forEach(card => {
      if (card.querySelector('.read-time')) return; // 已经加过
      const text = (card.textContent || '').replace(/s+/g, '');
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

init().catch(e => console.error('Init failed:', e));
