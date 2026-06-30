import { z } from "zod";
import { isFixtureMode } from "../../config.js";
import { getModel } from "../llm.js";
import { FIXTURE_COMPANY } from "../../fixtures/dataset.js";

export interface CompanyIdentity {
  businessIdea: string;
  targetCustomer: string;
}

const IdentitySchema = z.object({
  businessIdea: z
    .string()
    .describe("One sentence describing what the company does / its product."),
  targetCustomer: z
    .string()
    .describe("The specific customer segment the company serves."),
});

// Tool: identity extraction. Derives the company's business idea + target
// customer from its scraped landing page (and any user-provided description).
export async function extractIdentity(
  companyUrl: string,
  pageText: string,
  description?: string
): Promise<CompanyIdentity> {
  if (isFixtureMode()) {
    return {
      businessIdea: FIXTURE_COMPANY.businessIdea,
      targetCustomer: FIXTURE_COMPANY.targetCustomer,
    };
  }

  const model = getModel().withStructuredOutput(IdentitySchema, {
    name: "company_identity",
  });
  const result = await model.invoke([
    {
      role: "system",
      content:
        "You analyze a company's website to identify its business idea and target customer. " +
        "Base your answer only on the provided page text and description. " +
        "If something is unclear, give your best grounded inference.",
    },
    {
      role: "user",
      content:
        `Company URL: ${companyUrl}\n` +
        (description ? `Founder description: ${description}\n` : "") +
        `\nPage text:\n${pageText.slice(0, 6000)}`,
    },
  ]);
  return result as CompanyIdentity;
}
