'use client';

import type { NoteDTO, NoteInput, CategoryDTO, NoteReorderInput, CategoryReorderInput, DailyStatsDTO, ReminderDTO, ReminderInput, ReminderUpdateInput } from '@/lib/types';

async function request<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text || '响应解析失败' };
  }

  if (!res.ok) {
    const serverError = (data as any)?.error;
    if (serverError) {
      throw new Error(serverError);
    }
    const statusText = res.status === 400 ? '请求参数错误' : res.status === 404 ? '资源不存在' : res.status >= 500 ? '服务器错误' : `请求失败(${res.status})`;
    throw new Error(statusText);
  }
  return data as T;
}

export type SortBy = 'createdAt' | 'updatedAt' | 'custom';
export type Scope = 'all' | 'favorite' | 'important' | 'veryImportant' | 'category' | 'liked' | 'reposted' | 'allPinned' | 'reviewed';

export interface NoteLinkResult {
  id: string;
  summary: string;
  createdAt: string;
  tags: string[];
}

export interface NoteLinksResponse {
  outgoing: NoteLinkResult[];
  incoming: NoteLinkResult[];
  relatedByTag: NoteLinkResult[];
}

export interface TopicTreeNode {
  id: string;
  summary: string;
  tags: string[];
  categoryId: string | null;
  categoryName: string | null;
  importance: string | null;
  createdAt: string;
  depth: number;
  links: TopicTreeNode[];
}

