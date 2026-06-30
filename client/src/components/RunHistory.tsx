import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Spinner } from "@heroui/react";
import type { RunListItem } from "@shared/types";
import { listRuns } from "../api.js";

export function RunHistory() {
  const [runs, setRuns] = useState<RunListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSpinner, setShowSpinner] = useState(false);

  useEffect(() => {
    // Only reveal a spinner if the load is genuinely slow; fast loads show none.
    const t = setTimeout(() => setShowSpinner(true), 400);
    listRuns()
      .then(setRuns)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => clearTimeout(t));
    return () => clearTimeout(t);
  }, []);

  if (error) return <p className="text-default-600">{error}</p>;
  if (!runs)
    return showSpinner ? (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner color="default" />
      </div>
    ) : null;
  if (runs.length === 0)
    return (
      <p className="text-default-500">
        No runs yet. Start one from the Analyze page.
      </p>
    );

  return (
    <table className="w-full text-[15px]">
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
  );
}
