'use client';

import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';
import { useEffect, useMemo, useRef } from 'react';
import { isHtmlContent } from '@/lib/utils';

interface RichTextRendererProps {
  content: string;
  className?: string;
  /** 搜索关键词，渲染后在正文里高亮并滚动定位 */
  highlightQuery?: string;
}

/**
 * 安全地在 HTML 里给关键词加高亮 span：
 * 先用 DOMParser 解析 → 遍历 Text 节点替换关键词为 <span> → serialize 回来
 * 这样不会破坏 HTML 结构，也不会匹配到标签/属性里的文字
 */
function injectHighlightIntoHtml(html: string, keyword: string): string {
  if (!keyword) return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const lowerKw = keyword.toLowerCase();
  const kwLen = keyword.length;

  // 遍历所有可匹配的文本节点
  const textNodes: Text[] = [];
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName;
      if (
        tag === 'CODE' ||
        tag === 'PRE' ||
        tag === 'SCRIPT' ||
        tag === 'STYLE' ||
        tag === 'TEXTAREA'
      ) {
        return NodeFilter.FILTER_REJECT;
      }
      if (!node.textContent || node.textContent.trim() === '') {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let n: Node | null;
  while ((n = walker.nextNode())) {
    textNodes.push(n as Text);
  }

  // 在每个文本节点里替换
  for (const textNode of textNodes) {
    const text = textNode.textContent!;
    const lowerText = text.toLowerCase();

    let idx = lowerText.indexOf(lowerKw);
    if (idx === -1) continue;

    const parts: string[] = [];
    let lastEnd = 0;
    while (idx !== -1) {
      parts.push(text.slice(lastEnd, idx));
      parts.push(
        `<span class="search-highlight" data-search-highlight="true">${text.slice(
          idx,
          idx + kwLen
        )}</span>`
      );
      lastEnd = idx + kwLen;
      idx = lowerText.indexOf(lowerKw, lastEnd);
    }
    parts.push(text.slice(lastEnd));

    // 用临时 div 解析替换片段，再 replaceWith
    const wrapper = doc.createElement('div');
    wrapper.innerHTML = parts.join('');
    textNode.replaceWith(...wrapper.childNodes);
  }

  return doc.body.innerHTML;
}

export default function RichTextRenderer({
  content,
  className = 'note-md',
  highlightQuery,
}: RichTextRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  if (!content) return null;

  // 缓存 safeHtml。如果有搜索关键词，在 sanitize 之前先注入高亮 span
  const safeHtml = useMemo(() => {
    let html = isHtmlContent(content)
      ? content
      : (marked.parse(content, { async: false }) as string);

    // 如果有搜索关键词，先注入高亮
    const keyword = highlightQuery?.trim();
    if (keyword && keyword.length > 0) {
      html = injectHighlightIntoHtml(html, keyword);
    }

    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'div', 'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'span',
        'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
        'blockquote', 'pre', 'code', 'hr', 'img', 'input', 'mark',
      ],
      ALLOWED_ATTR: [
        'href', 'title', 'style', 'src', 'alt', 'class', 'type', 'checked',
        'disabled', 'data-callout', 'data-callout-type',
      ],
      ALLOW_DATA_ATTR: true,
    });
  }, [content, highlightQuery]);

  // 滚动到第一个高亮（渲染后执行，不做 DOM 操作）
  useEffect(() => {
    const keyword = highlightQuery?.trim();
    if (!keyword || keyword.length < 1) return;
    if (!containerRef.current) return;

    requestAnimationFrame(() => {
      const target = containerRef.current?.querySelector('[data-search-highlight="true"]');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }, [highlightQuery, content]);

  return (
    <div
      ref={containerRef}
      className={className}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
