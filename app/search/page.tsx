'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import SearchPageContent from './SearchPageContent';

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-ink-400">
          <Loader2 className="animate-spin" size={20} />
        </div>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}
