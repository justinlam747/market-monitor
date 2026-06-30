import { Link } from "@heroui/react";
import type { SourceState } from "@shared/types";

function isXSource(url: string): boolean {
  return /(^|\/\/)([^/]*\.)?(x\.com|twitter\.com)\//.test(url);
}

export function SourceList({ sources }: { sources: SourceState[] }) {
  if (sources.length === 0) {
    return <p className="text-xs text-default-400">No sources yet.</p>;
  }
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm">
      {sources.map((s) => {
        const tag = isXSource(s.url) ? "X" : s.url ? "" : "model";
        return (
          <li key={s.id}>
            {tag && (
              <span className="mr-1 rounded bg-content2 px-1 text-[10px] font-semibold uppercase tracking-wide text-default-500">
                {tag}
              </span>
            )}
            {s.url ? (
              <Link href={s.url} isExternal size="sm" color="foreground" underline="hover">
                {s.title || s.url}
              </Link>
            ) : (
              <span className="text-foreground">{s.title || "Model knowledge"}</span>
            )}
            {s.snippet && (
              <span className="text-xs text-default-400"> — {s.snippet}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
