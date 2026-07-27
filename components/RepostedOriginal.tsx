'use client';

import Link from 'next/link';
import { User } from 'lucide-react';
import type { NoteDTO } from '@/lib/types';
import { cn, formatRelativeTime } from '@/lib/utils';
import RichTextRenderer from './RichTextRenderer';
import TwitterImageGrid from './TwitterImageGrid';

interface RepostedOriginalProps {
  note: NoteDTO;
  compact?: boolean;
}

export default function RepostedOriginal({ note, compact = false }: RepostedOriginalProps) {
  return (
    <>
      <Link
        href={`/note/${note.id}`}
        className={cn(
          'block rounded-lg border border-ink-200 bg-white hover:border-accent-400 transition-colors',
          compact ? 'p-3' : 'p-4'
        )}
      >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-5 h-5 rounded-full bg-accent-100 flex items-center justify-center">
          <User size={10} className="text-accent-600" />
        </div>
        <span className="text-[11px] text-ink-500">原文</span>
        <span className="text-[11px] text-ink-400">·</span>
        <span className="text-[11px] text-ink-400">
          {formatRelativeTime(note.createdAt)}
        </span>
      </div>

      <div className={cn('note-md text-ink-800 line-clamp-3', compact ? 'text-sm' : '')}>
        <RichTextRenderer content={note.content} />
      </div>

      {note.images.length > 0 && (
        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
          <TwitterImageGrid images={note.images} compact />
        </div>
      )}
      </Link>
    </>
  );
}
