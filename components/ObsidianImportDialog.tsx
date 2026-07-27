'use client';

import { useState, useRef } from 'react';
import {
  Upload,
  Loader2,
  X,
  Check,
  AlertCircle,
  FolderOpen,
  FileText,
  ImageIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ObsidianImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

interface SelectedFolder {
  files: File[];
  mdCount: number;
  imageCount: number;
  totalSize: number;
}

export default function ObsidianImportDialog({
  open,
  onClose,
  onImported,
}: ObsidianImportDialogProps) {
  const [selected, setSelected] = useState<SelectedFolder | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    imageCount: number;
    errors: string[];
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleSelectFolder = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) {
      setSelected(null);
      return;
    }

    const imageExtRegex = /\.(png|jpe?g|gif|webp|avif|svg|bmp)$/i;
    const mdCount = files.filter((f) =>
      f.name.toLowerCase().endsWith('.md')
    ).length;
    const imageCount = files.filter((f) => imageExtRegex.test(f.name)).length;
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);

    setSelected({
      files,
      mdCount,
      imageCount,
      totalSize,
    });
    setResult(null);
  };

  const handleImport = async () => {
    if (!selected || importing) return;
    setImporting(true);
    setResult(null);
    try {
      const res = await api.importObsidian(selected.files);
      setResult(res);
      if (res.imported > 0) {
        onImported();
      }
    } catch (e: any) {
      setResult({
        imported: 0,
        skipped: 0,
        imageCount: 0,
        errors: [e.message || '导入失败'],
      });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setSelected(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = '';
    onClose();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-accent-50 flex items-center justify-center">
              <Upload size={14} className="text-accent-600" />
            </div>
            <h3 className="font-medium text-ink-900">导入 Obsidian 笔记</h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded hover:bg-ink-100 text-ink-500"
          >
            <X size={16} />
          </button>
        </div>

        {!result && (
          <>
            <p className="text-sm text-ink-600 mb-4">
              点击下方按钮选择你的 Obsidian vault 文件夹，系统会自动：
            </p>
            <ul className="text-xs text-ink-500 space-y-1 mb-4 pl-4 list-disc">
              <li>递归扫描所有 .md 文件和图片</li>
              <li>提取 frontmatter 中的 tags / created</li>
              <li>
                转换 <code className="bg-ink-100 px-1 rounded">![[image]]</code>{' '}
                为标准 Markdown（图片会一起导入）
              </li>
              <li>
                转换 <code className="bg-ink-100 px-1 rounded">[[wiki link]]</code>{' '}
                为加粗文本
              </li>
            </ul>

            {/* 文件夹选择按钮 */}
            <input
              ref={inputRef}
              type="file"
              // @ts-ignore - webkitdirectory 是非标准但所有现代浏览器都支持的属性
              webkitdirectory=""
              directory=""
              multiple
              onChange={handleSelectFolder}
              className="hidden"
            />

            {!selected ? (
              <button
                onClick={() => inputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-4 py-6 rounded-md border-2 border-dashed border-ink-300 hover:border-accent-500 hover:bg-accent-50 text-ink-600 hover:text-accent-700 transition-colors"
              >
                <FolderOpen size={20} />
                <span className="text-sm font-medium">
                  点击选择 Obsidian vault 文件夹
                </span>
              </button>
            ) : (
              <div className="rounded-md border border-ink-200 bg-ink-50 p-4 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <FolderOpen size={14} className="text-accent-600" />
                  <span className="text-sm font-medium text-ink-800">
                    已选择文件夹
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <FileText size={12} className="text-ink-400" />
                    <span className="text-ink-500">Markdown 文件</span>
                    <span className="ml-auto font-medium text-ink-800">
                      {selected.mdCount}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ImageIcon size={12} className="text-ink-400" />
                    <span className="text-ink-500">图片文件</span>
                    <span className="ml-auto font-medium text-ink-800">
                      {selected.imageCount}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 col-span-2">
                    <span className="text-ink-500">总大小</span>
                    <span className="ml-auto font-medium text-ink-800">
                      {formatSize(selected.totalSize)}
                    </span>
                  </div>
                </div>
                {selected.mdCount === 0 && (
                  <p className="mt-3 text-xs text-amber-600 flex items-center gap-1">
                    <AlertCircle size={11} />
                    未发现 .md 文件，请选择 Obsidian vault 根目录
                  </p>
                )}
                <button
                  onClick={() => inputRef.current?.click()}
                  className="mt-3 text-xs text-accent-600 hover:text-accent-700"
                >
                  重新选择文件夹
                </button>
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={handleClose}
                className="px-3 py-1.5 text-sm text-ink-600 hover:text-ink-800"
              >
                取消
              </button>
              <button
                onClick={handleImport}
                disabled={!selected || selected.mdCount === 0 || importing}
                className={cn(
                  'inline-flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-md font-medium',
                  selected && selected.mdCount > 0 && !importing
                    ? 'bg-ink-900 text-white hover:bg-ink-700'
                    : 'bg-ink-200 text-ink-400 cursor-not-allowed'
                )}
              >
                {importing ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Upload size={13} />
                )}
                {importing
                  ? `导入中...`
                  : selected
                  ? `导入 ${selected.mdCount} 条笔记`
                  : '开始导入'}
              </button>
            </div>
          </>
        )}

        {result && (
          <div className="space-y-3">
            <div
              className={cn(
                'p-3 rounded-md flex items-start gap-2',
                result.imported > 0
                  ? 'bg-green-50 text-green-700'
                  : 'bg-amber-50 text-amber-700'
              )}
            >
              <Check size={16} className="flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                导入完成：成功 {result.imported} 条，跳过 {result.skipped} 条
                {result.imageCount > 0 && `，图片 ${result.imageCount} 张`}
                {result.errors.length > 0 &&
                  `，失败 ${result.errors.length} 条`}
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="p-3 rounded-md bg-red-50 text-red-700 max-h-40 overflow-y-auto">
                <div className="flex items-center gap-2 text-xs font-medium mb-1">
                  <AlertCircle size={12} />
                  错误详情
                </div>
                <ul className="text-xs space-y-0.5 pl-4 list-disc">
                  {result.errors.slice(0, 20).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                  {result.errors.length > 20 && (
                    <li className="italic">
                      ...还有 {result.errors.length - 20} 条错误
                    </li>
                  )}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-end">
              <button
                onClick={handleClose}
                className="px-3 py-1.5 text-sm bg-ink-900 text-white rounded-md hover:bg-ink-700"
              >
                完成
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
