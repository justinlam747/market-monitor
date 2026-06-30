import { useNavigate } from "react-router-dom";
import { Button, Modal, ModalBody, ModalContent } from "@heroui/react";
import type { LiveState } from "../useRunStream.js";
import { ReasoningTimeline } from "./ReasoningTimeline.js";
import { RunGraph } from "./RunGraph.js";
import { CheckpointControls } from "./CheckpointControls.js";
import { cancelRun, pauseRun, resumeRun, reviewRun } from "../api.js";

export function LiveAgentView({
  runId,
  state,
}: {
  runId: string;
  state: LiveState;
}) {
  const navigate = useNavigate();
  const claimCount = state.competitors.reduce((n, c) => n + c.claims.length, 0);
  const running = state.status === "running";
  const paused = state.status === "waiting_for_user";

  return (
    <div className="flex flex-col lg:h-[calc(100vh-3.5rem)]">
      {/* No container — url top-left, controls top-right. */}
      <header className="flex items-start justify-between gap-4 pb-4">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold">
            {state.businessIdea ?? state.companyUrl ?? "Analyzing…"}
          </h1>
          <div className="mt-1 text-xs text-default-500">
            {state.mode && <span>{state.mode} mode · </span>}
            <span className="text-default-600">{state.status}</span>
            <span className="text-default-400">
              {" "}
              · {state.competitors.length} competitors · {claimCount} signals
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {state.status === "complete" && (
            <Button color="primary" variant="solid" size="sm" onPress={() => navigate(`/run/${runId}/summary`)}>
              Read Report
            </Button>
          )}

          {state.status === "needs_review" && (
            <>
              <Button color="primary" variant="solid" size="sm" onPress={() => reviewRun(runId, "accept")}>
                Accept
              </Button>
              <Button color="default" variant="bordered" size="sm" onPress={() => reviewRun(runId, "reject")}>
                Reject
              </Button>
            </>
          )}

          {(running || paused) && (
            <>
              <Button isIconOnly color="default" variant="bordered" size="sm" aria-label="Run" isDisabled={!paused} onPress={() => resumeRun(runId)}>
                ▶
              </Button>
              <Button isIconOnly color="default" variant="bordered" size="sm" aria-label="Pause" isDisabled={!running} onPress={() => pauseRun(runId)}>
                ❚❚
              </Button>
              <Button isIconOnly color="default" variant="bordered" size="sm" aria-label="Stop" onPress={() => cancelRun(runId)}>
                ■
              </Button>
            </>
          )}
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-8 lg:min-h-0 lg:grid-cols-[360px_1fr] lg:gap-10">
        <section className="flex min-h-0 flex-col">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-default-400">
            Tool calls
          </h2>
          <div className="overflow-y-auto no-scrollbar pr-1 lg:min-h-0 lg:flex-1">
            <ReasoningTimeline timeline={state.timeline} />
          </div>
        </section>

        <section className="flex min-h-0 flex-col">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-default-400">
            Agent graph
          </h2>
          <div className="min-h-[360px] lg:min-h-0 lg:flex-1">
            <RunGraph timeline={state.timeline} status={state.status} />
          </div>
        </section>
      </div>

      <Modal isOpen={!!state.activeCheckpoint} isDismissable={false} hideCloseButton size="2xl" scrollBehavior="inside">
        <ModalContent>
          <ModalBody className="overflow-x-hidden py-6">
            {state.activeCheckpoint && (
              <CheckpointControls runId={runId} checkpoint={state.activeCheckpoint} />
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </div>
  );
}
