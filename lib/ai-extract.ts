/**
 * Phase 3 AI 知识抽取引擎
 *
 * 三条路径：
 *   A. LLM 路径（有 API key 时）：调 LLM 抽实体 / 发现关系 / 生成地图
 *   B. 确定性兜底路径（无 API key 时）：基于 tags / 分类共享度做推断，不调 LLM
 *
 * 设计原则：
 *   - 实体名必须"规范化"，不能直接用章节标题（经验教训：把带装饰语的标题当实体）
 *   - 所有 AI 产物都是候选，linkSource = ai_suggested（需审核）或直接写入 Entity（全局词典）
 *   - LLM 响应一律 parse JSON，严格 schema
 */

import { prisma } from '@/lib/prisma';
import { parseJsonArray, stripHtml } from '@/lib/utils';
import { callLLM, parseLLMJSON, llmAvailable } from '@/lib/llm';

/* ============ 1. 实体抽取 ============ */

export interface ExtractedEntity {
  name: string;           // 规范名（canonical，不要从原文直接复制）
  aliases: string[];      // 别名
  entityType: 'concept' | 'term' | 'person' | 'event' | 'system' | 'other';
  definition: string;     // 一句话定义
}

const ENTITY_EXTRACTION_SYSTEM = `你是一个严谨的知识提取助手。从用户提供的笔记正文中提取 3-8 个核心实体/概念/术语。

严格规则：
1. 实体名必须是"规范名"（canonical name），基于正文含义生成，**不要原样复制标题或原文中的装饰性表述**
2. 实体名应该简洁（2-6 字中文或 1-4 个英文单词），不要加修饰语
3. 每条实体包含：name（规范名）、aliases（原文中出现的各种写法）、entityType（类型）、definition（一句话定义）
4. 如果笔记里有代码片段、日期、纯数据行，跳过不抽
5. 类型选择：concept=概念、term=术语、person=人物、event=事件、system=系统/模型、other=其他

输出严格 JSON：
{
  "entities": [
    {
      "name": "规范实体名",
      "aliases": ["原文出现的别名1", "别名2"],
      "entityType": "concept",
      "definition": "一句话说明这个实体是什么"
    }
  ]
}
不要输出任何 JSON 以外的文本。`;

/** 对一条笔记跑实体抽取 */
export async function extractEntitiesForNote(noteId: string): Promise<ExtractedEntity[]> {
  const note = await prisma.note.findUnique({ where: { id: noteId } });
  if (!note) return [];

  const text = stripHtml(note.content).trim();
  if (text.length < 20) return [];

  // --- 有 LLM 时走 LLM ---
  if (llmAvailable()) {
    try {
      const raw = await callLLM(
        `请从以下笔记正文中提取核心实体。注意：实体名要规范、简洁，不要复制标题或原文的装饰语。\n\n笔记正文：\n${text.slice(0, 4000)}`,
        undefined,
        ENTITY_EXTRACTION_SYSTEM
      );
      const parsed = parseLLMJSON<{ entities: ExtractedEntity[] }>(raw);
      return parsed.entities || [];
    } catch (e) {
      console.warn('[extractEntitiesForNote] LLM 失败，回退确定性策略:', (e as Error).message);
    }
  }

  // --- 兜底：确定性抽取 ---
  return deterministicExtractEntities(text, parseJsonArray<string>(note.tags));
}

