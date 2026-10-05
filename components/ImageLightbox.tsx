'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import Image from 'next/image';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageLightboxProps {
  images: string[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onChangeIndex?: (index: number) => void;
}

export default function ImageLightbox({
  images,
  currentIndex,
  isOpen,
  onClose,
  onChangeIndex,
}: ImageLightboxProps) {
  const [direction, setDirection] = useState(0);
  const [animating, setAnimating] = useState(false);

  const changeIndex = useCallback((newIndex: number, dir: number) => {
    if (images.length <= 1 || newIndex === currentIndex) return;
    setDirection(dir);
    setAnimating(true);
    // 先触发退出动画，再切换索引，再进入
    setTimeout(() => {
      onChangeIndex?.(newIndex);
      setTimeout(() => setAnimating(false), 50);
    }, 120);
  }, [currentIndex, images.length, onChangeIndex]);

  const goPrev = useCallback(() => {
    const newIndex = currentIndex === 0 ? images.length - 1 : currentIndex - 1;
    changeIndex(newIndex, -1);
  }, [currentIndex, images.length, changeIndex]);

  const goNext = useCallback(() => {
    const newIndex = currentIndex === images.length - 1 ? 0 : currentIndex + 1;
    changeIndex(newIndex, 1);
  }, [currentIndex, images.length, changeIndex]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose, goPrev, goNext]);

  // 重置动画状态当 Lightbox 重新打开时
  useEffect(() => {
    if (isOpen) {
      setDirection(0);
      setAnimating(false);
    }
  }, [isOpen]);

  // ========== 手机 touch 手势滑动翻页 ==========
  const touchRef = useRef<{ startX: number; startY: number; startTime: number; twoFinger: boolean } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const root = document.querySelector('.lightbox-root') as HTMLElement | null;
    if (!root) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        touchRef.current = { startX: 0, startY: 0, startTime: 0, twoFinger: true };
        return;
      }
      touchRef.current = {
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        startTime: Date.now(),
        twoFinger: false,
      };
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchRef.current || touchRef.current.twoFinger) return;
      e.preventDefault();
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const t = touchRef.current;
      touchRef.current = null;
      if (!t || t.twoFinger) return;

      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const dx = endX - t.startX;
      const dy = endY - t.startY;
      const dt = Date.now() - t.startTime;

      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;

      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) goNext();
        else goPrev();
        return;
      }

      if (dt < 300 && Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) goNext();
        else goPrev();
      }
    };

    root.addEventListener('touchstart', handleTouchStart, { passive: true });
    root.addEventListener('touchmove', handleTouchMove, { passive: false });
    root.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      root.removeEventListener('touchstart', handleTouchStart);
      root.removeEventListener('touchmove', handleTouchMove);
      root.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isOpen, goPrev, goNext]);

  if (!isOpen || images.length === 0) return null;

  const currentImage = images[currentIndex];

  return (
    <div
      className="lightbox-root fixed inset-0 z-50 flex items-center justify-center bg-black/92 animate-fade-in touch-none overscroll-contain select-none"
      onClick={onClose}
    >
      {/* 顶部信息栏 */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 z-20">
        <span className="text-white/80 text-sm font-medium tracking-wide">
          {currentIndex + 1} / {images.length}
        </span>
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-black text-white hover:bg-black/80 transition-colors shadow-lg"
        >
          <X size={22} />
        </button>
      </div>

      {/* 上一张按钮 */}
      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          className={cn(
            'absolute left-2 sm:left-5 z-20 p-2.5 rounded-full bg-black text-white hover:bg-black/80 transition-colors shadow-lg',
            'top-1/2 -translate-y-1/2'
          )}
        >
          <ChevronLeft size={28} />
        </button>
      )}

      {/* 下一张按钮 */}
      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          className={cn(
            'absolute right-2 sm:right-5 z-20 p-2.5 rounded-full bg-black text-white hover:bg-black/80 transition-colors shadow-lg',
            'top-1/2 -translate-y-1/2'
          )}
        >
          <ChevronRight size={28} />
        </button>
      )}

      {/* 图片容器 */}
      <div
        className="relative w-full h-full flex items-center justify-center p-3 sm:p-6 lg:p-10 xl:p-20"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          key={currentImage + currentIndex}
          className={cn(
            'relative w-full h-full transition-all duration-200 ease-out',
            animating
              ? direction > 0
                ? 'opacity-0 translate-x-8 scale-[0.98]'
                : 'opacity-0 -translate-x-8 scale-[0.98]'
              : 'opacity-100 translate-x-0 scale-100'
          )}
        >
          <Image
            src={currentImage}
            alt=""
            fill
            sizes="100vw"
            quality={100}
            unoptimized
            className="object-contain"
            priority
          />
        </div>
      </div>

      {/* 底部指示点 */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
          {images.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                changeIndex(idx, idx > currentIndex ? 1 : -1);
              }}
              className={cn(
                'w-1.5 h-1.5 rounded-full transition-all',
                idx === currentIndex
                  ? 'bg-white w-4'
                  : 'bg-white/40 hover:bg-white/60'
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
