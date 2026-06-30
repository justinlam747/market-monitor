import { z } from "zod";
import { isFixtureMode } from "../../config.js";
import { getModel } from "../llm.js";
import { LIMITS } from "../limits.js";
import { FIXTURE_COMPANY } from "../../fixtures/dataset.js";
import type { CompanyIdentity } from "./identity.js";
import {
  discoverCompetitorsViaX,
  type DiscoveredCompetitor,
} from "./grokX.js";

export type { DiscoveredCompetitor } from "./grokX.js";

const CompetitorsSchema = z.object({
  competitors: z
    .array(z.string())
    .describe("Names of likely direct competitors (companies/products)."),
});

// Merge OpenAI-named competitors with X-discovered ones. Names found by BOTH
// sources rank first (higher confidence); X entries carry handle/url. Pure +
// deterministic so it can be unit-tested.
export function mergeCompetitors(
  openaiNames: string[],
  xList: DiscoveredCompetitor[],
  max: number
): DiscoveredCompetitor[] {
  const byKey = new Map<
    string,
    { c: DiscoveredCompetitor; inOpenai: boolean; inX: boolean }
  >();
  const key = (n: string) => n.trim().toLowerCase();

  for (const name of openaiNames) {
    const k = key(name);
    if (!k) continue;
    if (!byKey.has(k)) byKey.set(k, { c: { name: name.trim() }, inOpenai: true, inX: false });
    else byKey.get(k)!.inOpenai = true;
  }
  for (const x of xList) {
    const k = key(x.name);
    if (!k) continue;
    const existing = byKey.get(k);
    if (existing) {
      existing.inX = true;
      existing.c.handle = existing.c.handle ?? x.handle;
      existing.c.url = existing.c.url ?? x.url;
    } else {
      byKey.set(k, { c: { ...x, name: x.name.trim() }, inOpenai: false, inX: true });
    }
  }

  return [...byKey.values()]
    .sort((a, b) => {
      // both > X-only > openai-only (X chatter is the freshest signal)
      const score = (e: typeof a) => (e.inOpenai && e.inX ? 2 : e.inX ? 1 : 0);
      return score(b) - score(a);
    })
    .map((e) => e.c)
    .slice(0, max);
}

// Tool: competitor discovery. Combines OpenAI (training knowledge) with Grok X
// search (live chatter) to propose competitors. Capped at LIMITS.maxCompetitors.
export async function discoverCompetitors(
  identity: CompanyIdentity,
  pageText: string
): Promise<DiscoveredCompetitor[]> {
  if (isFixtureMode()) {
    return FIXTURE_COMPANY.competitors
      .map((c) => ({ name: c.name }))
      .slice(0, LIMITS.maxCompetitors);
  }

  // X (Twitter) scope search is the primary driver: from the brand identity we
  // search X for companies operating in the same scope, then research them.
  const xList = await discoverCompetitorsViaX(identity);
  if (xList.length >= LIMITS.maxCompetitors) {
    return xList.slice(0, LIMITS.maxCompetitors);
  }

  // X found too few (or no xAI key) — supplement with OpenAI, keeping the
  // X-discovered companies ranked first.
  const openaiNames = await discoverViaOpenAI(identity, pageText);
  return mergeCompetitors(openaiNames, xList, LIMITS.maxCompetitors);
}

async function discoverViaOpenAI(
  identity: CompanyIdentity,
  pageText: string
): Promise<string[]> {
  const model = getModel().withStructuredOutput(CompetitorsSchema, {
    name: "competitors",
  });
  const result = await model.invoke([
    {
      role: "system",
      content:
        "You identify direct competitors for a startup. Return real, well-known " +
        "companies or products that serve a similar customer with a similar value " +
        `proposition. Return at most ${LIMITS.maxCompetitors}.`,
    },
    {
      role: "user",
      content:
        `Business idea: ${identity.businessIdea}\n` +
        `Target customer: ${identity.targetCustomer}\n\n` +
        `Context from their site:\n${pageText.slice(0, 3000)}`,
    },
  ]);
  return (result as { competitors: string[] }).competitors ?? [];
}
