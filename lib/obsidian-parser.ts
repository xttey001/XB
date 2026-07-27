// Obsidian 语法解析与转换工具
// 将 Obsidian 的专有语法转换为标准 Markdown
import path from 'path';

export interface ParsedMarkdown {
  frontmatter: Record<string, any> | null;
  content: string;
  tags: string[];
  images: string[]; // 引用到的本地图片相对路径
  wikiLinks: string[]; // [[wiki 链接]] 的目标
}

/**
 * 解析 Obsidian Markdown 文件
 * - 提取 YAML frontmatter
 * - 保留正文（暂时不转换，等图片复制后再转换）
 * - 提取 [[wiki 链接]] 和 ![[嵌入]] 的引用
 */
export function parseObsidianMarkdown(raw: string): ParsedMarkdown {
  let frontmatter: Record<string, any> | null = null;
  let content = raw;

  // 1. 提取 frontmatter
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (fmMatch) {
    frontmatter = parseFrontmatter(fmMatch[1]);
    content = raw.slice(fmMatch[0].length);
  }

  // 2. 提取所有 [[wiki 链接]]（含可选别名 [[target|alias]]）
  const wikiLinks: string[] = [];
  const wikiRegex = /\[\[([^\]]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = wikiRegex.exec(content)) !== null) {
    const target = m[1].split('|')[0].split('#')[0].trim();
    if (target) wikiLinks.push(target);
  }

  // 3. 提取所有 ![[图片嵌入]]（区分图片和笔记嵌入）
  const images: string[] = [];
  const imageExtRegex = /\.(png|jpe?g|gif|webp|avif|svg|bmp)$/i;
  const embedRegex = /!\[\[([^\]]+)\]\]/g;
  while ((m = embedRegex.exec(content)) !== null) {
    const target = m[1].split('|')[0].split('#')[0].trim();
    if (imageExtRegex.test(target)) {
      images.push(target);
    }
  }

  // 4. 从 frontmatter 提取 tags
  const tags: string[] = [];
  if (frontmatter?.tags) {
    if (Array.isArray(frontmatter.tags)) {
      tags.push(...frontmatter.tags.map(String));
    } else if (typeof frontmatter.tags === 'string') {
      tags.push(
        ...frontmatter.tags
          .split(/[, ]+/)
          .map((t: string) => t.trim())
          .filter(Boolean)
      );
    }
  }
  // 5. 从正文提取 #标签
  const inlineTagRegex = /(?:^|\s)#([\w\u4e00-\u9fa5-]+)/g;
  while ((m = inlineTagRegex.exec(content)) !== null) {
    const t = m[1];
    if (!tags.includes(t)) tags.push(t);
  }

  return { frontmatter, content, tags, images, wikiLinks };
}

/**
 * 将 Obsidian 语法转换为标准 Markdown
 * - ![[image.png]] → ![](/uploads/2026/07/xxx.png)
 * - [[target]] → **target**（无目标文件可链接，加粗保留）
 * - [[target|alias]] → **alias**
 */
export function convertObsidianToStandard(
  content: string,
  imageMap: Map<string, string> // 原始图片名 → 复制后的 URL
): string {
  let result = content;

  // 转换 ![[image.png]] 和 ![[image.png|400]] 等
  result = result.replace(/!\[\[([^\]]+)\]\]/g, (_, inner: string) => {
    const parts = inner.split('|');
    const filename = parts[0].split('#')[0].trim();
    const url = imageMap.get(filename) || imageMap.get(path.basename(filename));
    if (url) {
      return `![](${url})`;
    }
    // 不是图片或是笔记嵌入，保留为引用文本
    return `*嵌入: ${filename}*`;
  });

  // 转换 [[target]] 和 [[target|alias]]
  result = result.replace(/\[\[([^\]]+)\]\]/g, (_, inner: string) => {
    const parts = inner.split('|');
    const target = parts[0].split('#')[0].trim();
    const alias = parts[1]?.trim() || target;
    // 没有解析过的笔记文件作为链接目标，加粗保留为文本
    return `**${alias}**`;
  });

  return result;
}

/** 简单的 YAML frontmatter 解析（只支持常见的 key: value 和列表） */
function parseFrontmatter(yaml: string): Record<string, any> {
  const result: Record<string, any> = {};
  const lines = yaml.split('\n');
  let currentKey = '';
  let currentList: any[] | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;

    // 列表项
    const listMatch = line.match(/^\s*-\s+(.*)$/);
    if (listMatch && currentList) {
      currentList.push(parseScalar(listMatch[1]));
      continue;
    }

    // key: value
    const kvMatch = line.match(/^([\w-]+):\s*(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1];
      const value = kvMatch[2].trim();
      if (value === '' || value === '[]') {
        // 可能是列表
        currentList = [];
        result[key] = currentList;
        currentKey = key;
      } else {
        result[key] = parseScalar(value);
        currentKey = key;
        currentList = null;
      }
    }
  }

  return result;
}

function parseScalar(value: string): any {
  // 去引号
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  // 布尔
  if (value === 'true') return true;
  if (value === 'false') return false;
  // 数字
  if (/^-?\d+$/.test(value)) return parseInt(value, 10);
  if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);
  return value;
}
