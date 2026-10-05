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
// ===== 快捷视图 =====
function renderSidebar() {
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === state.view && !state.currentFilterId);
  });
}

    if (a.order !== b.order) return (b.order || 0) - (a.order || 0);  // 降序！
    return (a.createdAt || '').localeCompare(b.createdAt || '');
  };
  roots.sort(sort);
  for (const node of map.values()) node.children.sort(sort);
  return roots;
}

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

    // 日期筛选
    if (state.dateMode === 'single' && state.dateSingle) {
      notes = notes.filter(n => (n.createdAt || '').startsWith(state.dateSingle));
    } else if (state.dateMode === 'range' && state.dateRangeStart && state.dateRangeEnd) {
      notes = notes.filter(n => {
        const d = (n.createdAt || '').slice(0, 10);
        return d >= state.dateRangeStart && d <= state.dateRangeEnd;
      });
    }

    // 搜索
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

  // 修 content 里可能有的 img src + 搜索高亮
  const bodyHtml = safeHighlightSearch(fixImgSrcInHtml(note.content || ''));

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

      <div class="modal-body card-body">${safeHighlightSearch(fixImgSrcInHtml(note.content || ''))}</div>
      ${imagesHtml}
    </div>
  `;
  document.body.appendChild(overlay);

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

<<<<<<< Updated upstream
=======
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

// ===== Twitter 风格图片网格 =====
function renderImagesGrid(images) {
  if (!images || images.length === 0) return '';
  const urls = images.slice(0, 9).map(resolveUploadPath);
  const count = urls.length;
  const remaining = images.length - 9;

  const imgTag = (src, extra = '') =>
    `<img src="${src}" loading="lazy" class="ig-img" onerror="this.style.background='#f4f4f5';this.style.backgroundImage='none'"${extra}>`;

  const handleClick = (idx) =>
    `onclick="openLightboxGallery(${JSON.stringify(images.map(resolveUploadPath))}, ${idx})"`;

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
function openLightboxGallery(urls, startIdx = 0) {
  let idx = startIdx;
  const lb = document.createElement('div');
  lb.className = 'lightbox lightbox-gallery';
  lb.innerHTML = `
    <div class="lb-backdrop" onclick="this.closest('.lightbox').remove()"></div>
    <button class="lb-close" onclick="this.closest('.lightbox').remove()">✕</button>
    ${urls.length > 1 ? `<button class="lb-prev" onclick="lbNav(-1)">‹</button><button class="lb-next" onclick="lbNav(1)">›</button>` : ''}
    <div class="lb-counter">${idx + 1} / ${urls.length}</div>
    <img class="lb-img" src="${urls[idx]}">
  `;
  document.body.appendChild(lb);

  // 翻页函数挂到 window
  window.lbNav = (dir) => {
    idx = (idx + dir + urls.length) % urls.length;
    lb.querySelector('.lb-img').src = urls[idx];
    lb.querySelector('.lb-counter').textContent = `${idx + 1} / ${urls.length}`;
  };

  // ESC 关闭 + 方向键翻页
  const onKey = e => {
    if (e.key === 'Escape') { lb.remove(); document.removeEventListener('keydown', onKey); }
    else if (e.key === 'ArrowLeft' && urls.length > 1) window.lbNav(-1);
    else if (e.key === 'ArrowRight' && urls.length > 1) window.lbNav(1);
  };
  document.addEventListener('keydown', onKey);
}
// 必须挂到 window 上，因为 img-grid 用内联 onclick="openLightboxGallery(...)"
window.openLightboxGallery = openLightboxGallery;

>>>>>>> Stashed changes
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
