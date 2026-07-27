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

export const CALLOUT_TYPES: Record<string, { emoji: string; bg: string; border: string }> = {
  tip: { emoji: '💡', bg: '#FFF7ED', border: '#FED7AA' },
  info: { emoji: 'ℹ️', bg: '#EFF6FF', border: '#BFDBFE' },
  warning: { emoji: '⚠️', bg: '#FFFBEB', border: '#FDE68A' },
  danger: { emoji: '🚫', bg: '#FEF2F2', border: '#FECACA' },
  success: { emoji: '✅', bg: '#F0FDF4', border: '#BBF7D0' },
  note: { emoji: '📝', bg: '#F5F3FF', border: '#DDD6FE' },
};

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
        style: `background-color: ${style.bg}; border-color: ${style.border}`,
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
          // 重新渲染确保颜色同步
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
