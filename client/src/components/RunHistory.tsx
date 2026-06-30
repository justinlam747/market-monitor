import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Spinner } from "@heroui/react";
import type { RunListItem } from "@shared/types";
import { fetchRuns, getCachedRuns } from "../api.js";

export function RunHistory() {
  // Render instantly from cache when available; otherwise show a spinner.
  const [runs, setRuns] = useState<RunListItem[] | null>(() => getCachedRuns());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Revalidate in the background (stale-while-revalidate).
    fetchRuns(true)
      .then((d) => {
        if (!cancelled) setRuns(d);
      })
      .catch((e) => {
        if (!cancelled && getCachedRuns() === null) {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p className="text-default-600">{error}</p>;
  if (!runs)
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner color="default" />
      </div>
    );
  if (runs.length === 0)
    return (
      <p className="text-default-500">
        No runs yet. Start one from the Analyze page.
      </p>
    );

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[640px] text-[15px]">
      <thead>
        <tr className="text-left text-xs uppercase tracking-wider text-default-500">
          <th className="pb-3 pr-6 font-semibold">Company / Idea</th>
          <th className="pb-3 pr-6 font-semibold">Mode</th>
          <th className="pb-3 pr-6 font-semibold">Status</th>
          <th className="pb-3 pr-6 font-semibold">Competitors</th>
          <th className="pb-3 font-semibold">Started</th>
        </tr>
      </thead>
      <tbody>
        {runs.map((r) => (
          <tr key={r.id} className="border-t border-default-200/50 align-top">
            <td className="py-5 pr-6">
              <RouterLink
                className="font-medium text-foreground no-underline hover:opacity-70"
                to={`/run/${r.id}`}
              >
                {r.businessIdea || r.companyUrl || r.id}
              </RouterLink>
            </td>
            <td className="py-5 pr-6 text-default-600">{r.mode}</td>
            <td className="py-5 pr-6 text-default-600">{r.status}</td>
            <td className="py-5 pr-6 text-default-600">{r.competitorCount}</td>
            <td className="py-5 text-default-500">
              {new Date(r.startedAt).toLocaleString()}
            </td>
          </tr>
        ))}
      </tbody>
      </table>
    </div>
  );
}
