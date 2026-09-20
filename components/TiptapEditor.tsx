'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import { marked } from 'marked';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  SeparatorHorizontal,
  AlignLeft,
  AlignCenter,
  Lightbulb,
  Link as LinkIcon,
  Highlighter,
} from 'lucide-react';
import { cn, isHtmlContent } from '@/lib/utils';
import ColorPopover, { PRESET_COLORS, PRESET_HIGHLIGHTS } from './ColorPopover';
import Callout from '@/lib/tiptap-callout';
import NoteLinkDialog from './NoteLinkDialog';

interface TiptapEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onPasteImage?: (files: File[]) => void;
}

/** 兼容旧 Markdown：非 HTML 内容先转为 HTML */
function toEditorHtml(value: string): string {
  if (!value) return '';
  return isHtmlContent(value)
    ? value
    : (marked.parse(value, { async: false }) as string);
}

interface ToolbarButtonProps {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({ active, onClick, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'p-1.5 rounded transition-colors',
        active
          ? 'bg-ink-800 text-white'
          : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
      )}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-4 bg-ink-200 mx-0.5" />;
}

const HEADING_LEVELS = [
  { level: 1 as const, icon: Heading1, title: '一级标题' },
  { level: 2 as const, icon: Heading2, title: '二级标题' },
  { level: 3 as const, icon: Heading3, title: '三级标题' },
];

export default function TiptapEditor({
  value,
  onChange,
  placeholder = '写下此刻的想法...',
  autoFocus = false,
  onPasteImage,
}: TiptapEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
        bulletList: {},
        orderedList: {},
        blockquote: {},
      }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Callout,
      Placeholder.configure({ placeholder }),
      Link.configure({ openOnClick: false }),
    ],
    content: toEditorHtml(value),
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none min-h-[80px] outline-none text-lg leading-[1.7] text-ink-800',
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files || []);
        if (files.some((f) => f.type.startsWith('image/'))) {
          event.preventDefault();
          onPasteImage?.(files);
          return true;
        }
        return false;
      },
    },
    autofocus: autoFocus,
  });

  useEffect(() => {
    if (!editor) return;
    const html = toEditorHtml(value);
    if (html !== editor.getHTML()) {
      editor.commands.setContent(html, { emitUpdate: false });
    }
  }, [editor, value]);

  // 处理链接笔记选择
  const handleLinkSelect = useCallback((noteId: string, title: string) => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to);

    // 如果有选中文本，保留选中文本作为链接文字；否则使用笔记标题
    const linkText = selectedText || title;
    const linkHtml = `<a href="/note/${noteId}" class="note-link" data-note-id="${noteId}">${linkText}</a>`;

    if (selectedText) {
      // 替换选中文本为链接
      editor.chain().focus().deleteSelection().insertContent(linkHtml).run();
    } else {
      // 在光标位置插入链接
      editor.chain().focus().insertContent(linkHtml).run();
    }
    setLinkDialogOpen(false);
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* 顶部固定工具栏 */}
      <div className="flex flex-wrap items-center gap-0.5 px-1.5 py-1.5 mb-1 rounded-lg border border-ink-200 bg-ink-50/50">
        {/* 标题 */}
        {HEADING_LEVELS.map(({ level, icon: Icon, title }) => (
          <ToolbarButton
            key={level}
            active={editor.isActive('heading', { level })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level }).run()
            }
            title={title}
          >
            <Icon size={15} />
          </ToolbarButton>
        ))}

        <ToolbarDivider />

        {/* 列表 */}
        <ToolbarButton
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="无序列表"
        >
          <List size={15} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="有序列表"
        >
          <ListOrdered size={15} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('taskList')}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          title="任务列表"
        >
          <CheckSquare size={15} />
        </ToolbarButton>

        <ToolbarDivider />

        {/* 引用、分隔线 */}
        <ToolbarButton
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="引用"
        >
          <Quote size={15} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="分隔线"
        >
          <SeparatorHorizontal size={15} />
        </ToolbarButton>

        <ToolbarDivider />

        {/* 对齐 */}
        <ToolbarButton
          active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          title="左对齐"
        >
          <AlignLeft size={15} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          title="居中对齐"
        >
          <AlignCenter size={15} />
        </ToolbarButton>

        <ToolbarDivider />

        {/* 高亮块 */}
        <ToolbarButton
          active={editor.isActive('callout')}
          onClick={() =>
            (editor.chain().focus() as any).toggleCallout({ type: 'tip' }).run()
          }
          title="高亮块"
        >
          <Lightbulb size={15} />
        </ToolbarButton>

        <ToolbarDivider />

        {/* 链接笔记 */}
        <ToolbarButton
          onClick={() => setLinkDialogOpen(true)}
          title="链接笔记"
        >
          <LinkIcon size={15} />
        </ToolbarButton>
      </div>

      <NoteLinkDialog
        isOpen={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
        onSelect={handleLinkSelect}
      />

      <EditorContent editor={editor} />

      {/* 选中文字时浮出的 Bubble Menu */}
      <BubbleMenu
        editor={editor}
        className="flex items-center gap-0.5 px-1.5 py-1 rounded-lg border border-ink-200 bg-white shadow-lg"
      >
        <ToolbarButton
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="加粗"
        >
          <Bold size={15} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="斜体"
        >
          <Italic size={15} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="下划线"
        >
          <UnderlineIcon size={15} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="删除线"
        >
          <Strikethrough size={15} />
        </ToolbarButton>

        <ToolbarDivider />

        <ColorPopover
          title="文字颜色"
          colors={PRESET_COLORS}
          onSelect={(color) => editor.chain().focus().setColor(color).run()}
          onClear={() => editor.chain().focus().unsetColor().run()}
          active={editor.isActive('textStyle') && !!editor.getAttributes('textStyle').color}
        >
          <Type size={15} />
        </ColorPopover>

        <ColorPopover
          title="背景颜色"
          colors={PRESET_HIGHLIGHTS}
          onSelect={(color) => editor.chain().focus().setHighlight({ color }).run()}
          onClear={() => editor.chain().focus().unsetHighlight().run()}
          active={editor.isActive('highlight')}
        >
          <Highlighter size={15} />
        </ColorPopover>
      </BubbleMenu>

    </div>
  );
}
