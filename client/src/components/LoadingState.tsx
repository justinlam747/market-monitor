import { Spinner } from "@heroui/react";

export function LoadingState({ label = "Working…" }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center">
      <Spinner size="sm" label={label} color="default" />
    </div>
  );
}
