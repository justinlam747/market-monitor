import { z } from "zod";
import type {
  ClaimState,
  CompetitorProfile,
  CompetitorState,
} from "@shared/types";
import { isFixtureMode } from "../../config.js";
import { getModel } from "../llm.js";
import { FIXTURE_COMPANY } from "../../fixtures/dataset.js";

export interface GapAnalysis {
  competitorProfiles: CompetitorProfile[];
  sharedPatterns: string[];
  gaps: string[];
  recommendation: string;
}

const GapSchema = z.object({
  competitorProfiles: z
    .array(
      z.object({
        name: z.string(),
        summary: z
          .string()
          .describe(
            "2-3 sentences on what this company does, who it serves, and how it positions — real insight, grounded in the claims."
          ),
        movement: z
          .string()
          .describe(
            "How the company is MOVING: recent releases/updates, funding & who is backing them, and momentum/trajectory."
          ),
      })
    )
    .describe("A grounded profile for each competitor."),
  sharedPatterns: z
    .array(z.string())
    .describe("Patterns common across the competitors."),
  gaps: z
    .array(z.string())
    .describe("Unmet needs / whitespace the competitors leave open."),
  recommendation: z
    .string()
    .describe("A concrete differentiation recommendation for the founder."),
});

export interface GapInput {
  businessIdea?: string;
  targetCustomer?: string;
  competitors: CompetitorState[];
  claims: ClaimState[];
}

// Tool 6: Gap analyzer. Compares competitors and identifies shared patterns,
// gaps, and a differentiation recommendation. Only grounded claims are passed in.
export async function analyzeGaps(input: GapInput): Promise<GapAnalysis> {
  if (isFixtureMode()) {
    return { ...FIXTURE_COMPANY.gapAnalysis };
  }

  const model = getModel().withStructuredOutput(GapSchema, { name: "gaps" });

  const byCompetitor = input.competitors.map((c) => {
    const claims = input.claims
      .filter((cl) => cl.competitorId === c.id)
      .map((cl) => `  - [${cl.type}] ${cl.value}`)
      .join("\n");
    return `Competitor: ${c.name}\n${claims || "  (no grounded claims)"}`;
  });

  const result = await model.invoke([
    {
      role: "system",
      content:
        "You are a competitive-intelligence analyst for a startup founder. " +
        "Using ONLY the grounded competitor signals provided (positioning, products, " +
        "pricing, recent releases, and who is backing them), produce:\n" +
        "- competitorProfiles: for EACH competitor, a real 'insight' profile — a summary of " +
        "what they do and how they position, plus their 'movement' (recent releases, funding/backers, momentum). " +
        "Go beyond 'they are a competitor'; describe the company.\n" +
        "- sharedPatterns: where competitors OVERLAP with each other and with the founder's idea\n" +
        "- gaps: where the founder's company can DIFFER — whitespace the competitors leave open\n" +
        "- recommendation: one concrete differentiation move.\n" +
        "Explicitly relate each point back to the founder's idea (overlap vs. difference).",
    },
    {
      role: "user",
      content:
        `Founder's idea: ${input.businessIdea ?? "(unknown)"}\n` +
        `Target customer: ${input.targetCustomer ?? "(unknown)"}\n\n` +
        `${byCompetitor.join("\n\n")}`,
    },
  ]);

  return result as GapAnalysis;
}
