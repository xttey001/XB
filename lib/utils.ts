import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, isToday, isThisYear } from 'date-fns';
import { zhCN } from 'date-fns/locale';

/** 合并 Tailwind className */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 图片/标签在 SQLite 中以 JSON 字符串存储，这里负责序列化与反序列化 */
export function parseJsonArray<T = string>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function stringifyJsonArray(arr: unknown[]): string {
  return JSON.stringify(arr ?? []);
}

/**
 * 时间戳格式化：分两种展示
 * 1. 相对时间（如 "3 分钟前"）—— 卡片默认显示
 * 2. 完整时间（如 "2026-07-26 14:30"）—— hover title 显示
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true, locale: zhCN });
}

export function formatFullTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  // 同一天只显示时分；同年显示月日时分；跨年加上年份
  if (isToday(d)) return format(d, 'HH:mm', { locale: zhCN });
  if (isThisYear(d)) return format(d, 'MM月dd日 HH:mm', { locale: zhCN });
  return format(d, 'yyyy年MM月dd日 HH:mm', { locale: zhCN });
}

/** 推特/X 风格完整时间：下午10:46 · 2026年7月25日 */
export function formatTwitterTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'ah:mm · yyyy年M月d日', { locale: zhCN });
}

/** 判断内容是否已经是 HTML（用于兼容旧 Markdown 数据） */
export function isHtmlContent(content: string): boolean {
  if (!content) return false;
  return /<[a-z][\s\S]*>/i.test(content);
}

/** 去除 HTML 标签，保留纯文本 */
export function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 判断 Tiptap 等富文本编辑器输出是否为空（如 <p></p>） */
export function isEmptyHtml(html: string): boolean {
  if (!html) return true;
  return stripHtml(html).length === 0;
}

/** 生成笔记列表摘要：移除 HTML/Markdown 标记后截取前 N 字符 */
export function generateSummary(content: string, maxLength = 200): string {
  const plain = stripHtml(content)
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
    .replace(/[#*_`~>\-|]/g, '')
    .trim();
  if (plain.length <= maxLength) return plain;
  return plain.slice(0, maxLength) + '…';
}

/** 检查文件大小（自用场景宽松限制 50MB，防浏览器卡死） */
export const MAX_IMAGE_SIZE = 50 * 1024 * 1024;

/** 生成安全的文件名：保留扩展名，主体替换为时间戳+随机串 */
export function generateSafeFileName(originalName: string): string {
  const ext = originalName.split('.').pop()?.toLowerCase() || 'jpg';
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `${timestamp}-${random}.${ext}`;
}

/** 判断 icon 值是否为图片路径（用于分类图标等） */
export function isImageIcon(icon: string | null | undefined): boolean {
  if (!icon) return false;
  const v = icon.trim();
  return v.startsWith('/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(v) || v.startsWith('http');
}

/** 按年月分目录存储，避免单目录文件过多 */
export function getMonthSubdir(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}/${m}`;
}

/** 艾宾浩斯遗忘曲线：简化版间隔（天） */
export const EBBINGHAUS_INTERVALS = [1, 3, 7, 14, 30];

/** 根据当前步骤计算下次回顾时间和下一步骤 */
export function calcEbbinghausNext(step: number): { date: Date; nextStep: number } {
  const days = EBBINGHAUS_INTERVALS[step] ?? EBBINGHAUS_INTERVALS[0];
  const nextStep = (step + 1) % EBBINGHAUS_INTERVALS.length;
  return {
    date: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    nextStep,
  };
}

/** 获取遗忘曲线某步骤对应的天数（用于 UI 展示） */
export function getEbbinghausDays(step: number): number {
  return EBBINGHAUS_INTERVALS[step] ?? EBBINGHAUS_INTERVALS[0];
}

// ===== 分类层级树 =====
import type { CategoryDTO } from './types';

export interface CategoryTreeNode extends CategoryDTO {
  children: CategoryTreeNode[];
}

/** 扁平分类数组 → 两层树（复用给侧边栏、下拉选择器等） */
export function buildCategoryTree(flat: CategoryDTO[]): CategoryTreeNode[] {
  const map = new Map<string, CategoryTreeNode>();
  flat.forEach((c) => map.set(c.id, { ...c, children: [] }));
  const roots: CategoryTreeNode[] = [];
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sort = (a: CategoryTreeNode, b: CategoryTreeNode) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.order !== b.order) return b.order - a.order;
    return a.createdAt.localeCompare(b.createdAt);
  };
  roots.sort(sort);
  for (const node of map.values()) node.children.sort(sort);
  return roots;
}

/** 查找某个分类的父分类 ID */
export function getParentId(categories: CategoryDTO[], categoryId: string | null | undefined): string | null {
  if (!categoryId) return null;
  const target = categories.find((c) => c.id === categoryId);
  return target?.parentId ?? null;
}
