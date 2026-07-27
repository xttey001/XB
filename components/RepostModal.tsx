'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { X, Loader2, ImagePlus, Repeat2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { NoteDTO } from '@/lib/types';
import { cn, formatTwitterTime } from '@/lib/utils';
import ImageUploader from './ImageUploader';
import RichTextRenderer from './RichTextRenderer';

interface RepostModalProps {
  note: NoteDTO;
  isOpen: boolean;
  onClose: () => void;
  onReposted?: (newNote: NoteDTO) => void;
}

export default function RepostModal({ note, isOpen, onClose, onReposted }: RepostModalProps) {
  const [text, setText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setText('');
      setImages([]);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;
    setUploading(true);
    try {
      const { urls } = await api.uploadImages(imageFiles);
      setImages((prev) => [...prev, ...urls]);
    } catch (e: any) {
      alert(e.message || '上传失败');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
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
    setUploading(true);
    try {
      const { urls } = await api.uploadImages(imageFiles);
      setImages((prev) => [...prev, ...urls]);
    } catch (e: any) {
      alert(e.message || '粘贴上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed && images.length === 0) return;
    setSubmitting(true);
    try {
      const { note: newNote } = await api.createRepost(note.id, trimmed, images);
      setText('');
      setImages([]);
      onClose();
      onReposted?.(newNote);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!isOpen) return null;

  const noteImages = note.images || [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-16 sm:pt-24"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white rounded-2xl shadow-xl overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-ink-100">
          <h3 className="text-base font-medium text-ink-900">添加评论</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-ink-400 hover:bg-ink-100 hover:text-ink-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 内容区 */}
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* 编辑区 */}
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-accent-100 flex items-center justify-center text-sm text-accent-700 flex-shrink-0">
              我
            </div>
            <div className="flex-1 min-w-0 space-y-3">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="写下你的想法..."
                rows={3}
                className="w-full px-0 py-1 text-[15px] text-ink-900 placeholder:text-ink-400 bg-transparent border-0 focus:ring-0 resize-none"
              />

              {images.length > 0 && (
                <ImageUploader value={images} onChange={setImages} />
              )}

              {/* 引用原帖卡片 */}
              <div className="rounded-xl border border-ink-200 overflow-hidden">
                <div className="p-3 space-y-2">
                  <div className="flex items-center gap-2 text-[13px]">
                    <div className="w-6 h-6 rounded-full bg-accent-100 flex items-center justify-center text-[10px] text-accent-700">
                      我
                    </div>
                    <span className="font-medium text-ink-700">原文</span>
                    <span className="text-ink-400">·</span>
                    <span className="text-ink-400">{formatTwitterTime(note.createdAt)}</span>
                  </div>

                  <div className="note-md text-sm text-ink-700 line-clamp-3">
                    <RichTextRenderer content={note.content} />
                  </div>

                  {noteImages.length > 0 && (
                    <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
                      {noteImages.slice(0, 3).map((url, idx) => (
                        <div
                          key={url + idx}
                          className="relative flex-shrink-0 w-16 h-16 rounded-md overflow-hidden bg-ink-50"
                        >
                          <Image src={url} alt="" fill sizes="128px" quality={90} className="object-cover" />
                        </div>
                      ))}
                      {noteImages.length > 3 && (
                        <div className="relative flex-shrink-0 w-16 h-16 rounded-md bg-ink-100 flex items-center justify-center text-xs text-ink-500">
                          +{noteImages.length - 3}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 底部工具栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-ink-100">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className={cn(
                'p-2 rounded-full text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50',
                uploading && 'animate-pulse'
              )}
              title="添加图片"
            >
              {uploading ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={(!text.trim() && images.length === 0) || submitting}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium text-white transition-colors',
              text.trim() || images.length > 0
                ? 'bg-emerald-500 hover:bg-emerald-600'
                : 'bg-ink-300'
            )}
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <span className="flex items-center gap-1"><Repeat2 size={14} /> 转发</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
