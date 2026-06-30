import type { AgentState, AgentUpdate } from "../state.js";
import { getRunContext } from "../runContext.js";
import { validateUrl, detectPromptInjection } from "../safety.js";
import { readPage } from "../tools/reader.js";
import { extractIdentity } from "../tools/identity.js";

// Node: validate_input — safety gate (overrides run mode).
export async function validateInput(state: AgentState): Promise<AgentUpdate> {
  const p = getRunContext(state.runId);
  const v = validateUrl(state.companyUrl);

  if (!v.ok) {
    await p.recordStep("validate_input", {
      reasoning: v.reason,
      message: `[validate_input] Blocked URL: ${v.reason}`,
    });
    p.emit("needs_review", {
      node: "validate_input",
      message: `Unsafe URL blocked: ${v.reason}`,
      data: { reason: v.reason },
    });
    return { safetyFlags: { ...state.safetyFlags, blockedUrl: true } };
  }

  await p.recordStep("validate_input", {
    message: `[validate_input] URL OK: ${v.normalizedUrl}`,
  });
  return { companyUrl: v.normalizedUrl ?? state.companyUrl };
}

// Node: scrape_company_site — read the company's own page, scan for injection.
export async function scrapeCompanySite(
  state: AgentState
): Promise<AgentUpdate> {
  const p = getRunContext(state.runId);
  const read = await readPage(state.companyUrl);
  const injection = detectPromptInjection(read.text);

  await p.recordStep("scrape_company_site", {
    message: `[scrape_company_site] Loaded ${read.text.length} chars from company site`,
    reasoning: injection
      ? "Prompt-injection patterns detected in page text; flagged for review."
      : undefined,
  });
  if (injection) {
    p.emit("needs_review", {
      node: "scrape_company_site",
      message: "Possible prompt injection detected on company page.",
    });
  }

  return {
    companyPageText: read.text,
    safetyFlags: {
      ...state.safetyFlags,
      promptInjectionDetected: injection || undefined,
    },
  };
}

// Node: extract_identity — derive business idea + target customer.
export async function extractIdentityNode(
  state: AgentState
): Promise<AgentUpdate> {
  const p = getRunContext(state.runId);
  const identity = await extractIdentity(
    state.companyUrl,
    state.companyPageText ?? "",
    state.optionalDescription
  );

  await p.updateRun({
    businessIdea: identity.businessIdea,
    targetCustomer: identity.targetCustomer,
  });
  p.emit("identity", {
    node: "extract_identity",
    message: `[extract_identity] ${identity.businessIdea}`,
    data: identity,
  });
  await p.recordStep("extract_identity", {
    message: `[extract_identity] Identified: ${identity.businessIdea}`,
    output: identity,
  });

  return {
    businessIdea: identity.businessIdea,
    targetCustomer: identity.targetCustomer,
  };
}