export const api = {
  // ===== Notes =====
  listNotes(params: {
    q?: string;
    categoryId?: string;
    favorite?: boolean;
    tag?: string;
    importance?: string;
    liked?: boolean;
    reposted?: boolean;
    veryImportant?: boolean;
    sortBy?: SortBy;
    scope?: Scope;
    startDate?: string;
    endDate?: string;
    withSocial?: boolean;
    reviewDue?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ notes: NoteDTO[]; total: number; hasMore: boolean }> {
    const sp = new URLSearchParams();
    if (params.q) sp.set('q', params.q);
    if (params.categoryId) sp.set('categoryId', params.categoryId);
    if (params.favorite) sp.set('favorite', 'true')
    if (params.tag) sp.set('tag', params.tag);
    if (params.importance) sp.set('importance', params.importance);
    if (params.liked) sp.set('liked', 'true');
    if (params.reposted) sp.set('reposted', 'true');
    if (params.veryImportant) sp.set('veryImportant', 'true');
    if (params.sortBy) sp.set('sortBy', params.sortBy);
    if (params.scope) sp.set('scope', params.scope);
    if (params.startDate) sp.set('startDate', params.startDate);
    if (params.endDate) sp.set('endDate', params.endDate);
    if (params.withSocial) sp.set('withSocial', 'true');
    if (params.reviewDue) sp.set('reviewDue', 'true');
    if (params.limit !== undefined) sp.set('limit', String(params.limit));
    if (params.offset !== undefined) sp.set('offset', String(params.offset));
    const qs = sp.toString();
    return request(`/api/notes${qs ? `?${qs}` : ''}`);
  },
  getDailyStats(params: {
    year: number;
    month: number;
    scope?: Scope;
    categoryId?: string;
  }): Promise<{ stats: DailyStatsDTO[] }> {
    const sp = new URLSearchParams();
    sp.set('year', String(params.year));
    sp.set('month', String(params.month));
    if (params.scope) sp.set('scope', params.scope);
    if (params.categoryId) sp.set('categoryId', params.categoryId);
    return request(`/api/notes/daily-stats?${sp.toString()}`);
  },

  getNote(id: string): Promise<{ note: NoteDTO }> {
    return request(`/api/notes/${id}`);
  },

  createNote(input: NoteInput): Promise<{ note: NoteDTO }> {
    return request('/api/notes', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  updateNote(id: string, input: Partial<NoteInput>): Promise<{ note: NoteDTO }> {
    return request(`/api/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  deleteNote(id: string): Promise<{ success: boolean }> {
    return request(`/api/notes/${id}`, { method: 'DELETE' });
  },

  searchNotes(q: string): Promise<{ notes: Array<{ id: string; title: string }> }> {
    return request(`/api/notes/search?q=${encodeURIComponent(q)}`);
  },

  getNoteLinks(id: string): Promise<NoteLinksResponse> {
    return request(`/api/notes/${id}/links`);
  },

  /** 链接推荐助手：返回与该笔记可能相关但还没手动链接的笔记 */
  getLinkSuggestions(id: string, limit = 5): Promise<{
    suggestions: Array<{
      id: string;
      summary: string;
      tags: string[];
      categoryId: string | null;
      categoryName: string | null;
      importance: string | null;
      createdAt: string;
      reasons: string[];
      score: number;
    }>;
  }> {
    return request(`/api/notes/${id}/link-suggestions?limit=${limit}`);
  },

  /** 主题树导航：返回以 rootId 为根的 N 跳手动链接树 */
  getTopicTree(rootId: string, opts?: { depth?: number; direction?: 'outgoing' | 'incoming' | 'both' }): Promise<{
    rootId: string;
    depth: number;
    direction: string;
    tree: TopicTreeNode;
    stats: { totalNodes: number; totalManualLinks: number };
  }> {
    const sp = new URLSearchParams();
    if (opts?.depth) sp.set('depth', String(opts.depth));
    if (opts?.direction) sp.set('direction', opts.direction);
    const qs = sp.toString();
    return request(`/api/topic/${rootId}${qs ? `?${qs}` : ''}`);
  },

  reorderNotes(input: NoteReorderInput): Promise<{ success: boolean }> {
    return request('/api/notes/reorder', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  // ===== Categories =====
  listCategories(): Promise<{ categories: CategoryDTO[] }> {
    return request('/api/categories');
  },

  createCategory(input: {
    name: string;
    color?: string;
    icon?: string;
  }): Promise<{ category: CategoryDTO }> {
    return request('/api/categories', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  updateCategory(
    id: string,
    input: Partial<{ name: string; color: string; icon: string; pinned: boolean; order: number }>
  ): Promise<{ category: CategoryDTO }> {
    return request(`/api/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  deleteCategory(id: string): Promise<{ success: boolean }> {
    return request(`/api/categories/${id}`, { method: 'DELETE' });
  },

  reorderCategories(input: CategoryReorderInput): Promise<{ success: boolean }> {
    return request('/api/categories/reorder', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  // ===== Upload =====
  async uploadImages(files: File[]): Promise<{ urls: string[] }> {
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error((data as any).error || '上传失败');
    return data as { urls: string[] };
  },

  // ===== Obsidian 导入 =====
  async importObsidian(
    files: File[]
  ): Promise<{
    imported: number;
    skipped: number;
    imageCount: number;
    errors: string[];
  }> {
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));
    const res = await fetch('/api/import/obsidian', {
      method: 'POST',
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) throw new Error((data as any).error || '导入失败');
    return data as {
      imported: number;
      skipped: number;
      imageCount: number;
      errors: string[];
    };
  },

  // ===== Social: Likes =====
  toggleLike(noteId: string): Promise<{ liked: boolean; likeCount: number }> {
    return request(`/api/notes/${noteId}/like`, { method: 'POST' });
  },

  // ===== Social: Comments =====
  listComments(noteId: string): Promise<{ comments: import('@/lib/types').CommentDTO[] }> {
    return request(`/api/notes/${noteId}/comments`);
  },
  createComment(noteId: string, content: string, parentId?: string, images?: string[]): Promise<{ comment: import('@/lib/types').CommentDTO }> {
    return request(`/api/notes/${noteId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content, parentId, images }),
    });
  },
  deleteComment(commentId: string): Promise<{ success: boolean }> {
    return request(`/api/comments/${commentId}`, { method: 'DELETE' });
  },

  // ===== Social: Reposts =====
  createRepost(noteId: string, content: string, images?: string[]): Promise<{ note: NoteDTO }> {
    return request(`/api/notes/${noteId}/reposts`, {
      method: 'POST',
      body: JSON.stringify({ content, images }),
    });
  },

  // ===== Reminders =====
  listReminders(status?: 'all' | 'pending' | 'completed'): Promise<{ reminders: ReminderDTO[] }> {
    const qs = status ? `?status=${status}` : '';
    return request(`/api/reminders${qs}`);
  },

  createReminder(input: ReminderInput): Promise<{ reminder: ReminderDTO }> {
    return request('/api/reminders', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  updateReminder(id: string, input: ReminderUpdateInput): Promise<{ reminder: ReminderDTO }> {
    return request(`/api/reminders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  deleteReminder(id: string): Promise<{ success: boolean }> {
    return request(`/api/reminders/${id}`, { method: 'DELETE' });
  },

  completeReminder(id: string): Promise<{ reminder: ReminderDTO }> {
    return request(`/api/reminders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isCompleted: true }),
    });
  },

  snoozeReminder(id: string, minutes: number): Promise<{ reminder: ReminderDTO }> {
    const snoozeUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    return request(`/api/reminders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ snoozeUntil }),
    });
  },
};


