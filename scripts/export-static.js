/**
 * 一键导出静态站数据脚本
 * 读取 Prisma dev.db → 生成 notes.json / categories.json / areas.json / daily-stats.json
 * + 复制 public/uploads/ → public-site/assets/uploads/
 * + 生成 export-meta.json
 *
 * 用法：cd d:\XB && node scripts/export-static.js
 * 前置：npm install (Prisma client 要先 generate)
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

const ROOT = path.resolve(__dirname, '..');
const STATIC_SITE = path.join(ROOT, 'public-site');
const DATA_OUT = path.join(STATIC_SITE, 'data');
const ASSETS_OUT = path.join(STATIC_SITE, 'assets', 'uploads');
const PUBLIC_UPLOADS = path.join(ROOT, 'public', 'uploads');

function parseJsonArray(raw) {
  if (!raw || raw === '[]') return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function fmtDate(isoString) {
  return isoString ? isoString.slice(0, 10) : null; // "2026-09-18"
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/** 复制目录（增量） */
function copyDirIncremental(src, dest) {
  if (!fs.existsSync(src)) return { copied: 0, skipped: 0 };
  ensureDir(dest);
  let copied = 0, skipped = 0;

  function walk(curSrc, curDest) {
    const entries = fs.readdirSync(curSrc, { withFileTypes: true });
    for (const e of entries) {
      const s = path.join(curSrc, e.name);
      const d = path.join(curDest, e.name);
      if (e.isDirectory()) {
        ensureDir(d);
        walk(s, d);
      } else if (e.isFile()) {
        if (!fs.existsSync(d) || fs.statSync(s).mtimeMs > fs.statSync(d).mtimeMs) {
          fs.copyFileSync(s, d);
          copied++;
        } else {
          skipped++;
        }
      }
    }
  }
  walk(src, dest);
  return { copied, skipped };
}

