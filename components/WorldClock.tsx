'use client';

import { useState, useEffect } from 'react';

const timezones = [
  { label: '北京时间', zone: 'Asia/Shanghai', flag: '🇨🇳' },
  { label: '美东时间', zone: 'America/New_York', flag: '🇺🇸' },
];

function formatTime(date: Date, zone: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: zone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

function formatFullDate(date: Date, zone: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
  }).format(date);
}

export default function WorldClock() {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-4">
      {timezones.map((tz) => (
        <div
          key={tz.zone}
          className="bg-white rounded-xl border border-ink-200 p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{tz.flag}</span>
            <span className="text-sm font-medium text-ink-600">
              {tz.label}
            </span>
          </div>
          <div className="font-mono tabular-nums text-2xl font-semibold text-ink-900 tracking-wider">
            {mounted ? formatTime(now, tz.zone) : '--:--:--'}
          </div>
          <div className="text-xs text-ink-500 mt-1">
            {mounted ? formatFullDate(now, tz.zone) : '----年--月--日'}
          </div>
        </div>
      ))}
    </div>
  );
}
