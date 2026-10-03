'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { ImagePlus, Upload, Loader2, X, Check } from 'lucide-react';

interface IconEditorProps {
  onSaved: (iconPath: string) => void;
  onCancel: () => void;
}

/**
 * 图标制作组件
 *
 * 关键设计约束（曾经踩的致命 bug）：
 *  1. canvas 和 file input 必须始终挂载在 DOM 中，不能放进条件渲染分支里，
 *     否则 processImage() 执行时 ref.current === null → 静默 return，用户毫无反应
 *  2. React 一个 ref 只能绑定一个元素，不能写两个 <canvas ref={canvasRef}>
 */
export default function IconEditor({ onSaved, onCancel }: IconEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [hasImage, setHasImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processImage = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('图片超过 10MB，请选小一点的');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) {
          console.error('[IconEditor] canvasRef.current is null');
          return;
        }

        const size = 200;
        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setError('浏览器不支持 Canvas 2D');
          return;
        }

        ctx.clearRect(0, 0, size, size);

        // 圆形 mask
        ctx.save();
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        // 居中正方形裁切
        const srcSize = Math.min(img.width, img.height);
        const srcX = (img.width - srcSize) / 2;
        const srcY = (img.height - srcSize) / 2;

        ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, size, size);
        ctx.restore();

        setHasImage(true);
        setError(null);
      };
      img.onerror = () => setError('图片加载失败，请换一张试试');
      img.src = e.target?.result as string;
    };
    reader.onerror = () => setError('文件读取失败');
    reader.readAsDataURL(file);
  }, []);

  /** 粘贴处理 — 全局 document 监听 */
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            processImage(file);
            break;
          }
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [processImage]);

  /** 拖拽 */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    setDragOver(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processImage(file);
    } else {
      setError('请拖入图片文件');
    }
  };

  /** 文件选择 */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImage(file);
    e.target.value = '';
  };

  /** 保存 */
  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      setError('Canvas 未就绪');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas 导出失败'))), 'image/png');
      });

      const formData = new FormData();
      formData.append('file', blob, 'icon.png');

      const res = await fetch('/api/icon/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '上传失败');
      }

      const { url } = await res.json();
      onSaved(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    setHasImage(false);
    setError(null);
  };

  return (
    <div className="space-y-3">
      {/*
        ====== canvas 无条件渲染（关键！）======
        第一次 render 就存在于 DOM 中，ref 永远能拿到。
        CSS 控制可见性：hasImage=false 时缩小隐藏，
        hasImage=true 时 96x96 圆形预览。
        绘图缓冲始终 200x200（高清）。
      */}
      <canvas
        ref={canvasRef}
        width={200}
        height={200}
        className={`mx-auto rounded-full shadow-inner transition-all duration-200 bg-ink-100 ${
          hasImage ? 'w-24 h-24 opacity-100' : 'w-0 h-0 opacity-0 overflow-hidden'
        }`}
        style={{ imageRendering: 'auto' }}
        aria-hidden="true"
      />

      {/* file input：始终挂载但隐藏 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* 交互区：粘贴/拖入/点击 — 只有文字/按钮区做条件渲染 */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative rounded-lg border-2 border-dashed p-4 text-center transition-colors cursor-pointer ${
          dragOver ? 'border-accent-500 bg-accent-50' : 'border-ink-200 hover:border-ink-300'
        }`}
      >
        {!hasImage ? (
          <div className="py-3">
            <ImagePlus size={28} className="mx-auto text-ink-400 mb-2" />
            <p className="text-xs text-ink-500 mb-1">点击 / Ctrl+V 粘贴 / 拖入图片</p>
            <p className="text-xs text-ink-400 mb-2">自动居中裁圆形 200×200</p>
          </div>
        ) : (
          <div className="py-2 text-ink-400 text-xs">拖动可替换，点击也能选新图</div>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-500 text-center">{error}</p>
      )}

      <div className="flex items-center justify-between gap-2">
        {hasImage ? (
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-ink-500 hover:text-ink-700"
          >
            <X size={11} />
            换一张
          </button>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onCancel}
            className="px-2 py-1 text-xs text-ink-500 hover:text-ink-700"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasImage || saving}
            className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-ink-900 text-white rounded disabled:bg-ink-300"
          >
            {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
            用作图标
          </button>
        </div>
      </div>
    </div>
  );
}
