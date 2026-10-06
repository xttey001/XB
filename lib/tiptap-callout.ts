import { Node, mergeAttributes, type RawCommands, type Editor } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import CalloutNodeView from '@/components/CalloutNodeView';

export interface CalloutOptions {
  HTMLAttributes: Record<string, any>;
}

export interface CalloutAttributes {
  emoji?: string;
  type?: string;
}

/**
 * 块级 Callout 预设。
 *
 * background / border 直接存完整 CSS value，
 * 这样可以塞纯色、渐变、条纹、虚线等任意效果，
 * 未来想加 conic-gradient / 内阴影 → 只需改数组一行。
 */
export const CALLOUT_TYPES: Record<
  string,
  { emoji: string; background: string; border: string; label: string }
> = {
  clear: {
    emoji: '✏️',
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    label: '清除样式',
  },
  tip: {
    emoji: '💡',
    background: 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)',
    border: '1px solid #FDBA74',
    label: '提示',
  },
  info: {
    emoji: 'ℹ️',
    background: 'radial-gradient(circle at 70% 20%, rgba(147,197,253,0.5) 0%, #EFF6FF 60%)',
    border: '1px solid #93C5FD',
    label: '信息',
  },
  success: {
    emoji: '✅',
    background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)',
    border: '1px solid #86EFAC',
    label: '成功',
  },
  warning: {
    emoji: '⚠️',
    background:
      'repeating-linear-gradient(135deg, #FEF9C3 0px, #FEF9C3 6px, #FEF08A 6px, #FEF08A 7px)',
    border: '1px dashed #FCD34D',
    label: '警告',
  },
  danger: {
    emoji: '🚫',
    background: '#FEF2F2',
    border: '1px solid #FCA5A5',
    label: '危险',
  },
  note: {
    emoji: '📝',
    background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)',
    border: '1px solid #C4B5FD',
    label: '笔记',
  },
  glow: {
    emoji: '✨',
    background:
      'radial-gradient(circle at top right, rgba(147,197,253,0.4) 0%, rgba(196,181,253,0.4) 50%, #FFFFFF 100%)',
    border: '1px solid #E5E7EB',
    label: '光斑',
  },
  stripe: {
    emoji: '🔧',
    background:
      'repeating-linear-gradient(45deg, #FEF9C3 0px, #FEF9C3 8px, #F9731630 8px, #F9731630 9px), #FFFFFF',
    border: '1px dashed #F59E0B',
    label: '条纹',
  },
};

/** 明确的排序，避免依赖 Object.keys 枚举顺序 */
export const CALLOUT_PRESET_ORDER = [
  'clear',
  'tip',
  'info',
  'success',
  'warning',
  'danger',
  'note',
  'glow',
  'stripe',
];

export const CALLOUT_TYPE_KEYS = Object.keys(CALLOUT_TYPES);

export const Callout = Node.create<CalloutOptions>({
  name: 'callout',

  group: 'block',

  content: 'block+',

  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      emoji: {
        default: '💡',
      },
      type: {
        default: 'tip',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-callout]',
      },
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutNodeView);
  },

  renderHTML({ HTMLAttributes }) {
    const { emoji, type } = HTMLAttributes;
    const style = CALLOUT_TYPES[type] || CALLOUT_TYPES.tip;
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-callout': '',
        'data-callout-type': type,
        class: 'callout',
        style: `background: ${style.background}; border: ${style.border}`,
      }),
      ['div', {
        class: 'callout-emoji',
        contenteditable: 'false',
        'data-callout-emoji': 'true',
        'data-callout-type': type,
      }, emoji],
      ['div', { class: 'callout-content' }, 0],
    ];
  },

  addCommands() {
    return {
      setCallout:
        (attrs: CalloutAttributes = {}) =>
        ({ commands }: { commands: any }) => {
          return commands.wrapIn(this.name, attrs);
        },
      toggleCallout:
        (attrs: CalloutAttributes = {}) =>
        ({ commands }: { commands: any }) => {
          return commands.toggleWrap(this.name, attrs);
        },
      unsetCallout:
        () =>
        ({ commands }: { commands: any }) => {
          return commands.lift(this.name);
        },
      updateCalloutType:
        (type: string) =>
        ({ commands, editor }: { commands: any; editor: Editor }) => {
          const { from, to } = editor.state.selection;
          const chain = commands.updateAttributes(this.name, { type });
          return chain
            .command(({ tr }: { tr: any }) => {
              tr.setMeta('calloutUpdate', true);
              return true;
            })
            .setTextSelection({ from, to })
            .run();
        },
      updateCalloutEmoji:
        (emoji: string) =>
        ({ commands, editor }: { commands: any; editor: Editor }) => {
          const { from, to } = editor.state.selection;
          return commands
            .updateAttributes(this.name, { emoji })
            .setTextSelection({ from, to })
            .run();
        },
    } as Partial<RawCommands>;
  },
});

export default Callout;