async function main() {
  console.log('🚀 开始导出静态站数据...\n');

  // 1. 查所有数据（带关联）
  console.log('📖 查询数据库...');
  const [notesDb, categoriesDb, areasDb, likesDb] = await Promise.all([
    prisma.note.findMany({
      include: {
        category: { include: { knowledgeArea: true } },
        repostOf: { include: { category: { include: { knowledgeArea: true } } } },
      },
      orderBy: [{ pinnedGlobal: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.category.findMany({
      include: { knowledgeArea: true },
      orderBy: [{ pinned: 'desc' }, { order: 'desc' }, { createdAt: 'asc' }],
    }),
    prisma.knowledgeArea.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.like.findMany({ select: { noteId: true } }),
  ]);

  const likedIds = new Set(likesDb.map(l => l.noteId));

  // 2. 格式化 notes → 扁平结构（静态站 app.js 消费格式）
  console.log('📝 格式化 notes.json...');
  const notes = notesDb.map(n => ({
    id: n.id,
    content: n.content,
    images: parseJsonArray(n.images),
    tags: parseJsonArray(n.tags),
    categoryId: n.categoryId,
    categoryName: n.category?.name ?? null,
    categoryColor: n.category?.color ?? null,
    categoryIcon: n.category?.icon ?? null,
    areaId: n.category?.knowledgeAreaId ?? null,
    areaName: n.category?.knowledgeArea?.name ?? null,
    isFavorite: n.isFavorite,
    // DB 是 snake_case (very_important) → 静态站用 camelCase
    importance: n.importance === 'very_important' ? 'veryImportant' : (n.importance ?? null),
    pinnedGlobal: n.pinnedGlobal,
    reviewAt: n.reviewAt?.toISOString() ?? null,
    hasLiked: likedIds.has(n.id),
    isReposted: !!n.repostOfId,
    repostOfId: n.repostOfId ?? null,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  }));

  // 3. 格式化 categories（带 knowledgeArea 预展开）
  console.log('📁 格式化 categories.json...');
  const categories = categoriesDb.map(c => ({
    id: c.id,
    name: c.name,
    color: c.color,
    icon: c.icon ?? null,
    order: c.order,
    pinned: c.pinned,
    createdAt: c.createdAt.toISOString(),
    knowledgeAreaId: c.knowledgeAreaId ?? null,
    parentId: c.parentId ?? null,
    progressStatus: c.progressStatus,
    knowledgeArea: c.knowledgeArea ? {
      id: c.knowledgeArea.id,
      name: c.knowledgeArea.name,
      icon: c.knowledgeArea.icon ?? null,
      color: c.knowledgeArea.color,
      description: c.knowledgeArea.description ?? null,
      order: c.knowledgeArea.order,
      progressStatus: c.knowledgeArea.progressStatus,
      createdAt: c.knowledgeArea.createdAt.toISOString(),
    } : null,
  }));

  // 4. areas
  console.log('🌳 格式化 areas.json...');
  const areas = areasDb.map(a => ({
    id: a.id,
    name: a.name,
    icon: a.icon ?? null,
    color: a.color,
    description: a.description ?? null,
    order: a.order,
    progressStatus: a.progressStatus,
    createdAt: a.createdAt.toISOString(),
  }));

  // 5. daily-stats（按日期聚合笔记数 + important + veryImportant）
  console.log('📊 生成 daily-stats.json...');
  const stats = {};
  for (const n of notes) {
    const day = fmtDate(n.createdAt);
    if (!day) continue;
    if (!stats[day]) stats[day] = { count: 0, important: 0, veryImportant: 0 };
    stats[day].count++;
    if (n.importance === 'important') stats[day].important++;
    if (n.importance === 'very_important') stats[day].veryImportant++;
  }

  // 6. 写文件
  ensureDir(DATA_OUT);
  fs.writeFileSync(path.join(DATA_OUT, 'notes.json'), JSON.stringify(notes));
  fs.writeFileSync(path.join(DATA_OUT, 'categories.json'), JSON.stringify(categories));
  fs.writeFileSync(path.join(DATA_OUT, 'areas.json'), JSON.stringify(areas));
  fs.writeFileSync(path.join(DATA_OUT, 'daily-stats.json'), JSON.stringify(stats));
  fs.writeFileSync(path.join(DATA_OUT, 'export-meta.json'), JSON.stringify({
    exportedAt: new Date().toISOString(),
    noteCount: notes.length,
  }));
  console.log(`  ✅ notes.json        (${notes.length} 条)`);
  console.log(`  ✅ categories.json   (${categories.length} 条)`);
  console.log(`  ✅ areas.json        (${areas.length} 条)`);
  console.log(`  ✅ daily-stats.json  (${Object.keys(stats).length} 天)`);
  console.log(`  ✅ export-meta.json`);

  // 7. 复制图片（增量）
  console.log('\n🖼️  复制 uploads 图片...');
  const { copied, skipped } = copyDirIncremental(PUBLIC_UPLOADS, ASSETS_OUT);
  console.log(`  ✅ 新增/更新 ${copied} 张，跳过 ${skipped} 张（已存在且未变）`);

  // 8. 给 app.js 里的 data fetch 加版本号（防浏览器强缓存 notes.json）
  const appJsPath = path.join(STATIC_SITE, 'app.js');
  if (fs.existsSync(appJsPath)) {
    const ts = Date.now();
    let appJs = fs.readFileSync(appJsPath, 'utf8');
    // 先去掉旧的 ?v=xxx，再加新的
    appJs = appJs.replace(/fetch\('data\/([a-z-]+)\.json[^']*'\)/g, `fetch('data/$1.json?v=${ts}')`);
    fs.writeFileSync(appJsPath, appJs, 'utf8');
    console.log(`  ✅ app.js fetch version bumped to ${ts}`);
  }

  console.log(`\n🎉 完成！输出目录：${STATIC_SITE}`);
  console.log(`   下一步：cd public-site && git add -A && git commit -m "sync data ${notes.length}条" && git push origin gh-pages`);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('❌ 导出失败:', err);
  process.exit(1);
});
