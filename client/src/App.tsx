import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { User } from "@heroui/react";
import type { RunListItem } from "@shared/types";
import { fetchRuns, getCachedRuns } from "./api.js";

function IconAnalyze() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  );
}
function IconRuns() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M3 12h18M3 18h12" />
    </svg>
  );
}
function IconAbout() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  );
}

function NavItem({
  to,
  active,
  icon,
  label,
}: {
  to: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-2 py-2 text-sm font-semibold outline-none transition-colors ${
        active ? "text-foreground" : "text-default-400 hover:text-foreground"
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

export function App() {
  const { pathname } = useLocation();
  const [runs, setRuns] = useState<RunListItem[]>(
    () => getCachedRuns()?.slice(0, 10) ?? []
  );

  // Keep recent runs fresh as you navigate; the cache avoids refetching within
  // its TTL (and a new run invalidates it).
  useEffect(() => {
    fetchRuns()
      .then((r) => setRuns(r.slice(0, 10)))
      .catch(() => undefined);
  }, [pathname]);

  return (
    <div className="flex min-h-screen text-foreground">
      <aside className="sticky top-3 m-3 flex h-[calc(100vh-1.5rem)] w-[236px] shrink-0 flex-col gap-1 rounded-[28px] bg-content1/65 p-4 shadow-[0_10px_40px_-12px_rgba(80,60,30,0.18)] backdrop-blur-xl">
        <div className="px-2 pb-4 pt-1">
          <Link
            to="/"
            className="font-brand text-[19px] font-medium uppercase tracking-[0.2em] text-foreground outline-none"
          >
            Market Monitor
          </Link>
        </div>

        <nav className="flex flex-col gap-0.5">
          <NavItem to="/" active={pathname === "/"} icon={<IconAnalyze />} label="Analyze" />
          <NavItem
            to="/runs"
            active={pathname.startsWith("/runs")}
            icon={<IconRuns />}
            label="Runs"
          />
          <NavItem
            to="/about"
            active={pathname.startsWith("/about")}
            icon={<IconAbout />}
            label="About"
          />
        </nav>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto no-scrollbar">
          <p className="px-2 pb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-default-400">
            Recent runs
          </p>
          <div className="flex flex-col">
            {runs.length === 0 && (
              <p className="px-2 text-xs text-default-300">No runs yet.</p>
            )}
            {runs.map((r) => {
              const active = pathname.startsWith(`/run/${r.id}`);
              return (
                <Link
                  key={r.id}
                  to={`/run/${r.id}`}
                  title={r.businessIdea || r.companyUrl || r.id}
                  className={`truncate px-2 py-1.5 text-[13px] outline-none transition-colors ${
                    active
                      ? "font-semibold text-foreground"
                      : "text-default-400 hover:text-foreground"
                  }`}
                >
                  {r.businessIdea || r.companyUrl || r.id}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="mt-2 px-1 pt-2">
          <User
            name="Quander"
            classNames={{ name: "text-[#593d3b] font-medium" }}
            avatarProps={{ size: "sm", name: "Q", className: "bg-[#8a7968] text-white" }}
          />
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="px-8 py-7">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
