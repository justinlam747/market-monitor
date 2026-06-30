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

function IconMenu() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}
function IconClose() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function NavItem({
  to,
  active,
  icon,
  label,
  onClick,
}: {
  to: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
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
  const [menuOpen, setMenuOpen] = useState(false);

  // Keep recent runs fresh as you navigate; the cache avoids refetching within
  // its TTL (and a new run invalidates it).
  useEffect(() => {
    fetchRuns()
      .then((r) => setRuns(r.slice(0, 10)))
      .catch(() => undefined);
  }, [pathname]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="min-h-screen text-foreground lg:flex">
      {/* Mobile top bar — brand + hamburger. Hidden on lg where the sidebar shows. */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-divider bg-background/80 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Link
          to="/"
          className="font-brand text-[17px] font-medium uppercase tracking-[0.2em] text-foreground outline-none"
        >
          Market Monitor
        </Link>
        <button
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((o) => !o)}
          className="grid h-9 w-9 place-items-center rounded-full text-foreground outline-none hover:bg-content2"
        >
          {menuOpen ? <IconClose /> : <IconMenu />}
        </button>
      </header>

      {/* Backdrop behind the mobile drawer. */}
      {menuOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={closeMenu}
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[260px] max-w-[80vw] shrink-0 flex-col gap-1 bg-content1 p-4 shadow-[0_10px_40px_-12px_rgba(80,60,30,0.18)] transition-transform duration-300 ease-out lg:sticky lg:top-3 lg:z-auto lg:m-3 lg:h-[calc(100vh-1.5rem)] lg:w-[236px] lg:max-w-none lg:rounded-[28px] lg:bg-content1/65 lg:backdrop-blur-xl lg:transition-none ${
          menuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="px-2 pb-4 pt-1">
          <Link
            to="/"
            className="font-brand text-[19px] font-medium uppercase tracking-[0.2em] text-foreground outline-none"
          >
            Market Monitor
          </Link>
        </div>

        <nav className="flex flex-col gap-0.5">
          <NavItem to="/" active={pathname === "/"} icon={<IconAnalyze />} label="Analyze" onClick={closeMenu} />
          <NavItem
            to="/runs"
            active={pathname.startsWith("/runs")}
            icon={<IconRuns />}
            label="Runs"
            onClick={closeMenu}
          />
          <NavItem
            to="/about"
            active={pathname.startsWith("/about")}
            icon={<IconAbout />}
            label="About"
            onClick={closeMenu}
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
                  onClick={closeMenu}
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
        <div className="px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
