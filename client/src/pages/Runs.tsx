import { RunHistory } from "../components/RunHistory.js";

export function Runs() {
  return (
    <div className="page-enter">
      <h1 className="mb-4 font-display text-2xl font-medium uppercase tracking-wide">
        Run history
      </h1>
      <RunHistory />
    </div>
  );
}
