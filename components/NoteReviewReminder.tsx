'use client';

import { useState } from 'react';
import { X, BookOpen, Clock, ChevronRight, Check, RotateCcw, Link, Brain } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { NoteDTO } from '@/lib/types';
import RichTextRenderer from './RichTextRenderer';
import { api } from '@/lib/api';
import { calcEbbinghausNext, getEbbinghausDays } from '@/lib/utils';

interface NoteReviewReminderProps {
  notes: NoteDTO[];
  onClose: () => void;
  onReviewed: (noteId: string, nextReviewAt?: Date | null, nextStep?: number) => void;
  onNavigate: (noteId: string) => void;
  onReviewAll?: () => void;
  onSnooze?: () => void;
}

const QUICK_REVIEW_OPTIONS = [
  { label: '明天', days: 1 },
  { label: '3 天后', days: 3 },
  { label: '一周后', days: 7 },
  { label: '两周后', days: 14 },
  { label: '一个月后', days: 30 },
];

const REVIEW_REPEAT_OPTIONS = [
  { label: '不重复', value: 'none' },
  { label: '艾宾浩斯', value: 'ebbinghaus' },
  { label: '每天', value: 'daily' },
  { label: '每周', value: 'weekly' },
  { label: '每两周', value: 'biweekly' },
  { label: '每月', value: 'monthly' },
];

function calcNextReview(repeat: string, step?: number): Date | null {
  const now = new Date();
  switch (repeat) {
    case 'ebbinghaus': {
      const s = step ?? 0;
      return new Date(now.getTime() + getEbbinghausDays(s) * 24 * 60 * 60 * 1000);
    }
    case 'daily':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case 'weekly':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case 'biweekly':
      return new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    case 'monthly':
      return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
    default:
      return null;
  }
}

