import { config } from "../../config.js";

const XAI_RESPONSES_URL = "https://api.x.ai/v1/responses";

export interface XSearchOptions {
  fromDate?: string; // YYYY-MM-DD
  toDate?: string; // YYYY-MM-DD
  allowedHandles?: string[];
}

export interface GrokResult {
  text: string;
  citations: string[];
}

// Pulls the assistant text out of the various shapes the Responses API may use.
export function extractGrokText(resp: unknown): string {
  const r = resp as Record<string, unknown>;
  if (typeof r?.output_text === "string") return r.output_text;

  const out = r?.output;
  if (Array.isArray(out)) {
    const parts: string[] = [];
    for (const item of out) {
      const content = (item as Record<string, unknown>)?.content;
      if (Array.isArray(content)) {
        for (const c of content) {
          const t = (c as Record<string, unknown>)?.text;
          if (typeof t === "string") parts.push(t);
        }
      } else if (typeof content === "string") {
        parts.push(content);
      }
    }
    if (parts.length) return parts.join("\n");
  }

  // OpenAI-style fallback.
  const choices = r?.choices as Array<Record<string, unknown>> | undefined;
  const msg = choices?.[0]?.message as Record<string, unknown> | undefined;
  if (typeof msg?.content === "string") return msg.content;

  return "";
}

export function extractGrokCitations(resp: unknown): string[] {
  const r = resp as Record<string, unknown>;
  const c = r?.citations;
  if (Array.isArray(c)) return c.filter((x): x is string => typeof x === "string");
  return [];
}

// Calls Grok with the X Search tool enabled and returns the text + cited post URLs.
export async function grokXSearch(
  prompt: string,
  opts: XSearchOptions = {}
): Promise<GrokResult> {
  if (!config.xaiApiKey) {
    throw new Error("XAI_API_KEY is not set");
  }

  const xSearchTool: Record<string, unknown> = { type: "x_search" };
  if (opts.fromDate) xSearchTool.from_date = opts.fromDate;
  if (opts.toDate) xSearchTool.to_date = opts.toDate;
  if (opts.allowedHandles?.length) {
    xSearchTool.allowed_x_handles = opts.allowedHandles.slice(0, 20);
  }

  const res = await fetch(XAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.xaiApiKey}`,
    },
    body: JSON.stringify({
      model: config.xaiModel,
      input: [{ role: "user", content: prompt }],
      tools: [xSearchTool],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`xAI request failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const json = await res.json();
  return { text: extractGrokText(json), citations: extractGrokCitations(json) };
}
