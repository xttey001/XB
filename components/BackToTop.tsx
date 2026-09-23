'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowUp } from 'lucide-react';

const THRESHOLD = 300;

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > THRESHOLD);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <button
      onClick={scrollToTop}
      aria-label="回到顶部"
      className={[
        'fixed right-5 bottom-6 z-50',
        'w-10 h-10 rounded-full',
        'bg-white shadow-lg shadow-ink-900/10 border border-ink-200',
        'flex items-center justify-center',
        'hover:bg-ink-50 hover:shadow-xl transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-accent-400/50',
        visible
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 translate-y-3 pointer-events-none',
      ].join(' ')}
    >
      <ArrowUp size={18} className="text-ink-600" strokeWidth={2.2} />
    </button>
  );
}
