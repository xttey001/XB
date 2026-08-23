'use client';

import { useState, useRef, useEffect } from 'react';
import { Clock, X, Calendar, Brain } from 'lucide-react';
import { format, isToday, isTomorrow, isPast } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { api } from '@/lib/api';
import { calcEbbinghausNext, getEbbinghausDays } from '@/lib/utils';

interface NoteReviewButtonProps {
  noteId: string;
  reviewAt: string | null;
  reviewRepeat: string | null;
  reviewStep?: number;
  onUpdated: (note: any) => void;
  onOpenReviewModal?: () => void;
}

const QUICK_OPTIONS = [
  { label: '艾宾浩斯', getDate: () => new Date(Date.now() + 24 * 60 * 60 * 1000), repeat: 'ebbinghaus', step: 0 },
  { label: '每天', getDate: () => new Date(Date.now() + 24 * 60 * 60 * 1000), repeat: 'daily' },
  { label: '明天', getDate: () => { const d = new Date(); d.setDate(d.getDate() + 1); return d; } },
  { label: '3 天后', getDate: () => { const d = new Date(); d.setDate(d.getDate() + 3); return d; } },
  { label: '一周后', getDate: () => { const d = new Date(); d.setDate(d.getDate() + 7); return d; } },
  { label: '两周后', getDate: () => { const d = new Date(); d.setDate(d.getDate() + 14); return d; } },
  { label: '一个月后', getDate: () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d; } },
];

const REPEAT_OPTIONS = [
  { label: '不重复', value: 'none' },
  { label: '艾宾浩斯', value: 'ebbinghaus' },
  { label: '每天', value: 'daily' },
  { label: '每周', value: 'weekly' },
  { label: '每两周', value: 'biweekly' },
  { label: '每月', value: 'monthly' },
];

function formatReviewDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return `今天 ${format(date, 'HH:mm', { locale: zhCN })}`;
  if (isTomorrow(date)) return `明天 ${format(date, 'HH:mm', { locale: zhCN })}`;
  if (isPast(date)) return `已逾期 ${format(date, 'M月d日', { locale: zhCN })}`;
  return format(date, 'M月d日 HH:mm', { locale: zhCN });
}

function calcNextReview(repeat: string, step?: number): Date | null {
  const now = new Date();
  switch (repeat) {
    case 'ebbinghaus': {
      const s = step ?? 0;
      return new Date(now.getTime() + getEbbinghausDays(s) * 24 * 60 * 60 * 1000);
    }
    case 'daily': return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case 'weekly': return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case 'biweekly': return new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    case 'monthly': return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
    default: return null;
  }
}

