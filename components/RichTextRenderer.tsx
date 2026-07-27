'use client';

import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';
import { isHtmlContent } from '@/lib/utils';

interface RichTextRendererProps {
  content: string;
  className?: string;
}

export default function RichTextRenderer({
  content,
  className = 'note-md',
}: RichTextRendererProps) {
  if (!content) return null;

  const html = isHtmlContent(content)
    ? content
    : (marked.parse(content, { async: false }) as string);
  const safeHtml = DOMPurify.sanitize(html, {
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

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
