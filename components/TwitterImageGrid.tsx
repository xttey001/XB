'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import ImageLightbox from './ImageLightbox';

interface TwitterImageGridProps {
  images: string[];
  maxImages?: number;
  className?: string;
  /** 是否在较窄容器内（如原文引用块、评论） */
  compact?: boolean;
  /** 点击时是否阻止事件冒泡 */
  stopPropagation?: boolean;
}

export default function TwitterImageGrid({
  images,
  maxImages = 9,
  className,
  compact = false,
  stopPropagation = false,
}: TwitterImageGridProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (!images || images.length === 0) return null;

  const visibleImages = images.slice(0, maxImages);
  const remaining = images.length - maxImages;
  const count = visibleImages.length;

  const handleClick = (e: React.MouseEvent, idx: number) => {
    e.preventDefault();
    if (stopPropagation) {
      e.stopPropagation();
    }
    setLightboxIndex(idx);
  };

  // 单图：撑满宽度，限制最大高度
  if (count === 1) {
    return (
      <>
        <button
          type="button"
          onClick={(e) => handleClick(e, 0)}
          className={cn(
            'block w-full relative overflow-hidden rounded-lg bg-ink-50 hover:opacity-95 transition-opacity',
            compact ? 'max-h-[360px]' : 'max-h-[500px]'
          )}
          style={{ aspectRatio: '16 / 9' }}
        >
          <Image
            src={visibleImages[0]}
            alt=""
            fill
            sizes={compact ? '(max-width: 768px) 85vw, 500px' : '(max-width: 768px) 100vw, 700px'}
            quality={100}
            unoptimized
            className="object-cover"
          />
        </button>
        <ImageLightbox
          images={images}
          currentIndex={lightboxIndex ?? 0}
          isOpen={lightboxIndex !== null}
          onClose={() => setLightboxIndex(null)}
          onChangeIndex={setLightboxIndex}
        />
      </>
    );
  }

  // 2 图：并排
  if (count === 2) {
    return (
      <>
        <div className={cn('grid grid-cols-2 gap-0.5', className)}>
          {visibleImages.map((url, idx) => (
            <button
              key={url + idx}
              type="button"
              onClick={(e) => handleClick(e, idx)}
              className="relative aspect-square overflow-hidden rounded-lg bg-ink-50 hover:opacity-95 transition-opacity"
            >
              <Image
                src={url}
                alt=""
                fill
                sizes={compact ? '(max-width: 768px) 42vw, 250px' : '(max-width: 768px) 50vw, 350px'}
                quality={100}
                unoptimized
                className="object-cover"
              />
            </button>
          ))}
        </div>
        <ImageLightbox
          images={images}
          currentIndex={lightboxIndex ?? 0}
          isOpen={lightboxIndex !== null}
          onClose={() => setLightboxIndex(null)}
          onChangeIndex={setLightboxIndex}
        />
      </>
    );
  }

  // 3 图：Twitter 经典布局，左侧大图 + 右侧上下两图
  if (count === 3) {
    return (
      <>
        <div className={cn('grid grid-cols-2 grid-rows-2 gap-0.5 aspect-square', className)}>
          <button
            type="button"
            onClick={(e) => handleClick(e, 0)}
            className="relative row-span-2 h-full overflow-hidden rounded-lg bg-ink-50 hover:opacity-95 transition-opacity"
          >
            <Image
              src={visibleImages[0]}
              alt=""
              fill
              sizes={compact ? '(max-width: 768px) 42vw, 250px' : '(max-width: 768px) 50vw, 350px'}
              quality={90}
              unoptimized
              className="object-cover"
            />
          </button>
          {visibleImages.slice(1).map((url, idx) => (
            <button
              key={url + idx}
              type="button"
              onClick={(e) => handleClick(e, idx + 1)}
              className="relative aspect-square overflow-hidden rounded-lg bg-ink-50 hover:opacity-95 transition-opacity"
            >
              <Image
                src={url}
                alt=""
                fill
                sizes={compact ? '(max-width: 768px) 42vw, 250px' : '(max-width: 768px) 50vw, 350px'}
                quality={100}
                unoptimized
                className="object-cover"
              />
            </button>
          ))}
        </div>
        <ImageLightbox
          images={images}
          currentIndex={lightboxIndex ?? 0}
          isOpen={lightboxIndex !== null}
          onClose={() => setLightboxIndex(null)}
          onChangeIndex={setLightboxIndex}
        />
      </>
    );
  }

  // 4 图：2×2
  if (count === 4) {
    return (
      <>
        <div className={cn('grid grid-cols-2 grid-rows-2 gap-0.5', className)}>
          {visibleImages.map((url, idx) => (
            <button
              key={url + idx}
              type="button"
              onClick={(e) => handleClick(e, idx)}
              className="relative aspect-square overflow-hidden rounded-lg bg-ink-50 hover:opacity-95 transition-opacity"
            >
              <Image
                src={url}
                alt=""
                fill
                sizes={compact ? '(max-width: 768px) 42vw, 250px' : '(max-width: 768px) 50vw, 350px'}
                quality={100}
                unoptimized
                className="object-cover"
              />
            </button>
          ))}
        </div>
        <ImageLightbox
          images={images}
          currentIndex={lightboxIndex ?? 0}
          isOpen={lightboxIndex !== null}
          onClose={() => setLightboxIndex(null)}
          onChangeIndex={setLightboxIndex}
        />
      </>
    );
  }

  // 5+ 图：3 列网格，最多 9 张
  return (
    <>
      <div className={cn('grid grid-cols-3 gap-0.5', className)}>
        {visibleImages.map((url, idx) => {
          const showMore = remaining > 0 && idx === visibleImages.length - 1;
          return (
            <button
              key={url + idx}
              type="button"
              onClick={(e) => handleClick(e, idx)}
              className="relative aspect-square overflow-hidden rounded-lg bg-ink-50 hover:opacity-95 transition-opacity"
            >
              <Image
                src={url}
                alt=""
                fill
                sizes={compact ? '(max-width: 768px) 28vw, 170px' : '(max-width: 768px) 33vw, 230px'}
                quality={100}
                unoptimized
                className="object-cover"
              />
              {showMore && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-sm font-medium">
                  +{remaining}
                </div>
              )}
            </button>
          );
        })}
      </div>
      <ImageLightbox
        images={images}
        currentIndex={lightboxIndex ?? 0}
        isOpen={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
        onChangeIndex={setLightboxIndex}
      />
    </>
  );
}
