import { AnalyzeForm } from "../components/AnalyzeForm.js";

export function Analyze() {
  return (
    <div className="page-enter mx-auto max-w-[720px] py-6">
      <div className="mb-6">
        <h1 className="mb-3 font-display text-[26px] font-medium uppercase leading-tight tracking-wide text-foreground sm:text-[34px]">
          Validate your idea against the competition
        </h1>
        <p className="max-w-[620px] text-[15px] text-default-500">
          An autonomous agent researches competitors and surfaces your
          differentiation gaps live.
        </p>
      </div>
      <AnalyzeForm />
    </div>
  );
}
