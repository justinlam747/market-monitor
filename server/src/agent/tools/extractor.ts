import { z } from "zod";
import type { ClaimType } from "@shared/types";
import { isFixtureMode } from "../../config.js";
import { getModel } from "../llm.js";
import { findFixtureSourceByUrl } from "../../fixtures/dataset.js";

export interface ExtractedClaim {
  type: ClaimType;
  value: string;
  evidence: string | null;
  confidence: number;
}

const CLAIM_TYPES: [ClaimType, ...ClaimType[]] = [
  "target_customer",
  "positioning",
  "feature",
  "pricing",
  "recent_signal",
  "funding",
];

const ExtractionSchema = z.object({
  claims: z.array(
    z.object({
      type: z.enum(CLAIM_TYPES),
      value: z
        .string()
        .describe('The extracted value, or "unknown" if not present in the text.'),
      evidence: z
        .string()
        .nullable()
        .describe(
          "A short VERBATIM quote copied from the source text that supports the value. " +
            "Null if the value is unknown / not supported by the text."
        ),
      confidence: z.number().min(0).max(1),
    })
  ),
});

// Tool 5: LLM extractor. Produces source-grounded claims. Missing fields are
// marked unknown with null evidence — never fabricated.
export async function extractClaims(source: {
  url: string;
  text: string;
}): Promise<ExtractedClaim[]> {
  if (isFixtureMode()) {
    const fx = findFixtureSourceByUrl(source.url);
    return (fx?.claims ?? []).map((c) => ({ ...c }));
  }

  const model = getModel().withStructuredOutput(ExtractionSchema, {
    name: "claims",
  });
  const result = await model.invoke([
    {
      role: "system",
      content:
        "You extract structured COMPETITOR SIGNALS from a web page. Capture, where present:\n" +
        "- positioning: how they position / what they compete on\n" +
        "- target_customer: who they sell to\n" +
        "- feature: notable products or capabilities they create\n" +
        "- pricing: pricing or plans\n" +
        "- recent_signal: NEWEST releases, product updates, launches, partnerships, momentum (prefer the most recent)\n" +
        "- funding: who is backing them — investors, funding rounds, amounts\n" +
        "For each claim, the `evidence` MUST be a verbatim substring copied from the " +
        "provided text. If a field is not supported by the text, set value to " +
        '"unknown" and evidence to null. Never invent facts.',
    },
    {
      role: "user",
      content: `Source URL: ${source.url}\n\nText:\n${source.text}`,
    },
  ]);

  return (result as { claims: ExtractedClaim[] }).claims ?? [];
}
