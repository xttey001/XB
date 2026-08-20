/**
 * 笔记链接解析工具
 * 从 HTML 内容中解析出笔记链接，格式：<a href="/note/{id}"> 或 <a href="/note/{id}" ...>
 */

import { prisma } from './prisma';

const NOTE_LINK_REGEX = /<a[^>]*href="\/note\/([^"]+)"[^>]*>/gi;

/**
 * 从 HTML 内容中提取所有链接到的笔记 ID
 */
export function extractLinkedNoteIds(html: string): string[] {
  const ids = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = NOTE_LINK_REGEX.exec(html)) !== null) {
    ids.add(match[1]);
  }
  return Array.from(ids);
}

/**
 * 生成指向笔记的链接 HTML
 */
export function createNoteLinkHtml(noteId: string, title: string): string {
  return `<a href="/note/${noteId}" class="note-link" data-note-id="${noteId}">${title}</a>`;
}

/**
 * 同步笔记的链接关系
 * 解析 content 中的笔记链接，与数据库中已有的 NoteLink 记录对比，
 * 新增未存在的链接，删除已移除的链接。
 */
export async function syncNoteLinks(noteId: string, content: string): Promise<void> {
  const targetIds = extractLinkedNoteIds(content);

  // 获取当前已有的链接
  const existingLinks = await prisma.noteLink.findMany({
    where: { sourceId: noteId },
    select: { targetId: true },
  });
  const existingTargetIds = new Set(existingLinks.map((l) => l.targetId));

  // 需要新增的链接
  const toAdd = targetIds.filter((id) => !existingTargetIds.has(id));
  // 需要删除的链接
  const toRemove = Array.from(existingTargetIds).filter(
    (id) => !targetIds.includes(id)
  );

  // 批量操作
  await Promise.all([
    // 新增
    ...toAdd.map((targetId) =>
      prisma.noteLink.create({
        data: { sourceId: noteId, targetId },
      })
    ),
    // 删除
    ...toRemove.map((targetId) =>
      prisma.noteLink.deleteMany({
        where: { sourceId: noteId, targetId },
      })
    ),
  ]);
}