export default function NoteReviewButton({
  noteId,
  reviewAt,
  reviewRepeat,
  reviewStep = 0,
  onUpdated,
  onOpenReviewModal,
}: NoteReviewButtonProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const [repeat, setRepeat] = useState(reviewRepeat || 'none');
  const [saving, setSaving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setShowCustom(false);
      }
    };
    if (showMenu) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [showMenu]);

  const handleSetReview = async (date: Date | null, repeatOverride?: string, stepOverride?: number) => {
    setSaving(true);
    try {
      const effectiveRepeat = repeatOverride !== undefined ? repeatOverride : repeat;
      const nextRepeat = effectiveRepeat === 'none' ? null : effectiveRepeat;
      if (repeatOverride !== undefined) setRepeat(repeatOverride);

      let effectiveStep = stepOverride;
      if (effectiveRepeat === 'ebbinghaus' && effectiveStep === undefined) {
        effectiveStep = 0;
      }

      const { note } = await api.updateNote(noteId, {
        reviewAt: date ? date.toISOString() : null,
        reviewRepeat: nextRepeat,
        reviewStep: effectiveStep ?? 0,
        reviewLastSent: null,
      });
      onUpdated(note);
      setShowMenu(false);
      setShowCustom(false);
      setCustomDate('');
    } catch (e) {
      alert(e instanceof Error ? e.message : '设置失败');
    } finally {
      setSaving(false);
    }
  };

  const hasReview = !!reviewAt;
  const isEbbinghaus = reviewRepeat === 'ebbinghaus';

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
        className={`p-1.5 rounded-md transition-all border ${
          hasReview
            ? 'text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
            : 'text-ink-500 border-ink-200 hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50'
        }`}
        title={hasReview ? `回顾：${formatReviewDate(reviewAt)}${isEbbinghaus ? `（遗忘曲线第${reviewStep + 1}步）` : ''}` : '设置回顾提醒'}
      >
        {hasReview ? (
          <div className="relative">
            {isEbbinghaus ? <Brain size={15} /> : <Calendar size={15} />}
            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full" />
          </div>
        ) : (
          <Calendar size={15} />
        )}
      </button>

      {hasReview && (
        <span className="sr-only">{formatReviewDate(reviewAt)}</span>
      )}

      {showMenu && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-ink-200 rounded-lg shadow-lg z-30 w-48 p-2">
          {hasReview && (
            <div className="px-2 py-1.5 text-xs text-emerald-600 font-medium bg-emerald-50 rounded mb-1">
              {isEbbinghaus
                ? `遗忘曲线第${reviewStep + 1}步：${getEbbinghausDays(reviewStep)}天后`
                : `当前：${formatReviewDate(reviewAt!)}`
              }
            </div>
          )}

          <div className="text-[10px] text-ink-400 px-2 py-0.5">快速设置</div>
          {QUICK_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              onClick={(e) => {
                e.stopPropagation();
                handleSetReview(opt.getDate(), opt.repeat, opt.step);
              }}
              disabled={saving}
              className="w-full text-left px-2 py-1.5 text-xs text-ink-700 hover:bg-ink-50 rounded disabled:opacity-50 flex items-center justify-between"
            >
              <span>{opt.label}</span>
              {opt.repeat === 'ebbinghaus' && <Brain size={11} className="text-violet-500" />}
              {opt.repeat === 'daily' && <span className="text-emerald-500">🔁</span>}
            </button>
          ))}

          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowCustom(!showCustom);
            }}
            className="w-full text-left px-2 py-1.5 text-xs text-ink-700 hover:bg-ink-50 rounded flex items-center justify-between"
          >
            <span>自定义时间</span>
            <span className="text-ink-300">›</span>
          </button>

          {showCustom && (
            <div className="mt-1 p-2 bg-ink-50 rounded space-y-2">
              <input
                type="datetime-local"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="w-full text-xs px-2 py-1 border border-ink-200 rounded focus:outline-none focus:border-emerald-400"
              />
              {customDate && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSetReview(new Date(customDate));
                  }}
                  className="w-full text-xs bg-emerald-600 text-white py-1 rounded hover:bg-emerald-700"
                >
                  确定
                </button>
              )}
            </div>
          )}

          <div className="border-t border-ink-100 mt-1 pt-1">
            <div className="text-[10px] text-ink-400 px-2 py-0.5">重复频率</div>
            <div className="flex flex-wrap gap-1 px-2 py-1">
              {REPEAT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={(e) => {
                    e.stopPropagation();
                    setRepeat(opt.value);
                    if (hasReview) {
                      const newDate = opt.value === 'ebbinghaus'
                        ? calcNextReview('ebbinghaus', 0)
                        : new Date(reviewAt!);
                      handleSetReview(newDate, opt.value, opt.value === 'ebbinghaus' ? 0 : undefined);
                    }
                  }}
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    repeat === opt.value
                      ? 'bg-emerald-500 text-white'
                      : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {hasReview && (
            <div className="border-t border-ink-100 mt-1 pt-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSetReview(null);
                }}
                className="w-full text-left px-2 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded"
              >
                清除回顾提醒
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
