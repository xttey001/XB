'use client';

import { useState } from 'react';
import { Bell, Plus, X, Clock, Trash2, Check, Calendar } from 'lucide-react';
import { format, isToday, isTomorrow, isPast } from 'date-fns';
import { api } from '@/lib/api';
import type { ReminderDTO } from '@/lib/types';

interface ReminderWidgetProps {
  reminders: ReminderDTO[];
  onCreated: (reminder: ReminderDTO) => void;
  onDeleted: (id: string) => void;
  onCompleted: (id: string) => void;
  onRefresh: () => void;
}

function getDefaultRemindAt(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 30);
  now.setSeconds(0, 0);
  return now.toISOString().slice(0, 16);
}

function formatRemindDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return `今天 ${format(date, 'HH:mm')}`;
  if (isTomorrow(date)) return `明天 ${format(date, 'HH:mm')}`;
  return format(date, 'M月d日 HH:mm');
}

export default function ReminderWidget({
  reminders,
  onCreated,
  onDeleted,
  onCompleted,
  onRefresh,
}: ReminderWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [remindAt, setRemindAt] = useState(getDefaultRemindAt());
  const [submitting, setSubmitting] = useState(false);

  const pendingReminders = reminders.filter((r) => !r.isCompleted);
  const overdueReminders = pendingReminders.filter((r) => {
    const date = r.snoozeUntil ? new Date(r.snoozeUntil) : new Date(r.remindAt);
    return isPast(date);
  });
  const upcomingReminders = pendingReminders.filter((r) => {
    const date = r.snoozeUntil ? new Date(r.snoozeUntil) : new Date(r.remindAt);
    return !isPast(date);
  });

  const handleSubmit = async () => {
    if (!title.trim() || !remindAt) return;
    setSubmitting(true);
    try {
      const { reminder } = await api.createReminder({
        title: title.trim(),
        content: content.trim() || undefined,
        remindAt: new Date(remindAt).toISOString(),
      });
      onCreated(reminder);
      setTitle('');
      setContent('');
      setRemindAt(getDefaultRemindAt());
      setShowForm(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除这个提醒？')) return;
    try {
      await api.deleteReminder(id);
      onDeleted(id);
    } catch (e) {
      alert(e instanceof Error ? e.message : '删除失败');
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await api.completeReminder(id);
      onCompleted(id);
    } catch (e) {
      alert(e instanceof Error ? e.message : '操作失败');
    }
  };

  const priorityOrder = (r: ReminderDTO) => {
    const date = r.snoozeUntil ? new Date(r.snoozeUntil) : new Date(r.remindAt);
    return isPast(date) ? 0 : 1;
  };

  const sortedReminders = [...pendingReminders].sort((a, b) => {
    const aDate = a.snoozeUntil ? new Date(a.snoozeUntil) : new Date(a.remindAt);
    const bDate = b.snoozeUntil ? new Date(b.snoozeUntil) : new Date(b.remindAt);
    return aDate.getTime() - bDate.getTime();
  });

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-ink-600 hover:bg-ink-100 hover:text-ink-800 transition-colors relative"
        title="提醒事项"
      >
        <Bell size={14} />
        <span>提醒</span>
        {pendingReminders.length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
            {pendingReminders.length > 9 ? '9+' : pendingReminders.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-ink-200 z-40 overflow-hidden">
          <div className="p-3 border-b border-ink-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-accent-600" />
              <span className="font-medium text-sm text-ink-800">提醒事项</span>
              {pendingReminders.length > 0 && (
                <span className="text-xs text-ink-400">
                  ({pendingReminders.length} 待处理)
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setShowForm(!showForm);
                  if (showForm) {
                    setTitle('');
                    setContent('');
                    setRemindAt(getDefaultRemindAt());
                  }
                }}
                className="text-xs text-accent-600 hover:text-accent-700 flex items-center gap-0.5"
              >
                <Plus size={12} />
                新建
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-ink-400 hover:text-ink-600"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {showForm && (
            <div className="p-3 bg-ink-50 border-b border-ink-100 space-y-2">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="提醒标题"
                className="w-full text-sm px-3 py-2 border border-ink-200 rounded-md focus:outline-none focus:border-accent-400"
                autoFocus
              />
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="备注（可选）"
                rows={2}
                className="w-full text-sm px-3 py-2 border border-ink-200 rounded-md focus:outline-none focus:border-accent-400 resize-none"
              />
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-xs text-ink-500">
                  <Calendar size={12} />
                  提醒时间
                </div>
                <input
                  type="datetime-local"
                  value={remindAt}
                  onChange={(e) => setRemindAt(e.target.value)}
                  className="flex-1 text-sm px-2 py-1 border border-ink-200 rounded-md focus:outline-none focus:border-accent-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !title.trim()}
                  className="flex-1 text-xs bg-ink-900 text-white py-2 rounded-md hover:bg-ink-800 transition-colors disabled:opacity-50"
                >
                  {submitting ? '创建中...' : '创建提醒'}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-xs text-ink-500 hover:text-ink-700 px-3 py-2"
                >
                  取消
                </button>
              </div>
            </div>
          )}

          <div className="max-h-80 overflow-y-auto">
            {sortedReminders.length === 0 ? (
              <div className="py-10 text-center text-ink-400 text-sm">
                暂无待处理提醒
                <br />
                <button
                  onClick={() => setShowForm(true)}
                  className="text-accent-600 hover:text-accent-700 mt-1 text-xs"
                >
                  点击创建第一个
                </button>
              </div>
            ) : (
              <div className="divide-y divide-ink-50">
                {overdueReminders.length > 0 && (
                  <div className="px-3 py-1.5 text-[11px] text-red-500 font-medium bg-red-50/50">
                    已过期
                  </div>
                )}
                {sortedReminders.map((reminder) => {
                  const date = reminder.snoozeUntil
                    ? new Date(reminder.snoozeUntil)
                    : new Date(reminder.remindAt);
                  const isOverdue = isPast(date);

                  return (
                    <div
                      key={reminder.id}
                      className={`px-3 py-2.5 hover:bg-ink-50 ${
                        isOverdue ? 'border-l-2 border-l-red-400' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-ink-800 break-words">
                            {reminder.title}
                          </p>
                          {reminder.content && (
                            <p className="text-xs text-ink-500 mt-0.5 line-clamp-1">
                              {reminder.content}
                            </p>
                          )}
                          <p
                            className={`text-xs mt-1 flex items-center gap-1 ${
                              isOverdue
                                ? 'text-red-500'
                                : 'text-ink-400'
                            }`}
                          >
                            <Clock size={10} />
                            {formatRemindDate(
                              reminder.snoozeUntil || reminder.remindAt
                            )}
                            {reminder.snoozeUntil && (
                              <span className="text-amber-500 ml-1">
                                (已延后)
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleComplete(reminder.id)}
                            className="p-1 text-green-500 hover:bg-green-50 rounded"
                            title="标记完成"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(reminder.id)}
                            className="p-1 text-ink-400 hover:text-red-500 hover:bg-red-50 rounded"
                            title="删除"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-2 border-t border-ink-100 bg-ink-50">
            <button
              onClick={onRefresh}
              className="w-full text-xs text-ink-500 hover:text-ink-700 py-1.5"
            >
              刷新列表
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
