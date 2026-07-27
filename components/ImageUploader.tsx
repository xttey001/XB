'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

interface ImageUploaderProps {
  value: string[];
  onChange: (urls: string[]) => void;
}

/**
 * 多图上传组件
 * - 支持点击选择 + 拖拽上传 + 粘贴上传（由父组件处理 paste）
 * - 上传中显示 loading
 * - 已上传的图片显示缩略图，鼠标 hover 显示删除按钮
 */
export default function ImageUploader({ value, onChange }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const imageFiles = Array.from(files).filter((f) =>
        f.type.startsWith('image/')
      );
      if (imageFiles.length === 0) return;
      setUploading(true);
      try {
        const { urls } = await api.uploadImages(imageFiles);
        onChange([...value, ...urls]);
      } catch (e: any) {
        alert(e.message || '上传失败');
      } finally {
        setUploading(false);
      }
    },
    [value, onChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const removeImage = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {value.map((url, idx) => (
            <div
              key={url + idx}
              className="relative group aspect-square rounded-md overflow-hidden border border-ink-200 bg-ink-50"
            >
              <Image
                src={url}
                alt=""
                fill
                sizes="120px"
                quality={90}
                className="object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(idx)}
                className="absolute top-1 right-1 p-0.5 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="删除图片"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex items-center justify-center gap-2 px-3 py-3 rounded-md border border-dashed cursor-pointer transition-colors text-sm',
          dragOver
            ? 'border-accent-500 bg-accent-50 text-accent-700'
            : 'border-ink-300 text-ink-500 hover:border-ink-400 hover:text-ink-700'
        )}
      >
        {uploading ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            <span>上传中...</span>
          </>
        ) : (
          <>
            <Upload size={14} />
            <span>添加图片 · 拖拽或点击</span>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
