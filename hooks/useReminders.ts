'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import type { ReminderDTO, NoteDTO } from '@/lib/types';
import { calcEbbinghausNext, getEbbinghausDays } from '@/lib/utils';

export function useReminders() {
  const [reminders, setReminders] = useState<ReminderDTO[]>([]);
  const [dueReminders, setDueReminders] = useState<ReminderDTO[]>([]);
  const [showModal, setShowModal] = useState(false);

  const [reviewNotes, setReviewNotes] = useState<NoteDTO[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);

  const [loading, setLoading] = useState(false);
  const displayedReminderIdsRef = useRef<Set<string>>(new Set());
  const displayedReviewNoteIdsRef = useRef<Set<string>>(new Set());
  const isReviewingAllRef = useRef(false);  // 一键回顾进行中，阻止定时器弹出

  const calcNextReview = useCallback((repeat: string, step?: number): Date | null => {
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
  }, []);

  const fetchReminders = useCallback(async () => {
    setLoading(true);
    try {
      const { reminders: data } = await api.listReminders('pending');
      setReminders(data);

      const now = new Date();
      const due = data.filter((r) => {
        const remindAt = new Date(r.remindAt);
        if (remindAt > now) return false;
        if (r.snoozeUntil) {
          const snooze = new Date(r.snoozeUntil);
          return snooze <= now;
        }
        return true;
      });

      const newDueIds = due.map((r) => r.id);
      const hasNewDue = newDueIds.some((id) => !displayedReminderIdsRef.current.has(id));

      if (hasNewDue && due.length > 0) {
        setDueReminders(due);
        setShowModal(true);
      }
    } catch (e) {
      console.error('Failed to fetch reminders:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchReviewNotes = useCallback(async () => {
    try {
      const { notes: data } = await api.listNotes({ reviewDue: true });
      setReviewNotes(data);

      const now = new Date();
      const due = data.filter((n) => n.reviewAt && new Date(n.reviewAt) <= now);

      const newDueIds = due.map((n) => n.id);
      const hasNewDue = newDueIds.some((id) => !displayedReviewNoteIdsRef.current.has(id));

      // 一键回顾进行中 → 跳过自动弹出，避免竞态
      if (isReviewingAllRef.current) return;

      if (hasNewDue && due.length > 0) {
        // 记录已弹出的 ID，避免下次定时器重复弹
        newDueIds.forEach((id) => displayedReviewNoteIdsRef.current.add(id));
        setShowReviewModal(true);
      }

      // 标记已发送的笔记，避免重复弹出
      due.forEach(async (n) => {
        try {
          await api.updateNote(n.id, {
            reviewLastSent: new Date().toISOString(),
          });
        } catch {}
      });
    } catch (e) {
      console.error('Failed to fetch review notes:', e);
    }
  }, []);

  useEffect(() => {
    fetchReminders();
    fetchReviewNotes();
    const interval = setInterval(() => {
      fetchReminders();
      fetchReviewNotes();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchReminders, fetchReviewNotes]);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setDueReminders([]);
    displayedReminderIdsRef.current.clear();
  }, []);

  const closeReviewModal = useCallback(() => {
    setShowReviewModal(false);
    setReviewNotes([]);
  }, []);

  const completeReminder = useCallback(async (id: string) => {
    try {
      await api.completeReminder(id);
      setReminders((prev) => prev.filter((r) => r.id !== id));
      setDueReminders((prev) => prev.filter((r) => r.id !== id));
      if (dueReminders.length <= 1) closeModal();
    } catch (e) {
      console.error('Failed to complete reminder:', e);
    }
  }, [dueReminders.length, closeModal]);

  const snoozeReminder = useCallback(async (id: string, minutes: number) => {
    try {
      await api.snoozeReminder(id, minutes);
      setDueReminders((prev) => prev.filter((r) => r.id !== id));
      if (dueReminders.length <= 1) closeModal();
    } catch (e) {
      console.error('Failed to snooze reminder:', e);
    }
  }, [dueReminders.length, closeModal]);

  const dismissReminder = useCallback((id: string) => {
    displayedReminderIdsRef.current.delete(id);
    setDueReminders((prev) => prev.filter((r) => r.id !== id));
    if (dueReminders.length <= 1) closeModal();
  }, [dueReminders.length, closeModal]);

  const markNoteReviewed = useCallback(async (noteId: string, nextReviewAt?: Date | null, nextStep?: number) => {
    try {
      const note = reviewNotes.find((n) => n.id === noteId);

      let updateData: {
        reviewAt?: string | null;
        reviewStep?: number;
        reviewLastSent?: string | null;
      } = { reviewLastSent: null };

      if (nextReviewAt !== undefined && nextReviewAt !== null) {
        updateData.reviewAt = nextReviewAt.toISOString();
      } else if (nextReviewAt === null) {
        updateData.reviewAt = null;
      } else if (note?.reviewRepeat && note.reviewRepeat !== 'none') {
        if (note.reviewRepeat === 'ebbinghaus') {
          const { date, nextStep: ns } = calcEbbinghausNext(note.reviewStep ?? 0);
          updateData.reviewAt = date.toISOString();
          updateData.reviewStep = ns;
        } else {
          const nextDate = calcNextReview(note.reviewRepeat, note.reviewStep);
          updateData.reviewAt = nextDate ? nextDate.toISOString() : null;
        }
      } else {
        updateData.reviewAt = null;
      }

      if (nextStep !== undefined) {
        updateData.reviewStep = nextStep;
      }

      await api.updateNote(noteId, updateData);

      setReviewNotes((prev) => prev.filter((n) => n.id !== noteId));
      displayedReviewNoteIdsRef.current.delete(noteId);

      if (reviewNotes.length <= 1) {
        setShowReviewModal(false);
      }
    } catch (e) {
      console.error('Failed to mark note as reviewed:', e);
    }
  }, [reviewNotes, calcNextReview]);

  // 一键全部回顾：逐条按各自重复规则续期
  const reviewAllNotes = useCallback(async () => {
    const currentNotes = [...reviewNotes];
    // 乐观更新
    setReviewNotes([]);
    setShowReviewModal(false);
    displayedReviewNoteIdsRef.current.clear();  // 清掉，下次刷新重新判断
    isReviewingAllRef.current = true;  // 进入静默期，阻止定时器弹出

    try {
      await Promise.all(
        currentNotes.map((note) => {
          let nextReviewAt: Date | null = null;
          let nextStep: number | undefined = undefined;

          if (note.reviewRepeat && note.reviewRepeat !== 'none') {
            if (note.reviewRepeat === 'ebbinghaus') {
              const { date, nextStep: ns } = calcEbbinghausNext(note.reviewStep ?? 0);
              nextReviewAt = date;
              nextStep = ns;
            } else {
              nextReviewAt = calcNextReview(note.reviewRepeat, note.reviewStep);
            }
          }

          const updateData: {
            reviewAt?: string | null;
            reviewStep?: number;
            reviewLastSent?: string | null;
          } = { reviewLastSent: null };

          if (nextReviewAt) {
            updateData.reviewAt = nextReviewAt.toISOString();
          } else {
            updateData.reviewAt = null;
          }
          if (nextStep !== undefined) {
            updateData.reviewStep = nextStep;
          }

          return api.updateNote(note.id, updateData);
        })
      );

      // 所有 API 完成后，主动刷新一次后端数据，确保没有残留
      await fetchReviewNotes();
    } finally {
      isReviewingAllRef.current = false;  // 解除静默
    }
  }, [reviewNotes, calcNextReview, fetchReviewNotes]);

  // 稍后再看：10 分钟后自动再弹出
  const snoozeReviewNotes = useCallback(() => {
    setShowReviewModal(false);
    // 用定时器，10 分钟后重新弹出（reviewNotes 保持不变，让用户稍后看到同样的列表）
    const snoozeMs = 10 * 60 * 1000;
    setTimeout(() => {
      setShowReviewModal(true);
    }, snoozeMs);
  }, []);

  const addReminder = useCallback((reminder: ReminderDTO) => {
    setReminders((prev) => [...prev, reminder]);
  }, []);

  const removeReminder = useCallback((id: string) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const refresh = useCallback(() => {
    fetchReminders();
    fetchReviewNotes();
  }, [fetchReminders, fetchReviewNotes]);

  return {
    reminders,
    dueReminders,
    showModal,
    loading,
    closeModal,
    completeReminder,
    snoozeReminder,
    dismissReminder,

    reviewNotes,
    showReviewModal,
    closeReviewModal,
    markNoteReviewed,
    reviewAllNotes,
    snoozeReviewNotes,

    addReminder,
    removeReminder,
    refresh,
  };
}
