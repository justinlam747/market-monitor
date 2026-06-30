import { hasXai } from "../../config.js";
import { LIMITS } from "../limits.js";
import { grokXSearch } from "./grokClient.js";
import { createLogger } from "../../logger.js";
import type { CompanyIdentity } from "./identity.js";

const log = createLogger("agent.grokX");

export interface DiscoveredCompetitor {
  name: string;
  handle?: string;
  url?: string;
}

export type XSignalType =
  | "recent_signal"
  | "funding"
  | "feature"
  | "positioning";

export interface XSignal {
  type: XSignalType;
  value: string;
  quote: string;
  url: string;
  date?: string;
}

const X_SIGNAL_TYPES = new Set<XSignalType>([
  "recent_signal",
  "funding",
  "feature",
  "positioning",
]);

// --- Pure parsing helpers (unit-tested, no network) -------------------------

// Pulls the first JSON array (or object) out of an LLM text response, tolerating
// code fences and surrounding prose.
export function firstJsonArray(text: string): unknown[] {
  if (!text) return [];
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();

  const start = t.indexOf("[");
  const end = t.lastIndexOf("]");
  if (start !== -1 && end > start) {
    try {
      const arr = JSON.parse(t.slice(start, end + 1));
      if (Array.isArray(arr)) return arr;
    } catch {
      /* fall through */
    }
  }
  try {
    const obj = JSON.parse(t);
    return Array.isArray(obj) ? obj : [obj];
  } catch {
    return [];
  }
}

export function parseCompetitors(text: string): DiscoveredCompetitor[] {
  const out: DiscoveredCompetitor[] = [];
  for (const raw of firstJsonArray(text)) {
    const o = raw as Record<string, unknown>;
    const name = typeof o?.name === "string" ? o.name.trim() : "";
    if (!name) continue;
    const handle =
      typeof o?.handle === "string" ? o.handle.replace(/^@/, "").trim() : "";
    const url = typeof o?.url === "string" ? o.url.trim() : "";
    out.push({
      name,
      handle: handle || undefined,
      url: url || undefined,
    });
  }
  return out;
}

export function parseXSignals(text: string, citations: string[] = []): XSignal[] {
  const out: XSignal[] = [];
  const arr = firstJsonArray(text);
  arr.forEach((raw, i) => {
    const o = raw as Record<string, unknown>;
    const value = typeof o?.value === "string" ? o.value.trim() : "";
    const quote = typeof o?.quote === "string" ? o.quote.trim() : "";
    if (!value || !quote) return;
    const type = X_SIGNAL_TYPES.has(o?.type as XSignalType)
      ? (o.type as XSignalType)
      : "recent_signal";
    const url =
      (typeof o?.url === "string" && o.url.trim()) ||
      citations[i] ||
      citations[0] ||
      "";
    if (!url) return;
    const date = typeof o?.date === "string" ? o.date : undefined;
    out.push({ type, value, quote, url, date });
  });
  return out;
}

function daysAgoISO(days: number, now: Date): string {
  const d = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

// --- Live calls (no-ops without an xAI key) ---------------------------------

export async function discoverCompetitorsViaX(
  identity: CompanyIdentity
): Promise<DiscoveredCompetitor[]> {
  if (!hasXai()) return [];
  const prompt =
    "We are analyzing a company with this brand identity:\n" +
    `- What it does: ${identity.businessIdea}\n` +
    `- Who it serves: ${identity.targetCustomer}\n\n` +
    "Search X (Twitter) for other real, active companies operating in this same " +
    "SCOPE — i.e., building similar products for similar customers in this market/space. " +
    "These are the companies we will research as competitors. " +
    "Return ONLY a JSON array of objects like " +
    '[{"name":"Company","handle":"theirhandle","url":"https://their-site.com"}], ' +
    "using each company's real X handle and official website when known. No prose.";
  try {
    const { text } = await grokXSearch(prompt, {
      fromDate: daysAgoISO(LIMITS.xSearchDays, new Date()),
    });
    return parseCompetitors(text).slice(0, LIMITS.maxCompetitors * 3);
  } catch (err) {
    log.warn("X competitor discovery failed; continuing without it", err);
    return [];
  }
}

export async function xSignalsFor(
  competitorName: string,
  handle?: string
): Promise<XSignal[]> {
  if (!hasXai()) return [];
  const prompt =
    `Find the most notable RECENT X (Twitter) posts about "${competitorName}" — ` +
    "product launches, feature releases, funding rounds / investors, partnerships, " +
    "and momentum. Return ONLY a JSON array like " +
    '[{"type":"recent_signal|funding|feature|positioning","value":"short summary",' +
    '"quote":"a verbatim excerpt from the post","url":"https://x.com/.../status/...","date":"YYYY-MM-DD"}]. ' +
    "Every item MUST include a verbatim quote and the post URL. No prose.";
  try {
    const { text, citations } = await grokXSearch(prompt, {
      fromDate: daysAgoISO(LIMITS.xSearchDays, new Date()),
      allowedHandles: handle ? [handle] : undefined,
    });
    return parseXSignals(text, citations).slice(0, LIMITS.maxXPostsPerCompetitor);
  } catch (err) {
    log.warn(`X signals failed for "${competitorName}"; continuing without it`, err);
    return [];
  }
}
