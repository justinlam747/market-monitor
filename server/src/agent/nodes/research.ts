import type { AgentState, AgentUpdate } from "../state.js";
import type { ClaimState, CompetitorState, SourceState } from "@shared/types";
import { getRunContext } from "../runContext.js";
import { LIMITS } from "../limits.js";
import { newId } from "../tools/ids.js";
import { searchSources } from "../tools/search.js";
import { readPage } from "../tools/reader.js";
import { extractClaims } from "../tools/extractor.js";
import { discoverCompetitors } from "../tools/competitorDiscovery.js";
import { xSignalsFor } from "../tools/grokX.js";
import { competitorKnowledge } from "../tools/competitorKnowledge.js";
import { hasXai } from "../../config.js";
import { evaluateEvidence } from "../tools/evaluator.js";

// Node: discover_competitors — propose competitors from the company identity.
export async function discoverCompetitorsNode(
  state: AgentState
): Promise<AgentUpdate> {
  const p = getRunContext(state.runId);
  const discovered = await discoverCompetitors(
    { businessIdea: state.businessIdea ?? "", targetCustomer: state.targetCustomer ?? "" },
    state.companyPageText ?? ""
  );

  const competitors: CompetitorState[] = discovered
    .slice(0, LIMITS.maxCompetitors)
    .map((d) => ({
      id: newId("cmp"),
      name: d.name,
      handle: d.handle,
      urls: d.url ? [d.url] : [],
      status: "pending",
    }));

  for (const c of competitors) await p.upsertCompetitor(c);

  const names = competitors.map((c) => c.name);
  await p.recordStep("discover_competitors", {
    message: `[discover_competitors] Found ${competitors.length}: ${names.join(", ") || "(none)"}`,
    output: names,
  });

  return { competitors };
}

// Node: collect_sources — gather sources for every incomplete competitor.
export async function collectSources(state: AgentState): Promise<AgentUpdate> {
  const p = getRunContext(state.runId);
  const sources: SourceState[] = [...state.sources];
  const addedSources: SourceState[] = [];
  const xClaims: ClaimState[] = [];
  const competitors = state.competitors.map((c) => ({ ...c }));

  for (const comp of competitors) {
    if (comp.status === "complete") continue;
    const existing = sources.filter((s) => s.competitorId === comp.id);
    const firstPass = existing.length === 0;
    const room = LIMITS.maxSourcesPerCompetitor - existing.length;
    if (room <= 0) continue;

    comp.status = "researching";
    // Bias toward recent signals: latest releases, funding/backers, momentum.
    const query =
      `${comp.name} latest news product launch update funding investors pricing 2025 2026`.trim();
    p.emit("step", {
      node: "collect_sources",
      message: `[collect_sources] Searching "${query}"`,
    });

    const results = await searchSources(query, LIMITS.maxResultsPerQuery);
    const seenUrls = new Set(existing.map((s) => s.url));
    let added = 0;

    for (const r of results) {
      if (added >= room) break;
      if (seenUrls.has(r.url)) continue;
      seenUrls.add(r.url);

      const read = await readPage(r.url);
      const source: SourceState = {
        id: newId("src"),
        competitorId: comp.id,
        url: r.url,
        title: r.title ?? read.title,
        snippet: r.snippet,
        text: read.text,
      };
      sources.push(source);
      addedSources.push(source);
      await p.upsertSource(source);
      added++;
    }

    // OpenAI knowledge — an LLM call on the competitor, stored as a source for
    // extract_signals to ground claims against (first pass only).
    if (firstPass) {
      const knowledge = await competitorKnowledge(comp.name, state.businessIdea ?? "");
      if (knowledge) {
        const source: SourceState = {
          id: newId("src"),
          competitorId: comp.id,
          url: "",
          title: `OpenAI knowledge: ${comp.name}`,
          snippet: "",
          text: knowledge,
        };
        sources.push(source);
        addedSources.push(source);
        await p.upsertSource(source);
      }
    }

    // Grok X (Twitter) signals — recent launches/funding/momentum, each grounded
    // in a real post. Fetched once per competitor (first research pass only).
    if (firstPass && hasXai()) {
      p.emit("step", {
        node: "collect_sources",
        message: `[collect_sources] Searching X for "${comp.name}"`,
      });
      const signals = await xSignalsFor(comp.name, comp.handle);
      for (const sig of signals) {
        if (seenUrls.has(sig.url)) continue;
        seenUrls.add(sig.url);
        const source: SourceState = {
          id: newId("src"),
          competitorId: comp.id,
          url: sig.url,
          title: `X · ${comp.handle ? "@" + comp.handle : comp.name}`,
          snippet: sig.value,
          text: sig.quote,
        };
        sources.push(source);
        addedSources.push(source);
        await p.upsertSource(source);
        // Grok already returns structured, quoted signals — create the grounded
        // claim directly (evidence = quote = source.text) so extract_signals skips it.
        const claim: ClaimState = {
          id: newId("clm"),
          competitorId: comp.id,
          sourceId: source.id,
          type: sig.type,
          value: sig.value,
          evidence: sig.quote,
          confidence: 0.8,
        };
        xClaims.push(claim);
        await p.upsertClaim(claim);
      }
    }

    await p.upsertCompetitor(comp);
  }

  await p.recordStep("collect_sources", {
    message: `[collect_sources] ${sources.length} total sources gathered`,
    output: addedSources,
  });

  // One research cycle consumed.
  return {
    sources,
    competitors,
    claims: [...state.claims, ...xClaims],
    iterations: state.iterations + 1,
  };
}

