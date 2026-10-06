import Highlight from '@tiptap/extension-highlight';
import { mergeAttributes } from '@tiptap/core';

/**
 * 扩展 Highlight：在官方 color 属性基础上检测渐变/条纹，
 * 自动判断该渲染 background（完整值）还是 background-color（纯色）。
 * 同时加 border 属性。
 *
 * 关键：**只用官方 color 属性传所有值**（包括渐变），
 * 因为官方 setHighlight 命令只认它 schema 注册的属性。
 *
 * 判断逻辑：color 值里包含 'gradient' 或 'repeating' → 用 background，
 * 否则用 background-color。
 */
function isComplexBackground(val: string | null | undefined): boolean {
  if (!val) return false;
  return /gradient|repeating|radial|conic/.test(val);
}

export const HighlightWithBorder = Highlight.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      border: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute('data-border') ||
          element.style.border ||
          null,
        renderHTML: () => ({}),
      },
    };
  },

  renderHTML({ mark }) {
    const color = mark.attrs.color;
    const border = mark.attrs.border;

    const styleParts: string[] = [];

    if (color) {
      if (isComplexBackground(color)) {
        styleParts.push(`background: ${color}`);
      } else {
        styleParts.push(`background-color: ${color}`);
        styleParts.push('color: inherit');
      }
    }

    if (border) {
      styleParts.push(`border: ${border}`);
      styleParts.push('padding: 1px 4px');
      styleParts.push('border-radius: 4px');
    }

    const attrs: Record<string, any> = {};
    if (color) attrs['data-color'] = color;
    if (border) attrs['data-border'] = border;
    if (styleParts.length > 0) attrs.style = styleParts.join('; ');

    return [
      'mark',
      mergeAttributes(this.options.HTMLAttributes, attrs),
      0,
    ];
  },
});

export default HighlightWithBorder;
