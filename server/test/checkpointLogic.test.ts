import { describe, it, expect } from "vitest";
import {
  applyCompetitorResolution,
  applySourceResolution,
  applyClaimResolution,
  applyIdentityResolution,
  applyGapResolution,
} from "../src/agent/checkpointLogic.js";
import { makeState, makeSource, makeClaim, makeCompetitor } from "./helpers.js";

describe("checkpoint resolutions (review mode)", () => {
  it("removes a rejected source from state, along with its claims (add-on §11)", () => {
    const state = makeState({
      sources: [
        makeSource("s1", "c1", "text one"),
        makeSource("s2", "c1", "text two"),
      ],
      claims: [
        makeClaim("cl1", "c1", "s1", "positioning", "p", "text one"),
        makeClaim("cl2", "c1", "s2", "feature", "f", "text two"),
      ],
    });
    const update = applySourceResolution(state, {
      action: "reject",
      rejectedIds: ["s1"],
    });
    expect(update.sources?.map((s) => s.id)).toEqual(["s2"]);
    // The claim grounded in the rejected source is dropped too.
    expect(update.claims?.map((c) => c.id)).toEqual(["cl2"]);
  });

  it("excludes a rejected claim so it can't reach gap analysis (add-on §11)", () => {
    const state = makeState({
      claims: [
        makeClaim("cl1", "c1", "s1", "positioning", "p", "e"),
        makeClaim("cl2", "c1", "s1", "feature", "f", "e"),
      ],
    });
    const update = applyClaimResolution(state, {
      action: "reject",
      rejectedIds: ["cl1"],
    });
    expect(update.claims?.map((c) => c.id)).toEqual(["cl2"]);
  });

  it("replaces the competitor list on edit", () => {
    const state = makeState({
      competitors: [makeCompetitor("c1", "Old")],
    });
    const update = applyCompetitorResolution(state, {
      action: "edit",
      payload: [
        { id: "c1", name: "Renamed" },
        { name: "BrandNew" },
      ],
    });
    expect(update.competitors).toHaveLength(2);
    expect(update.competitors!.map((c) => c.name)).toEqual([
      "Renamed",
      "BrandNew",
    ]);
  });

  it("removes rejected competitors", () => {
    const state = makeState({
      competitors: [makeCompetitor("c1", "Keep"), makeCompetitor("c2", "Drop")],
    });
    const update = applyCompetitorResolution(state, {
      action: "reject",
      rejectedIds: ["c2"],
    });
    expect(update.competitors?.map((c) => c.name)).toEqual(["Keep"]);
  });

  it("applies edited identity", () => {
    const state = makeState({ businessIdea: "old", targetCustomer: "old" });
    const update = applyIdentityResolution(state, {
      action: "edit",
      payload: { businessIdea: "new idea" },
    });
    expect(update.businessIdea).toBe("new idea");
    expect(update.targetCustomer).toBe("old");
  });

  it("applies edited gaps", () => {
    const state = makeState({ gaps: ["a"], recommendation: "old" });
    const update = applyGapResolution(state, {
      action: "edit",
      payload: { gaps: ["b", "c"], recommendation: "new" },
    });
    expect(update.gaps).toEqual(["b", "c"]);
    expect(update.recommendation).toBe("new");
  });

  it("is a no-op on approve", () => {
    const state = makeState({
      sources: [makeSource("s1", "c1", "t")],
      claims: [makeClaim("cl1", "c1", "s1", "feature", "f", "t")],
    });
    expect(applySourceResolution(state, { action: "approve" })).toEqual({});
    expect(applyClaimResolution(state, { action: "approve" })).toEqual({});
  });
});
