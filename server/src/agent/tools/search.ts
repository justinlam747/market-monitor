import { isFixtureMode } from "../../config.js";
import { LIMITS } from "../limits.js";
import { FIXTURE_COMPANY, type FixtureSearchResult } from "../../fixtures/dataset.js";
import { getTavily } from "./tavilyClient.js";

export type SearchResult = FixtureSearchResult;

// Tool 1: Search. Returns public web results for a query.
export async function searchSources(
  query: string,
  limit = LIMITS.maxResultsPerQuery
): Promise<SearchResult[]> {
  if (isFixtureMode()) return fixtureSearch(query, limit);

  const tvly = getTavily();
  const res = await tvly.search(query, {
    maxResults: limit,
    searchDepth: "basic",
  });
  return (res.results ?? []).slice(0, limit).map((r) => ({
    url: r.url,
    title: r.title ?? r.url,
    snippet: r.content ?? "",
  }));
}

// Fixture search: match the competitor named in the query and return its
// canned sources as search hits.
function fixtureSearch(query: string, limit: number): SearchResult[] {
  const q = query.toLowerCase();
  const competitor = FIXTURE_COMPANY.competitors.find((c) =>
    q.includes(c.name.toLowerCase())
  );
  if (!competitor) return [];
  return competitor.sources.slice(0, limit).map((s) => ({
    url: s.url,
    title: s.title,
    snippet: s.snippet,
  }));
}
