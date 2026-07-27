'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Heart,
  MessageCircle,
  Repeat2,
  Send,
  X,
  Loader2,
  Trash2,
  CornerDownRight,
  ImagePlus,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { NoteDTO, CommentDTO } from '@/lib/types';
import { cn, formatTwitterTime, formatFullTime } from '@/lib/utils';
import ImageUploader from './ImageUploader';
import RepostModal from './RepostModal';
import TwitterImageGrid from './TwitterImageGrid';

interface NoteSocialProps {
  note: NoteDTO;
  onUpdate: (note: NoteDTO) => void;
  onReposted?: (newNote: NoteDTO) => void;
  /** 是否默认展开评论面板（详情页使用） */
  defaultOpenComments?: boolean;
}

export default function NoteSocial({ note, onUpdate, onReposted, defaultOpenComments = false }: NoteSocialProps) {
  const social = note._social;
  const [activeTab, setActiveTab] = useState<'comments' | null>(
    defaultOpenComments ? 'comments' : null
  );
  const [comments, setComments] = useState<CommentDTO[]>(social?.comments || []);
  const [loadingComments, setLoadingComments] = useState(false);

  const [commentText, setCommentText] = useState('');
  const [commentImages, setCommentImages] = useState<string[]>([]);
  const [replyTo, setReplyTo] = useState<CommentDTO | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);

  const [repostModalOpen, setRepostModalOpen] = useState(false);

  const [liking, setLiking] = useState(false);

  const commentFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingCommentImages, setUploadingCommentImages] = useState(false);

  const handleCommentFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;
    setUploadingCommentImages(true);
    try {
      const { urls } = await api.uploadImages(imageFiles);
      setCommentImages((prev) => [...prev, ...urls]);
    } catch (e: any) {
      alert(e.message || '上传失败');
    } finally {
      setUploadingCommentImages(false);
      if (commentFileInputRef.current) commentFileInputRef.current.value = '';
    }
  };

  const handleCommentPaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length === 0) return;
    e.preventDefault();
    setUploadingCommentImages(true);
    try {
      const { urls } = await api.uploadImages(imageFiles);
      setCommentImages((prev) => [...prev, ...urls]);
    } catch (e: any) {
      alert(e.message || '粘贴上传失败');
    } finally {
      setUploadingCommentImages(false);
    }
  };

  // 详情页默认展开评论时自动加载
  useEffect(() => {
    if (defaultOpenComments && comments.length === 0 && !loadingComments) {
      loadComments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultOpenComments]);

  const likeCount = social?.likeCount ?? 0;
  const commentCount = social?.commentCount ?? 0;
  const repostCount = social?.repostCount ?? 0;
  const liked = social?.liked ?? false;

  const handleToggleLike = async () => {
    if (liking) return;
    setLiking(true);
    try {
      const res = await api.toggleLike(note.id);
      onUpdate({
        ...note,
        _social: {
          ...(social || { liked: false, likeCount: 0, commentCount: 0, repostCount: 0, comments: [] }),
        liked: res.liked,
        likeCount: res.likeCount,
        },
      });
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLiking(false);
    }
  };

  const loadComments = async () => {
    setLoadingComments(true);
    try {
      const { comments: list } = await api.listComments(note.id);
      setComments(list);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoadingComments(false);
    }
  };

  const openComments = () => {
    setActiveTab('comments');
    if (comments.length === 0) loadComments();
  };

  const openReposts = () => {
    setRepostModalOpen(true);
  };

  const submitComment = async () => {
    const text = commentText.trim();
    if (!text && commentImages.length === 0) return;
    setSubmittingComment(true);
    try {
      const { comment } = await api.createComment(note.id, text, replyTo?.id, commentImages);
      if (replyTo) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === replyTo.id
              ? { ...c, replies: [...(c.replies || []), comment] }
              : c
          )
        );
      } else {
        setComments((prev) => [...prev, { ...comment, replies: [] }]);
      }
      setCommentText('');
      setCommentImages([]);
      setReplyTo(null);
      onUpdate({
        ...note,
        _social: {
          ...(social || { liked: false, likeCount: 0, commentCount: 0, repostCount: 0, comments: [] }),
          commentCount: commentCount + 1,
        },
      });
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmittingComment(false);
    }
  };

  const deleteComment = async (id: string, parentId?: string | null) => {
    if (!confirm('删除这条评论？')) return;
    try {
      await api.deleteComment(id);
      if (parentId) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === parentId
              ? { ...c, replies: (c.replies || []).filter((r) => r.id !== id) }
              : c
          )
        );
      } else {
        setComments((prev) => prev.filter((c) => c.id !== id));
      }
      onUpdate({
        ...note,
        _social: {
          ...(social || { liked: false, likeCount: 0, commentCount: 0, repostCount: 0, comments: [] }),
          commentCount: Math.max(0, commentCount - 1),
        },
      });
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleReposted = (newNote: NoteDTO) => {
    onUpdate({
      ...note,
      _social: {
        ...(social || { liked: false, likeCount: 0, commentCount: 0, repostCount: 0, comments: [] }),
        repostCount: repostCount + 1,
      },
    });
    onReposted?.(newNote);
  };

  const renderImages = (urls: string[]) => {
    if (!urls || urls.length === 0) return null;
    return <TwitterImageGrid images={urls} compact className="mt-2" />;
  };

  return (
    <div className="mt-3 pt-3 border-t border-ink-100">
      {/* 操作按钮栏 */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleToggleLike}
          disabled={liking}
          className={cn(
            'flex items-center gap-1 text-xs transition-colors',
            liked
              ? 'text-pink-600'
              : 'text-ink-500 hover:text-pink-600'
          )}
        >
          {liking ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Heart
              size={15}
              fill={liked ? 'currentColor' : 'none'}
              className={cn(liked && 'animate-pulse')}
            />
          )}
          <span>{likeCount || '点赞'}</span>
        </button>

        <button
          onClick={openComments}
          className={cn(
            'flex items-center gap-1 text-xs transition-colors',
            activeTab === 'comments'
              ? 'text-accent-600'
              : 'text-ink-500 hover:text-accent-600'
          )}
        >
          <MessageCircle size={15} />
          <span>{commentCount || '评论'}</span>
        </button>

        <button
          onClick={openReposts}
          className="flex items-center gap-1 text-xs transition-colors text-ink-500 hover:text-emerald-600"
        >
          <Repeat2 size={15} />
          <span>{repostCount || '转发'}</span>
        </button>
      </div>

      <RepostModal
        note={note}
        isOpen={repostModalOpen}
        onClose={() => setRepostModalOpen(false)}
        onReposted={handleReposted}
      />

      {/* 评论面板 */}
      {activeTab === 'comments' && (
        <div className="mt-3 space-y-3 animate-fade-in">
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitComment()}
                onPaste={handleCommentPaste}
                placeholder={replyTo ? `回复 ${replyTo.content.slice(0, 12)}...` : '写下你的评论...'}
                className="flex-1 px-3 py-2 text-sm bg-ink-50 border border-ink-200 rounded-md focus:border-accent-500"
              />
              {replyTo && (
                <button
                  onClick={() => setReplyTo(null)}
                  className="p-2 text-ink-400 hover:text-ink-600"
                  title="取消回复"
                >
                  <X size={15} />
                </button>
              )}
              <button
                onClick={submitComment}
                disabled={(!commentText.trim() && commentImages.length === 0) || submittingComment}
                className="px-3 py-2 rounded-md bg-accent-500 text-white text-xs disabled:bg-ink-300 hover:bg-accent-600"
              >
                {submittingComment ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Send size={13} />
                )}
              </button>
            </div>

            {commentImages.length > 0 && (
              <ImageUploader value={commentImages} onChange={setCommentImages} />
            )}

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => commentFileInputRef.current?.click()}
                disabled={uploadingCommentImages}
                className={cn(
                  'inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors',
                  commentImages.length > 0 || uploadingCommentImages
                    ? 'text-accent-600 bg-accent-50'
                    : 'text-ink-500 hover:text-accent-600 hover:bg-ink-50'
                )}
              >
                {uploadingCommentImages ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <ImagePlus size={14} />
                )}
                <span>{uploadingCommentImages ? '上传中' : '图片'}</span>
              </button>
              <input
                ref={commentFileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleCommentFiles(e.target.files)}
              />
            </div>
          </div>

          {loadingComments ? (
            <div className="py-4 text-center text-ink-400">
              <Loader2 size={16} className="animate-spin mx-auto" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-xs text-ink-400 py-2">还没有评论，来说两句吧</p>
          ) : (
            <div className="space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="text-sm">
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-accent-100 flex items-center justify-center text-[10px] text-accent-700 flex-shrink-0">
                      我
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="bg-ink-50 rounded-lg px-3 py-2">
                        <p className="text-ink-800 whitespace-pre-wrap">{c.content}</p>
                      </div>
                      {renderImages(c.images)}
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-ink-400">
                        <span title={`${formatFullTime(c.createdAt)}`} className="cursor-help">
                          {formatTwitterTime(c.createdAt)}
                        </span>
                        <span className="text-ink-300">·</span>
                        <button
                          onClick={() => setReplyTo(c)}
                          className="hover:text-accent-600"
                        >
                          回复
                        </button>
                        <span className="text-ink-300">·</span>
                        <button
                          onClick={() => deleteComment(c.id)}
                          className="hover:text-red-500"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  </div>

                  {c.replies && c.replies.length > 0 && (
                    <div className="mt-2 ml-8 space-y-2">
                      {c.replies.map((r) => (
                        <div key={r.id} className="flex items-start gap-2">
                          <CornerDownRight size={14} className="text-ink-300 mt-1 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="bg-ink-50 rounded-lg px-3 py-2">
                              <p className="text-ink-800 whitespace-pre-wrap">{r.content}</p>
                            </div>
                            {renderImages(r.images)}
                            <div className="flex items-center gap-3 mt-1 text-[11px] text-ink-400">
                              <span title={`${formatFullTime(r.createdAt)}`} className="cursor-help">
                                {formatTwitterTime(r.createdAt)}
                              </span>
                              <span className="text-ink-300">·</span>
                              <button
                                onClick={() => deleteComment(r.id, c.id)}
                                className="hover:text-red-500"
                              >
                                删除
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
