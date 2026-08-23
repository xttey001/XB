'use client';

import { useState } from 'react';
import { X, Bell, Check, Clock, Play, Volume2 } from 'lucide-react';
import type { ReminderDTO } from '@/lib/types';
import { format } from 'date-fns';

interface ReminderModalProps {
  reminders: ReminderDTO[];
  onClose: () => void;
  onComplete: (id: string) => void;
  onSnooze: (id: string, minutes: number) => void;
  onDismiss: (id: string) => void;
}

const SNOOZE_OPTIONS = [
  { label: '10 分钟后', value: 10 },
  { label: '30 分钟后', value: 30 },
  { label: '1 小时后', value: 60 },
];

export default function ReminderModal({
  reminders,
  onClose,
  onComplete,
  onSnooze,
  onDismiss,
}: ReminderModalProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [snoozeForId, setSnoozeForId] = useState<string | null>(null);
  const [customMinutes, setCustomMinutes] = useState('');

  const handleCustomSnooze = (id: string) => {
    const mins = parseInt(customMinutes, 10);
    if (mins > 0) {
      onSnooze(id, mins);
      setCustomMinutes('');
      setSnoozeForId(null);
    }
  };

  if (reminders.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-[fadeIn_0.2s_ease-out]">
        <div className="bg-ink-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-accent-400" />
            <h3 className="font-medium text-sm">重要提醒</h3>
            <span className="bg-white/20 text-xs px-2 py-0.5 rounded-full">
              {reminders.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {reminders.map((reminder) => {
            const isExpanded = expandedId === reminder.id;
            const hasSnooze = snoozeForId === reminder.id;

            return (
              <div
                key={reminder.id}
                className="border-b border-ink-100 last:border-0"
              >
                <div className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-accent-50 text-accent-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Clock size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-ink-900 text-sm break-words">
                        {reminder.title}
                      </h4>
                      <p className="text-xs text-ink-500 mt-0.5">
                        {format(new Date(reminder.remindAt), 'yyyy年M月d日 HH:mm')}
                        {reminder.snoozeUntil && (
                          <span className="ml-2 text-amber-600">
                            稍后提醒至 {format(new Date(reminder.snoozeUntil), 'HH:mm')}
                          </span>
                        )}
                      </p>

                      {isExpanded && reminder.content && (
                        <p className="text-sm text-ink-600 mt-2 whitespace-pre-wrap break-words">
                          {reminder.content}
                        </p>
                      )}

                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        {reminder.content && (
                          <button
                            onClick={() =>
                              setExpandedId(isExpanded ? null : reminder.id)
                            }
                            className="text-xs text-ink-500 hover:text-ink-700 flex items-center gap-1"
                          >
                            {isExpanded ? '收起' : '查看详情'}
                          </button>
                        )}

                        <div className="relative">
                          <button
                            onClick={() =>
                              setSnoozeForId(hasSnooze ? null : reminder.id)
                            }
                            className="text-xs text-ink-500 hover:text-ink-700 flex items-center gap-1"
                          >
                            <Volume2 size={11} />
                            稍后提醒
                          </button>

                          {hasSnooze && (
                            <div className="absolute left-0 top-full mt-1 bg-white border border-ink-200 rounded-lg shadow-lg p-2 z-10 w-40">
                              {SNOOZE_OPTIONS.map((opt) => (
                                <button
                                  key={opt.value}
                                  onClick={() => {
                                    onSnooze(reminder.id, opt.value);
                                    setSnoozeForId(null);
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-xs text-ink-700 hover:bg-ink-50 rounded"
                                >
                                  {opt.label}
                                </button>
                              ))}
                              <div className="border-t border-ink-100 mt-1 pt-1 px-2 pb-1">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="1"
                                    placeholder="自定义"
                                    value={customMinutes}
                                    onChange={(e) => setCustomMinutes(e.target.value)}
                                    className="flex-1 text-xs px-2 py-1 border border-ink-200 rounded focus:outline-none focus:border-accent-400 w-20"
                                  />
                                  <button
                                    onClick={() => handleCustomSnooze(reminder.id)}
                                    className="text-xs text-accent-600 hover:text-accent-700"
                                  >
                                    确定
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 ml-auto">
                          <button
                            onClick={() => onDismiss(reminder.id)}
                            className="text-xs text-ink-400 hover:text-ink-600"
                          >
                            忽略
                          </button>
                          <button
                            onClick={() => onComplete(reminder.id)}
                            className="text-xs text-green-600 hover:text-green-700 flex items-center gap-0.5 font-medium"
                          >
                            <Check size={12} />
                            完成
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-5 py-3 bg-ink-50 border-t border-ink-100 flex items-center justify-between">
          <span className="text-xs text-ink-500">
            共 {reminders.length} 条待处理提醒
          </span>
          <button
            onClick={onClose}
            className="text-xs text-ink-500 hover:text-ink-700"
          >
            全部关闭
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
