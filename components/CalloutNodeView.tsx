'use client';

import { useState, useRef, useEffect } from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { CALLOUT_TYPES, CALLOUT_TYPE_KEYS } from '@/lib/tiptap-callout';
import { cn } from '@/lib/utils';

export default function CalloutNodeView(props: any) {
  const { node, updateAttributes } = props;
  const { emoji, type } = node.attrs;
  const style = CALLOUT_TYPES[type] || CALLOUT_TYPES.tip;
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target as Node)
      ) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPicker]);

  const applyType = (newType: string) => {
    updateAttributes({ type: newType, emoji: CALLOUT_TYPES[newType]?.emoji ?? emoji });
    setShowPicker(false);
  };

  return (
    <NodeViewWrapper>
      <div
        className="callout"
        style={{
          backgroundColor: style.bg,
          borderColor: style.border,
        }}
      >
        <div
          className="callout-emoji relative cursor-pointer select-none"
          contentEditable={false}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowPicker(!showPicker);
          }}
          ref={pickerRef}
        >
          {emoji}
          {showPicker && (
            <div className="absolute z-50 left-0 top-full mt-1 p-2 rounded-lg border border-ink-200 bg-white shadow-lg grid grid-cols-3 gap-1.5 w-[150px]">
              {CALLOUT_TYPE_KEYS.map((t) => {
                const s = CALLOUT_TYPES[t];
                return (
                  <button
                    key={t}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      applyType(t);
                    }}
                    className={cn(
                      'w-10 h-10 rounded-md border flex items-center justify-center text-lg transition-transform hover:scale-105',
                      type === t
                        ? 'border-ink-800 ring-1 ring-ink-800'
                        : 'border-ink-200'
                    )}
                    style={{
                      backgroundColor: s.bg,
                      borderColor: s.border,
                    }}
                    title={t}
                  >
                    {s.emoji}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <NodeViewContent className="callout-content" />
      </div>
    </NodeViewWrapper>
  );
}
