import { isFixtureMode } from "../../config.js";
import { getModel } from "../llm.js";

// Tool: OpenAI knowledge. An LLM call that summarizes what the model knows about
// a competitor. Stored as a source so extract_signals grounds claims against it.
export async function competitorKnowledge(
  name: string,
  businessIdea: string
): Promise<string> {
  if (isFixtureMode()) return "";
  try {
    const res = await getModel().invoke([
      {
        role: "system",
        content:
          "You are a competitive analyst. State what you know about a company " +
          "factually and concisely. If you are unsure, say so rather than inventing.",
      },
      {
        role: "user",
        content:
          `Company: ${name}\n` +
          `Context: a company in the space of "${businessIdea}".\n` +
          "In 4-6 sentences, cover its positioning, main products or features, " +
          "pricing, target customer, recent releases, and funding or investors.",
      },
    ]);
    return String(res.content ?? "").trim();
  } catch {
    return "";
  }
}
