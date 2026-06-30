import { describe, it, expect } from "vitest";
import {
  firstJsonArray,
  parseCompetitors,
  parseXSignals,
} from "../src/agent/tools/grokX.js";
import { mergeCompetitors } from "../src/agent/tools/competitorDiscovery.js";

describe("firstJsonArray", () => {
  it("parses a fenced JSON array with surrounding prose", () => {
    const text =
      "Here are the results:\n```json\n[{\"name\":\"Acme\"}]\n```\nHope that helps!";
    expect(firstJsonArray(text)).toEqual([{ name: "Acme" }]);
  });
  it("parses a bare array", () => {
    expect(firstJsonArray('[{"name":"A"},{"name":"B"}]')).toHaveLength(2);
  });
  it("wraps a single object in an array", () => {
    expect(firstJsonArray('{"name":"Solo"}')).toEqual([{ name: "Solo" }]);
  });
  it("returns [] on garbage", () => {
    expect(firstJsonArray("not json at all")).toEqual([]);
    expect(firstJsonArray("")).toEqual([]);
  });
});

describe("parseCompetitors", () => {
  it("extracts name/handle/url and strips a leading @", () => {
    const text =
      '[{"name":"Hypesonic","handle":"@hypesonic","url":"https://hypesonic.com"}]';
    expect(parseCompetitors(text)).toEqual([
      { name: "Hypesonic", handle: "hypesonic", url: "https://hypesonic.com" },
    ]);
  });
  it("drops entries without a name and tolerates missing fields", () => {
    const text = '[{"handle":"x"},{"name":"BrandPilot"}]';
    expect(parseCompetitors(text)).toEqual([
      { name: "BrandPilot", handle: undefined, url: undefined },
    ]);
  });
});

describe("parseXSignals", () => {
  it("requires value + quote + url and defaults an unknown type", () => {
    const text = JSON.stringify([
      { type: "funding", value: "Series B", quote: "raised $20M", url: "https://x.com/a/status/1" },
      { type: "weird", value: "Launched X", quote: "shipped today", url: "https://x.com/a/status/2" },
      { value: "no quote" }, // dropped
    ]);
    const out = parseXSignals(text);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ type: "funding", url: "https://x.com/a/status/1" });
    expect(out[1].type).toBe("recent_signal"); // unknown -> default
  });
  it("falls back to citations for a missing url", () => {
    const text = JSON.stringify([{ type: "recent_signal", value: "v", quote: "q" }]);
    const out = parseXSignals(text, ["https://x.com/c/status/9"]);
    expect(out[0].url).toBe("https://x.com/c/status/9");
  });
});

describe("mergeCompetitors", () => {
  it("ranks names found by both sources first and carries X handle/url", () => {
    const merged = mergeCompetitors(
      ["Hypesonic", "BrandPilot"],
      [
        { name: "Hypesonic", handle: "hypesonic", url: "https://hypesonic.com" },
        { name: "Lumen", handle: "lumen" },
      ],
      3
    );
    expect(merged.map((c) => c.name)).toEqual(["Hypesonic", "Lumen", "BrandPilot"]);
    expect(merged[0]).toMatchObject({ handle: "hypesonic", url: "https://hypesonic.com" });
  });
  it("dedupes case-insensitively and caps to max", () => {
    const merged = mergeCompetitors(
      ["Acme", "acme", "B", "C", "D"],
      [{ name: "ACME" }],
      2
    );
    expect(merged).toHaveLength(2);
    expect(merged[0].name.toLowerCase()).toBe("acme");
  });
});