/** 兜底：从笔记里提取实体（不用 LLM） */
function deterministicExtractEntities(text: string, tags: string[]): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  const seen = new Set<string>();

  const add = (name: string, type: ExtractedEntity['entityType'] = 'concept', aliases: string[] = []) => {
    name = name.replace(/[！!?？。，、\s"'()（）【】《》「」]/g, '').trim();
    if (name.length < 2 || name.length > 15) return;
    if (/^[\d\W]+$/.test(name)) return; // 纯数字/符号跳过
    if (seen.has(name)) return;
    seen.add(name);
    entities.push({ name, aliases, entityType: type, definition: '' });
  };

  // 1) tags 直接作为 entities
  tags.forEach((t) => add(t, 'term'));

  // 2) 从正文中提取被引号/书名号/方括号包裹的关键词
  const patterns: RegExp[] = [
    /[「""]([^""」\n]{2,15})[」""]/g,
    /【([^】\n]{2,15})】/g,
    /《([^》\n]{2,15})》/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) add(m[1], 'concept');
  }

  // 3) markdown header / list item 的冒号前关键词
  const headerRe = /^(?:#{1,6}\s*|[-*]\s*)([^\n:\-—]{2,20}?)(?=[:：\-—]|\s*$)/gm;
  let hm: RegExpExecArray | null;
  while ((hm = headerRe.exec(text)) !== null) add(hm[1], 'concept');

  // 4) 笔记正文前 200 字里的"专业短语"：
  //    - 英文单词（≥4 字符的连续字母/数字）
  //    - 连续 3-6 个中文字符（跳过纯数字/标点）
  const head = text.slice(0, 200);
  const enRe = /[A-Za-z][A-Za-z0-9\-]{3,}/g;
  let em: RegExpExecArray | null;
  while ((em = enRe.exec(head)) !== null) {
    const w = em[0];
    if (!/^(the|and|for|are|but|not|you|all|can|had|her|was|one|our|out|day|get|has|him|his|how|its|may|new|now|old|see|two|way|who|boy|did|own|say|she|too|use)$/i.test(w)) {
      add(w, 'term');
    }
  }
  // 中文 3-6 gram（简单窗口）
  const zhHead = head.replace(/[^\u4e00-\u9fff]/g, ' ');
  const words = zhHead.split(/\s+/).filter((w) => w.length >= 3);
  words.forEach((w) => add(w.slice(0, 6), 'concept'));

  return entities.slice(0, 10);
}

/** 把抽取到的 entities 写入 DB（Entity + NoteEntity），返回新增/更新的 entity 列表 */
export async function persistEntities(noteId: string, entities: ExtractedEntity[]): Promise<string[]> {
  const entityIds: string[] = [];

  for (const e of entities) {
    if (!e.name || e.name.length < 2) continue;

    // upsert Entity（按 name 唯一）
    const entity = await prisma.entity.upsert({
      where: { name: e.name },
      update: {
        // 合并 aliases（不去重，简单 append）
        aliases: e.aliases.length
          ? JSON.stringify(
              Array.from(new Set([...(parseJsonArray<string>(await prisma.entity.findUnique({ where: { name: e.name } }).then((r) => r?.aliases || '[]'))), ...e.aliases]))
            )
          : undefined,
        definition: e.definition || undefined,
      },
      create: {
        name: e.name,
        aliases: JSON.stringify(e.aliases),
        entityType: e.entityType,
        definition: e.definition || null,
      },
    });

    // 创建 NoteEntity 关联
    await prisma.noteEntity.upsert({
      where: { noteId_entityId: { noteId, entityId: entity.id } },
      update: {},
      create: { noteId, entityId: entity.id },
    });
    entityIds.push(entity.id);
  }

  // 重新计算被引用数
  for (const id of entityIds) {
    const count = await prisma.noteEntity.count({ where: { entityId: id } });
    await prisma.entity.update({ where: { id }, data: { noteCount: count } });
  }

  return entityIds;
}

/* ============ 2. 跨笔记关联发现 → 建议 NoteLink ============ */

const RELATION_FINDING_SYSTEM = `你是一个严谨的知识关联分析助手。根据两条笔记的内容，判断它们之间是否存在可手动建立的链接关系。

关系类型选项：
- "relates"：普通关联（都在讲相关话题但不一定有明确层级）
- "part_of"：B 是 A 的一部分 / A 包含 B
- "example"：A 是 B 的示例 / 案例
- "cause"：A 影响/导致 B，或 B 影响/导致 A（要说明方向）
- "opposite"：A 和 B 是对立的概念/方法/现象

严格规则：
- 只有两条笔记确实有实质关联时才输出，不要为了凑数而生成
- confidence 为 0-1 的置信度，表示你有多大把握这个关联是对的
- 如果没有明确关联，relations 返回空数组

输出严格 JSON：
{
  "relations": [
    {
      "targetNoteId": "目标笔记ID",
      "relationType": "relates",
      "direction": "source_to_target" | "target_to_source",
      "reason": "一句话说明为什么这两条笔记相关（给用户审核用）",
      "confidence": 0.85
    }
  ]
}
不要输出任何 JSON 以外的文本。`;

/**
 * 跨笔记自动发现关联。
 * 策略：先按"共享 Entity"分组（和之前的 link-suggestions 类似但更重），
 * 然后对每对候选用 LLM（如果可用）做二次确认，否则只输出共享 entity 数 ≥2 的候选。
 */
export async function discoverNoteLinks(candidatePairs: Array<{ sourceId: string; targetId: string }>): Promise<Array<{
  sourceId: string;
  targetId: string;
  linkType: string;
  reason: string;
  confidence: number;
}>> {
  const results: Array<{
    sourceId: string;
    targetId: string;
    linkType: string;
    reason: string;
    confidence: number;
  }> = [];

  for (const { sourceId, targetId } of candidatePairs) {
    // 跳过已存在的 link
    const existing = await prisma.noteLink.findUnique({
      where: { sourceId_targetId: { sourceId, targetId } },
    });
    if (existing) continue;

    if (llmAvailable()) {
      // LLM 路径：拿两条笔记正文让 LLM 判断
      const [s, t] = await Promise.all([
        prisma.note.findUnique({ where: { id: sourceId } }),
        prisma.note.findUnique({ where: { id: targetId } }),
      ]);
      if (!s || !t) continue;
      try {
        const raw = await callLLM(
          `笔记 A (id=${sourceId}):\n${stripHtml(s.content).slice(0, 1500)}\n\n笔记 B (id=${targetId}):\n${stripHtml(t.content).slice(0, 1500)}`,
          undefined,
          RELATION_FINDING_SYSTEM
        );
        const parsed = parseLLMJSON<{ relations: any[] }>(raw);
        if (parsed.relations?.length) {
          for (const r of parsed.relations) {
            const effectiveTarget = r.targetNoteId === sourceId ? targetId : r.targetNoteId;
            const effectiveSource = r.targetNoteId === sourceId ? sourceId : sourceId;
            // direction 影响谁 source 谁 target
            const [finalSource, finalTarget] =
              r.direction === 'target_to_source' ? [targetId, sourceId] : [sourceId, effectiveTarget];
            results.push({
              sourceId: finalSource,
              targetId: finalTarget,
              linkType: r.relationType || 'relates',
              reason: r.reason || 'AI 发现关联',
              confidence: r.confidence ?? 0.7,
            });
          }
        }
      } catch {
        // LLM 失败就跳过这对
      }
    } else {
      // 兜底路径：检查共享 entity 数
      const sharedEntities = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
        SELECT COUNT(*) as cnt
        FROM NoteEntity a
        JOIN NoteEntity b ON a.entityId = b.entityId AND a.noteId < b.noteId
        WHERE (a.noteId = ${sourceId} AND b.noteId = ${targetId})
           OR (a.noteId = ${targetId} AND b.noteId = ${sourceId})
      `;
      const cnt = Number(sharedEntities[0]?.cnt || 0);
      if (cnt >= 1) {
        results.push({
          sourceId,
          targetId,
          linkType: 'relates',
          reason: `共享 ${cnt} 个实体（确定性）`,
          confidence: Math.min(0.4 + cnt * 0.15, 0.95),
        });
      }
    }
  }

  return results;
}

/** 把发现的关联写为 NoteLink。有 LLM → ai_suggested（待审核）；无 LLM → ai_accepted（直接接受，省一步） */
export async function persistSuggestedLinks(
  links: Awaited<ReturnType<typeof discoverNoteLinks>>
): Promise<number> {
  // 有 LLM 时保持 ai_suggested 让用户审核；兜底时直接 ai_accepted 让主题树能看到
  const source = llmAvailable() ? 'ai_suggested' : 'ai_accepted';
  let count = 0;
  for (const l of links) {
    try {
      await prisma.noteLink.upsert({
        where: { sourceId_targetId: { sourceId: l.sourceId, targetId: l.targetId } },
        update: {
          linkSource: source,
          linkType: l.linkType,
          confidence: l.confidence,
        },
        create: {
          sourceId: l.sourceId,
          targetId: l.targetId,
          linkSource: source,
          linkType: l.linkType,
          confidence: l.confidence,
        },
      });
      count++;
    } catch {
      // 唯一约束冲突跳过
    }
  }
  return count;
}

/* ============ 3. 知识地图生成 ============ */

const MINDMAP_SYSTEM_PROMPT = `你是一个知识地图生成助手。根据用户提供的一组笔记，生成一张 Mermaid mindmap。

规则：
1. 根节点是主题名（如果没有明确主题，用"知识地图"）
2. 第一层是 3-5 个主要分支（按内容聚类）
3. 第二层是每个分支下的关键概念/笔记标题
4. 用 <<styleClass>> 标记重要程度：
   - 极重要用 <<very_important>>（红色）
   - 重要用 <<important>>（蓝色）
5. 每条叶子节点括号里附上对应笔记的首 6 位 id，方便跳转，格式如：((笔记标题 [cmu7363]))
6. 只输出 Mermaid 代码（以 mindmap 开头），不要解释文字

输出格式：
mindmap
  root((主题名))
    分支一
      概念 A
      概念 B
    分支二
      ...
    classDef very_important fill:#f87171,stroke:#dc2626
    classDef important fill:#60a5fa,stroke:#2563eb`;

export async function generateKnowledgeMap(
  noteIds: string[],
  title: string
): Promise<{ mermaid: string; markdown: string }> {
  if (noteIds.length === 0) {
    return {
      mermaid: `mindmap\n  root(("${title}"\n  没有足够的笔记来生成地图`,
      markdown: '',
    };
  }

  const notes = await prisma.note.findMany({
    where: { id: { in: noteIds } },
    select: { id: true, content: true, importance: true, category: { select: { name: true } } },
  });

  const promptParts = notes.map((n) => {
    const text = stripHtml(n.content).replace(/\s+/g, ' ').slice(0, 300);
    return `- [${n.id.slice(0, 8)}] [${n.importance || 'normal'}] ${n.category?.name || ''}：${text}`;
  });

  // 先加样式定义在 prompt 末尾，让 LLM 知道要输出
  const userPrompt = `请基于以下 ${notes.length} 条笔记生成一张 Mermaid mindmap。\n\n笔记列表：\n${promptParts.join('\n')}\n\n主题：${title}`;

  if (llmAvailable()) {
    try {
      const mermaid = await callLLM(userPrompt, undefined, MINDMAP_SYSTEM_PROMPT);
      // 确保以 mindmap 开头
      const clean = mermaid.trim().replace(/^```(?:mermaid)?\s*/i, '').replace(/```\s*$/i, '');
      return {
        mermaid: clean,
        markdown: `# ${title}\n\n> 基于 ${notes.length} 条笔记自动生成\n\n\`\`\`mermaid\n${clean}\n\`\`\`\n`,
      };
    } catch (e) {
      console.warn('[generateKnowledgeMap] LLM 失败，回退确定性:', (e as Error).message);
    }
  }

  // 兜底：确定性生成（按 category 聚类）
  return deterministicGenerateMindmap(notes as any, title);
}

function deterministicGenerateMindmap(
  notes: Array<{ id: string; content: string; importance: string | null; category: { name: string } | null }>,
  title: string
): { mermaid: string; markdown: string } {
  // 按 category 分组
  const groups = new Map<string | '未分类', typeof notes>();
  for (const n of notes) {
    const key = n.category?.name || '未分类';
    const arr = groups.get(key) || [];
    arr.push(n);
    groups.set(key, arr);
  }

  const lines: string[] = ['mindmap', `  root(("${title}"\n    ))`];
  // 修正 mindmap 根节点语法 —— 上面那行多了 \n，重写
  lines.length = 0;
  lines.push('mindmap');
  lines.push(`  root(("${title}"))`);

  for (const [catName, catNotes] of groups) {
    lines.push(`    ${catName}`);
    for (const n of catNotes) {
      const summary = stripHtml(n.content).replace(/\s+/g, ' ').slice(0, 25);
      const leaf = `      ${summary || '(空)'} [${n.id.slice(0, 8)}]`;
      // 重要性样式
      if (n.importance === 'very_important') {
        lines.push(leaf + ':::very_important');
      } else if (n.importance === 'important') {
        lines.push(leaf + ':::important');
      } else {
        lines.push(leaf);
      }
    }
  }

  lines.push('    classDef very_important fill:#f87171,stroke:#dc2626');
  lines.push('    classDef important fill:#60a5fa,stroke:#2563eb');

  const mermaid = lines.join('\n');
  return {
    mermaid,
    markdown: `# ${title}\n\n> 基于 ${notes.length} 条笔记自动生成（确定性）\n\n\`\`\`mermaid\n${mermaid}\n\`\`\`\n`,
  };
}
