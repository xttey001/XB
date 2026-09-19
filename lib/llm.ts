/**
 * LLM 调用层
 *
 * 可插拔：默认走 OpenAI-compatible endpoint（支持 DeepSeek / 硅基流动 / 智谱等）
 * 如果 .env 里没有配置 API key，则 fallback 到"确定性抽取"策略（不用 LLM）。
 *
 * 环境变量（.env）:
 *   LLM_API_KEY      = sk-xxx  （必填才会真调 LLM）
 *   LLM_BASE_URL     = https://api.deepseek.com  （默认 DeepSeek，便宜好用）
 *   LLM_MODEL        = deepseek-chat  （默认 deepseek-chat，$0.27/M tokens）
 */

export interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export function getLLMConfig(): LLMConfig | null {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: process.env.LLM_BASE_URL || 'https://api.deepseek.com',
    model: process.env.LLM_MODEL || 'deepseek-chat',
  };
}

export function llmAvailable(): boolean {
  return !!process.env.LLM_API_KEY;
}

/** 流式或非流式都支持，默认非流式，直接返回完整 text */
export async function callLLM(
  prompt: string,
  config?: LLMConfig,
  systemPrompt?: string
): Promise<string> {
  const cfg = config || getLLMConfig();
  if (!cfg) {
    throw new Error('LLM 未配置：请在 .env 中设置 LLM_API_KEY');
  }

  const body = {
    model: cfg.model,
    messages: [
      ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
      { role: 'user' as const, content: prompt },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  };

  const url = `${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => resp.statusText);
    throw new Error(`LLM API 错误 ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM 响应为空');
  return content;
}

/** 安全解析 LLM 返回的 JSON（有时会在外面包 ```json``` 代码块） */
export function parseLLMJSON<T>(raw: string): T {
  let text = raw.trim();
  // 去掉可能的 markdown 代码块包裹
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  return JSON.parse(text) as T;
}