export default function NoteReviewReminder({
  notes,
  onClose,
  onReviewed,
  onNavigate,
  onReviewAll,
  onSnooze,
}: NoteReviewReminderProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [settingId, setSettingId] = useState<string | null>(null);
  const [customDate, setCustomDate] = useState('');
  const [repeatForId, setRepeatForId] = useState<string | null>(null);
  const [reviewingAll, setReviewingAll] = useState(false);

  const handleReviewed = async (note: NoteDTO) => {
    let nextReviewAt: Date | null = null;
    let nextStep: number | undefined = undefined;

    if (repeatForId === note.id && note.reviewRepeat && note.reviewRepeat !== 'none') {
      if (note.reviewRepeat === 'ebbinghaus') {
        const { date, nextStep: ns } = calcEbbinghausNext(note.reviewStep ?? 0);
        nextReviewAt = date;
        nextStep = ns;
      } else {
        nextReviewAt = calcNextReview(note.reviewRepeat, note.reviewStep);
      }
    }
    onReviewed(note.id, nextReviewAt, nextStep);
  };

  const handleQuickReview = async (note: NoteDTO, days: number) => {
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + days);
    onReviewed(note.id, nextDate);
  };

  if (notes.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-[fadeIn_0.2s_ease-out]">
        <div className="bg-emerald-700 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-emerald-300" />
            <h3 className="font-medium text-sm">笔记回顾提醒</h3>
            <span className="bg-white/20 text-xs px-2 py-0.5 rounded-full">
              {notes.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto">
          {notes.map((note) => {
            const isExpanded = expandedId === note.id;
            const isSetting = settingId === note.id;
            const overdue = note.reviewAt && new Date(note.reviewAt) < new Date();
            const isEbbinghaus = note.reviewRepeat === 'ebbinghaus';

            return (
              <div
                key={note.id}
                className="border-b border-ink-100 last:border-0"
              >
                <div className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                      {isEbbinghaus ? <Brain size={14} /> : <BookOpen size={14} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => onNavigate(note.id)}
                          className="font-medium text-ink-900 text-sm hover:text-accent-600 transition-colors text-left break-all"
                        >
                          {note.summary || note.content.replace(/<[^>]*>/g, '').slice(0, 60)}
                        </button>
                        {overdue && (
                          <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
                            已逾期
                          </span>
                        )}
                        {isEbbinghaus && (
                          <span className="text-[10px] bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <Brain size={9} /> 第{(note.reviewStep ?? 0) + 1}步
                          </span>
                        )}
                      </div>

                      {note.category && (
                        <span
                          className="inline-block text-[10px] mt-0.5 px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: `${note.category.color}20`,
                            color: note.category.color,
                          }}
                        >
                          {note.category.name}
                        </span>
                      )}

                      <p className="text-xs text-ink-500 mt-1 flex items-center gap-1">
                        <Clock size={10} />
                        回顾时间：
                        {note.reviewAt
                          ? format(new Date(note.reviewAt), 'yyyy年M月d日 HH:mm', {
                              locale: zhCN,
                            })
                          : '未设置'}
                      </p>

                      {isExpanded && (
                        <div className="mt-3 p-3 bg-ink-50 rounded text-sm max-h-40 overflow-y-auto">
                          <RichTextRenderer content={note.content} />
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <button
                          onClick={() =>
                            setExpandedId(isExpanded ? null : note.id)
                          }
                          className="text-xs text-ink-500 hover:text-ink-700 flex items-center gap-1"
                        >
                          {isExpanded ? '收起内容' : '预览内容'}
                        </button>

                        <button
                          onClick={() => onNavigate(note.id)}
                          className="text-xs text-accent-600 hover:text-accent-700 flex items-center gap-1"
                        >
                          <Link size={11} />
                          打开笔记
                        </button>

                        <button
                          onClick={() =>
                            setSettingId(isSetting ? null : note.id)
                          }
                          className="text-xs text-ink-500 hover:text-ink-700 flex items-center gap-1"
                        >
                          <RotateCcw size={11} />
                          重新设置
                        </button>

                        <div className="ml-auto flex items-center gap-1">
                          <button
                            onClick={() => handleReviewed(note)}
                            className="text-xs text-green-600 hover:text-green-700 flex items-center gap-0.5 font-medium"
                          >
                            <Check size={12} />
                            已回顾
                          </button>
                        </div>
                      </div>

                      {isSetting && (
                        <div className="mt-3 p-3 bg-ink-50 rounded-lg space-y-2">
                          <div className="text-xs text-ink-600 font-medium">
                            快速设置下次回顾
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {QUICK_REVIEW_OPTIONS.map((opt) => (
                              <button
                                key={opt.days}
                                onClick={() => handleQuickReview(note, opt.days)}
                                className="text-xs px-2.5 py-1 bg-white border border-ink-200 rounded hover:border-emerald-400 hover:text-emerald-600 transition-colors"
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <span className="text-xs text-ink-500">自定义:</span>
                            <input
                              type="date"
                              value={customDate}
                              onChange={(e) => setCustomDate(e.target.value)}
                              className="text-xs px-2 py-1 border border-ink-200 rounded focus:outline-none focus:border-emerald-400"
                            />
                            <button
                              onClick={() => {
                                if (customDate) {
                                  const d = new Date(customDate);
                                  onReviewed(note.id, d);
                                  setCustomDate('');
                                }
                              }}
                              className="text-xs text-emerald-600 hover:text-emerald-700"
                            >
                              确定
                            </button>
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <span className="text-xs text-ink-500">重复:</span>
                            <div className="flex flex-wrap gap-1">
                              {REVIEW_REPEAT_OPTIONS.map((opt) => (
                                <button
                                  key={opt.value}
                                  onClick={() => {
                                    setRepeatForId(
                                      repeatForId === note.id &&
                                        repeatForId === opt.value
                                        ? null
                                        : `${note.id}:${opt.value}`
                                    );
                                    onReviewed(note.id);
                                  }}
                                  className={`text-xs px-2 py-0.5 rounded ${
                                    repeatForId === `${note.id}:${opt.value}`
                                      ? 'bg-emerald-500 text-white'
                                      : 'bg-white border border-ink-200 text-ink-600 hover:border-emerald-400'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-5 py-3 bg-ink-50 border-t border-ink-100 flex items-center justify-between">
          <button
            onClick={onSnooze ?? onClose}
            className="text-xs text-ink-500 hover:text-ink-700 flex items-center gap-1"
          >
            稍后再看 · 10 分钟后提醒
          </button>
          {onReviewAll && (
            <button
              onClick={async () => {
                if (reviewingAll) return;
                setReviewingAll(true);
                try {
                  await onReviewAll();
                } finally {
                  setReviewingAll(false);
                }
              }}
              disabled={reviewingAll}
              className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white px-3 py-1.5 rounded-md font-medium transition-colors"
            >
              <Check size={13} />
              {reviewingAll ? '回顾中...' : `一键全部回顾 (${notes.length})`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
