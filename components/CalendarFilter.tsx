'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  X,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DailyStatsDTO } from '@/lib/types';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  addYears,
  subYears,
  setYear,
  setMonth,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  isAfter,
  isBefore,
  getYear,
} from 'date-fns';

export type DateSelection =
  | { type: 'single'; date: string }
  | { type: 'range'; start: string; end: string }
  | null;

interface CalendarFilterProps {
  value: DateSelection;
  onChange: (value: DateSelection) => void;
  onMonthChange?: (date: Date) => void;
  stats?: DailyStatsDTO[];
}

type Mode = 'single' | 'range';
type View = 'days' | 'months' | 'years';

const MONTHS = [
  '1月', '2月', '3月', '4月', '5月', '6月',
  '7月', '8月', '9月', '10月', '11月', '12月',
];

export default function CalendarFilter({ value, onChange, onMonthChange, stats }: CalendarFilterProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [mode, setMode] = useState<Mode>(value?.type || 'single');
  const [view, setView] = useState<View>('days');
  const [yearPage, setYearPage] = useState(getYear(new Date()));

  // 内部草稿状态，避免未完成选择时频繁触发外部筛选
  const [single, setSingle] = useState<string | null>(
    value?.type === 'single' ? value.date : null
  );
  const [range, setRange] = useState<{ start: string | null; end: string | null }>({
    start: value?.type === 'range' ? value.start : null,
    end: value?.type === 'range' ? value.end : null,
  });

  // 外部 value 变化时同步内部状态
  useEffect(() => {
    if (!value) {
      setMode('single');
      setSingle(null);
      setRange({ start: null, end: null });
      return;
    }
    setMode(value.type);
    if (value.type === 'single') {
      setSingle(value.date);
      setRange({ start: null, end: null });
    } else {
      setRange({ start: value.start, end: value.end });
      setSingle(null);
    }
  }, [value]);

  const selectedDate = single ? new Date(single) : null;
  const rangeStart = range.start ? new Date(range.start) : null;
  const rangeEnd = range.end ? new Date(range.end) : null;

  const statsMap = useMemo(() => {
    const map = new Map<string, DailyStatsDTO>();
    stats?.forEach((s) => map.set(s.date, s));
    return map;
  }, [stats]);

  const changeMonth = (next: Date) => {
    setCurrentMonth(next);
    onMonthChange?.(next);
  };

  const weeks = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    const days: Date[] = [];
    let day = start;
    while (isBefore(day, addDays(end, 1))) {
      days.push(day);
      day = addDays(day, 1);
    }
    const result: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      result.push(days.slice(i, i + 7));
    }
    return result;
  }, [currentMonth]);

  const switchMode = (next: Mode) => {
    setMode(next);
    if (next === 'single') {
      // 范围 -> 单日：把范围开始日期作为单日
      if (range.start) {
        setSingle(range.start);
        setRange({ start: null, end: null });
        onChange({ type: 'single', date: range.start });
      } else {
        setSingle(null);
        onChange(null);
      }
    } else {
      // 单日 -> 范围：把单日作为范围开始
      if (single) {
        setRange({ start: single, end: null });
        setSingle(null);
        onChange({ type: 'range', start: single, end: '' });
      } else {
        setRange({ start: null, end: null });
      }
    }
  };

  const handleDayClick = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');

    if (mode === 'single') {
      if (single === dateStr) {
        setSingle(null);
        onChange(null);
      } else {
        setSingle(dateStr);
        onChange({ type: 'single', date: dateStr });
      }
      return;
    }

    // 范围模式
    if (!range.start || (range.start && range.end)) {
      // 开始新范围
      setRange({ start: dateStr, end: null });
      onChange({ type: 'range', start: dateStr, end: '' });
    } else {
      // 完成范围选择
      if (!range.start) return;
      let start = new Date(range.start);
      let end = date;
      if (isAfter(start, end)) [start, end] = [end, start];
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');
      setRange({ start: startStr, end: endStr });
      onChange({ type: 'range', start: startStr, end: endStr });
    }
  };

  const handleMonthClick = (monthIdx: number) => {
    const next = setMonth(currentMonth, monthIdx);
    changeMonth(next);
    setView('days');
  };

  const handleYearClick = (year: number) => {
    const next = setYear(currentMonth, year);
    changeMonth(next);
    setView('months');
  };

  const isInRange = (date: Date) => {
    if (!rangeStart) return false;
    const end = rangeEnd;
    if (!end) return isSameDay(date, rangeStart);
    let start = rangeStart;
    let e = rangeEnd;
    if (isAfter(start, e)) [start, e] = [e, start];
    return (
      (isAfter(date, start) || isSameDay(date, start)) &&
      (isBefore(date, e) || isSameDay(date, e))
    );
  };

  const isRangeStart = (date: Date) =>
    rangeStart && isSameDay(date, rangeStart);
  const isRangeEnd = (date: Date) =>
    rangeEnd && isSameDay(date, rangeEnd);

  const weekDays = ['一', '二', '三', '四', '五', '六', '日'];
  const hasValue = Boolean(value);

  const startYear = yearPage - 6;
  const endYear = yearPage + 5;

  return (
    <div className="rounded-lg border border-ink-200 bg-white p-3 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-xs font-medium text-ink-700">
          <CalendarIcon size={13} className="text-accent-600" />
          <span>按日期筛选</span>
        </div>
        {hasValue && (
          <button
            onClick={() => {
              setSingle(null);
              setRange({ start: null, end: null });
              onChange(null);
            }}
            className="text-[11px] text-ink-400 hover:text-ink-600 flex items-center gap-0.5"
          >
            <X size={11} />
            清除
          </button>
        )}
      </div>

      {/* 单日 / 范围 切换 */}
      <div className="flex rounded-md bg-ink-100 p-0.5 mb-3">
        <button
          onClick={() => switchMode('single')}
          className={cn(
            'flex-1 text-[11px] py-1 rounded transition-colors',
            mode === 'single'
              ? 'bg-white text-ink-800 shadow-sm'
              : 'text-ink-500 hover:text-ink-700'
          )}
        >
          单日
        </button>
        <button
          onClick={() => switchMode('range')}
          className={cn(
            'flex-1 text-[11px] py-1 rounded transition-colors',
            mode === 'range'
              ? 'bg-white text-ink-800 shadow-sm'
              : 'text-ink-500 hover:text-ink-700'
          )}
        >
          范围
        </button>
      </div>

      {/* 头部：月份切换 / 年月选择 */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => {
            if (view === 'days') changeMonth(subMonths(currentMonth, 1));
            else if (view === 'months') changeMonth(subYears(currentMonth, 1));
            else setYearPage((y) => y - 12);
          }}
          className="p-1 rounded hover:bg-ink-100 text-ink-500"
        >
          <ChevronLeft size={14} />
        </button>

        <button
          onClick={() => {
            if (view === 'days') {
              setView('months');
            } else if (view === 'months') {
              setYearPage(getYear(currentMonth));
              setView('years');
            }
            // years 视图下保持当前视图
          }}
          className="text-xs font-medium text-ink-700 hover:text-accent-600 flex items-center gap-0.5"
        >
          {view === 'days' && format(currentMonth, 'yyyy年MM月')}
          {view === 'months' && format(currentMonth, 'yyyy年')}
          {view === 'years' && `${startYear} - ${endYear}`}
          {view !== 'years' && <ChevronDown size={12} />}
        </button>

        <button
          onClick={() => {
            if (view === 'days') changeMonth(addMonths(currentMonth, 1));
            else if (view === 'months') changeMonth(addYears(currentMonth, 1));
            else setYearPage((y) => y + 12);
          }}
          className="p-1 rounded hover:bg-ink-100 text-ink-500"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* 日视图 */}
      {view === 'days' && (
        <>
          {/* 星期头 */}
          <div className="grid grid-cols-7 mb-1">
            {weekDays.map((d) => (
              <div key={d} className="text-center text-[10px] text-ink-400 py-1">
                {d}
              </div>
            ))}
          </div>

          {/* 日期网格 */}
          <div className="space-y-0.5">
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7">
                {week.map((date) => {
                  const inMonth = isSameMonth(date, currentMonth);
                  const selected = selectedDate && isSameDay(date, selectedDate);
                  const inRange = isInRange(date);
                  const rangeStartFlag = isRangeStart(date);
                  const rangeEndFlag = isRangeEnd(date);
                  const dateStr = format(date, 'yyyy-MM-dd');
                  const dayStat = statsMap.get(dateStr);

                  return (
                    <button
                      key={date.toISOString()}
                      onClick={() => handleDayClick(date)}
                      title={mode === 'range' ? '选择范围起始/结束日期' : '选择单日'}
                      className={cn(
                        'relative h-8 text-[11px] flex items-center justify-center transition-colors',
                        !inMonth && 'text-ink-300',
                        inMonth && 'text-ink-700 hover:bg-ink-100',
                        isToday(date) && 'font-semibold text-accent-600',
                        selected && 'bg-accent-500 text-white rounded-md hover:bg-accent-600',
                        inRange && !selected && 'bg-accent-50 text-accent-700',
                        rangeStartFlag && !selected && 'rounded-l-md',
                        rangeEndFlag && !selected && 'rounded-r-md'
                      )}
                    >
                      <span className="relative z-10">{format(date, 'd')}</span>
                      {dayStat && dayStat.count > 0 && (
                        <span className="absolute top-0.5 right-1 text-[8px] leading-none text-ink-400 font-medium">
                          {dayStat.count}
                        </span>
                      )}
                      {dayStat && (
                        <span className="absolute bottom-0.5 left-0 right-0 flex justify-center gap-0.5">
                          {dayStat.important > 0 && (
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: '#3B82F6' }}
                            />
                          )}
                          {dayStat.veryImportant > 0 && (
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: '#EC4899' }}
                            />
                          )}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}

      {/* 月视图 */}
      {view === 'months' && (
        <div className="grid grid-cols-3 gap-1.5 py-1">
          {MONTHS.map((label, idx) => (
            <button
              key={label}
              onClick={() => handleMonthClick(idx)}
              className={cn(
                'text-xs py-2 rounded-md transition-colors',
                isSameMonth(setMonth(currentMonth, idx), currentMonth) &&
                  getYear(currentMonth) === getYear(setMonth(currentMonth, idx))
                  ? 'bg-accent-500 text-white hover:bg-accent-600'
                  : 'bg-ink-50 text-ink-700 hover:bg-ink-100'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* 年视图 */}
      {view === 'years' && (
        <div className="grid grid-cols-4 gap-1.5 py-1">
          {Array.from({ length: 12 }, (_, i) => startYear + i).map((year) => (
            <button
              key={year}
              onClick={() => handleYearClick(year)}
              className={cn(
                'text-xs py-2 rounded-md transition-colors',
                year === getYear(currentMonth)
                  ? 'bg-accent-500 text-white hover:bg-accent-600'
                  : 'bg-ink-50 text-ink-700 hover:bg-ink-100'
              )}
            >
              {year}
            </button>
          ))}
        </div>
      )}

      {/* 当前选择提示 */}
      {value && (
        <div className="mt-2 text-[11px] text-ink-500 bg-ink-50 rounded px-2 py-1.5">
          {value.type === 'single'
            ? `已选：${value.date}`
            : value.end
            ? `已选范围：${value.start} 至 ${value.end}`
            : `已选开始：${value.start}，请选择结束日期`}
        </div>
      )}
    </div>
  );
}



