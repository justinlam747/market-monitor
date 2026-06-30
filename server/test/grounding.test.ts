import { describe, it, expect } from "vitest";
import {
  isClaimGrounded,
  evaluateEvidence,
  scoreCompetitor,
} from "../src/agent/tools/evaluator.js";
import { extractClaims } from "../src/agent/tools/extractor.js";
import { SPARSE_SOURCE } from "../src/fixtures/dataset.js";
import { makeCompetitor, makeSource, makeClaim } from "./helpers.js";

const TEXT = "Hypesonic is an AI marketing platform for DTC ecommerce brands.";

describe("isClaimGrounded", () => {
  it("rejects a claim with no source evidence (PRD §13.4)", () => {
    const sources = [makeSource("s1", "c1", TEXT)];
    const nullEvidence = makeClaim("cl1", "c1", "s1", "positioning", "x", null);
    const emptyEvidence = makeClaim("cl2", "c1", "s1", "positioning", "x", "");
    const noSource = makeClaim("cl3", "c1", null, "positioning", "x", "AI marketing platform");
    expect(isClaimGrounded(nullEvidence, sources)).toBe(false);
    expect(isClaimGrounded(emptyEvidence, sources)).toBe(false);
    expect(isClaimGrounded(noSource, sources)).toBe(false);
  });

  it("rejects invalid evidence not present in the source text (PRD §13.5)", () => {
    const sources = [makeSource("s1", "c1", TEXT)];
    const fabricated = makeClaim(
      "cl1",
      "c1",
      "s1",
      "pricing",
      "$5000/mo",
      "costs five thousand dollars per month" // not in TEXT
    );
    expect(isClaimGrounded(fabricated, sources)).toBe(false);
  });

  it("accepts a claim whose evidence is a verbatim substring of the source", () => {
    const sources = [makeSource("s1", "c1", TEXT)];
    const grounded = makeClaim(
      "cl1",
      "c1",
      "s1",
      "positioning",
      "AI marketing platform",
      "AI marketing platform for DTC ecommerce brands"
    );
    expect(isClaimGrounded(grounded, sources)).toBe(true);
  });
});

describe("evaluateEvidence", () => {
  it("does not mark a competitor complete when only ungrounded claims exist", () => {
    const competitors = [makeCompetitor("c1", "Acme")];
    const sources = [makeSource("s1", "c1", TEXT)];
    const claims = [
      makeClaim("cl1", "c1", "s1", "positioning", "x", "made up evidence"),
    ];
    const result = evaluateEvidence(competitors, claims, sources);
    expect(result.weakEvidence).toBe(true);
    expect(result.competitors[0]!.status).not.toBe("complete");
    const score = scoreCompetitor("c1", claims, sources);
    expect(score.groundedClaimCount).toBe(0);
  });

  it("marks a competitor complete with grounded positioning, target, and feature", () => {
    const competitors = [makeCompetitor("c1", "Acme")];
    const sources = [
      makeSource(
        "s1",
        "c1",
        "Acme positioning here. It serves small teams. It has dashboards."
      ),
    ];
    const claims = [
      makeClaim("cl1", "c1", "s1", "positioning", "p", "Acme positioning here"),
      makeClaim("cl2", "c1", "s1", "target_customer", "t", "It serves small teams"),
      makeClaim("cl3", "c1", "s1", "feature", "f", "It has dashboards"),
    ];
    const result = evaluateEvidence(competitors, claims, sources);
    expect(result.weakEvidence).toBe(false);
    expect(result.competitors[0]!.status).toBe("complete");
  });
});

describe("extractor (fixture mode)", () => {
  it("marks missing fields as unknown with null evidence (PRD §13.6)", async () => {
    const claims = await extractClaims({
      url: SPARSE_SOURCE.url,
      text: SPARSE_SOURCE.text,
    });
    const target = claims.find((c) => c.type === "target_customer");
    expect(target).toBeDefined();
    expect(target!.value).toBe("unknown");
    expect(target!.evidence).toBeNull();
  });
});
