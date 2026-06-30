import { useParams } from "react-router-dom";
import { useRunStream } from "../useRunStream.js";
import { LiveAgentView } from "../components/LiveAgentView.js";
import { LoadingState } from "../components/LoadingState.js";

export function LiveAgent() {
  const { id } = useParams<{ id: string }>();
  if (!id) return <div className="text-default-600">Missing run id.</div>;
  return <LiveAgentInner runId={id} />;
}

function LiveAgentInner({ runId }: { runId: string }) {
  const state = useRunStream(runId);
  if (state.status === "loading")
    return <LoadingState label="Connecting to agent…" />;
  return <LiveAgentView runId={runId} state={state} />;
}