// Node: extract_signals — extract source-grounded claims from new sources.
export async function extractSignals(state: AgentState): Promise<AgentUpdate> {
  const p = getRunContext(state.runId);
  const claims: ClaimState[] = [...state.claims];
  const addedClaims: ClaimState[] = [];
  const sourcesWithClaims = new Set(
    claims.map((c) => c.sourceId).filter(Boolean) as string[]
  );

  let extracted = 0;
  for (const source of state.sources) {
    if (sourcesWithClaims.has(source.id)) continue;
    if (!source.text) continue;

    const results = await extractClaims({ url: source.url, text: source.text });
    for (const e of results) {
      const claim: ClaimState = {
        id: newId("clm"),
        competitorId: source.competitorId,
        sourceId: source.id,
        type: e.type,
        value: e.value,
        evidence: e.evidence,
        confidence: e.confidence,
      };
      claims.push(claim);
      addedClaims.push(claim);
      await p.upsertClaim(claim);
      extracted++;
    }
  }

  await p.recordStep("extract_signals", {
    message: `[extract_signals] Extracted ${extracted} claims`,
    output: addedClaims,
  });

  return { claims };
}

// Node: evaluate_evidence — score grounded evidence per competitor (pure logic).
export async function evaluateEvidenceNode(
  state: AgentState
): Promise<AgentUpdate> {
  const p = getRunContext(state.runId);
  const result = evaluateEvidence(state.competitors, state.claims, state.sources);

  for (const c of result.competitors) await p.upsertCompetitor(c);

  const summary = result.evidenceScores
    .map((s) => {
      const missing: string[] = [];
      if (!s.hasPositioning) missing.push("positioning");
      if (!s.hasTargetCustomer) missing.push("target customer");
      if (!s.hasFeatures) missing.push("features");
      return missing.length
        ? `${s.competitorId}: missing ${missing.join(", ")}`
        : `${s.competitorId}: complete`;
    })
    .join(" | ");

  p.emit("evidence", {
    node: "evaluate_evidence",
    message: `[evaluate_evidence] ${result.weakEvidence ? "Evidence weak" : "Evidence sufficient"}`,
    data: result.evidenceScores,
  });
  await p.recordStep("evaluate_evidence", {
    message: `[evaluate_evidence] ${summary || "no competitors"}`,
    output: result.evidenceScores,
  });

  return {
    competitors: result.competitors,
    evidenceScores: result.evidenceScores,
    safetyFlags: { ...state.safetyFlags, weakEvidence: result.weakEvidence },
  };
}
