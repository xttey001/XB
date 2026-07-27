import type { NoteImportance } from './types';

export const IMPORTANCE_CONFIG: Record<
  NoteImportance,
  { label: string; text: string; bg: string; dot: string }
> = {
  important: {
    label: '重要',
    text: '#1D4ED8',
    bg: '#EFF6FF',
    dot: '#3B82F6',
  },
  very_important: {
    label: '极重要',
    text: '#BE185D',
    bg: '#FDF2F8',
    dot: '#EC4899',
  },
};

export function isValidImportance(
  value: string | null | undefined
): value is NoteImportance {
  return value === 'important' || value === 'very_important';
}
