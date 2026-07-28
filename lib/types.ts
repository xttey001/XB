// 共享的 TypeScript 类型定义
// 注意：Prisma 的 Note 模型中 images 和 tags 是 JSON 字符串
// 这些类型对应 API 返回时的"已解析"形态，方便前端使用

/** 笔记重要等级 */
export type NoteImportance = 'important' | 'very_important';

export interface CommentDTO {
  id: string;
  noteId: string;
  parentId: string | null;
  content: string;
  images: string[];
  createdAt: string;
  updatedAt: string;
  replies?: CommentDTO[];
}

export interface NoteDTO {
  id: string;
  content: string;
  /** 列表中显示的摘要（纯文本前 N 字符），详情页为完整 content */
  summary?: string;
  images: string[];
  categoryId: string | null;
  category: CategoryDTO | null;
  tags: string[];
  isFavorite: boolean;
  /** 重要等级：important（重要，蓝点） / very_important（极重要，红点） */
  importance: NoteImportance | null;
  /** 当前查询 scope 下是否置顶（由 API 根据 scope 计算） */
  pinned: boolean;
  /** 各视图独立置顶状态 */
  pinnedGlobal: boolean;
  pinnedFavorite: boolean;
  pinnedImportant: boolean;
  pinnedCategory: boolean;
  /** 各视图独立置顶排序 */
  globalPinOrder: number;
  favoritePinOrder: number;
  importantPinOrder: number;
  categoryPinOrder: number;
  /** 各视图独立自定义排序 */
  globalOrder: number;
  favoriteOrder: number;
  importantOrder: number;
  categoryOrder: number;
  repostOfId: string | null;
  repostOf: NoteDTO | null;
  createdAt: string;
  updatedAt: string;
  /** 社交统计与详情 */
  _social?: {
    likeCount: number;
    commentCount: number;
    repostCount: number;
    liked: boolean;
    comments: CommentDTO[];
  };
}

export interface CategoryDTO {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  order: number;
  createdAt: string;
  _count?: { notes: number };
}

export interface NoteInput {
  content: string;
  images?: string[];
  categoryId?: string | null;
  tags?: string[];
  isFavorite?: boolean;
  /** 重要等级：important / very_important，传 null 表示取消 */
  importance?: NoteImportance | null;
  /** 置顶操作所在的视图范围，后端据此更新对应置顶字段 */
  scope?: 'all' | 'favorite' | 'important' | 'category';
  pinned?: boolean;
  pinOrder?: number;
}

/** 批量调序请求 */
export interface ReorderItem {
  id: string;
  order: number;
}

export interface NoteReorderInput {
  scope: 'all' | 'favorite' | 'important' | 'category';
  items: ReorderItem[];
  /** 同时更新置顶状态时使用 */
  pinUpdates?: Array<{ id: string; pinned: boolean; pinOrder: number }>;
}

export interface CategoryReorderInput {
  items: ReorderItem[];
}

export interface SocialStatsDTO {
  noteId: string;
  likeCount: number;
  commentCount: number;
  repostCount: number;
  liked: boolean;
}

export interface DailyStatsDTO {
  date: string;
  count: number;
  important: number;
  veryImportant: number;
}
