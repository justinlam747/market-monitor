import { useMemo, useState, type ReactNode } from "react";
import { Button, Checkbox, Input, Textarea } from "@heroui/react";
import type { ClaimState, SourceState } from "@shared/types";
import type { ActiveCheckpoint } from "../useRunStream.js";
import { approveCheckpoint, editCheckpoint, rejectCheckpoint } from "../api.js";
import {
  CompetitorInputList,
  type EditableCompetitor,
} from "./CompetitorInputList.js";

const TITLES: Record<string, string> = {
  confirm_identity: "Confirm company identity",
  select_competitors: "Select competitors",
  review_sources: "Review sources",
  review_claims: "Review claims",
  review_gaps: "Approve gap analysis",
};

export function CheckpointControls({
  runId,
  checkpoint,
}: {
  runId: string;
  checkpoint: ActiveCheckpoint;
}) {
  const [busy, setBusy] = useState(false);
  const cid = checkpoint.checkpointId;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="shrink-0"
            aria-hidden="true"
          >
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
          <span>{TITLES[checkpoint.type] ?? checkpoint.type}</span>
        </h2>
        <span className="text-xs text-default-500">waiting for you</span>
      </div>

      <CheckpointBody
        type={checkpoint.type}
        payload={checkpoint.payload}
        busy={busy}
        onApprove={() => run(() => approveCheckpoint(runId, cid))}
        onEdit={(payload) => run(() => editCheckpoint(runId, cid, payload))}
        onReject={(ids) => run(() => rejectCheckpoint(runId, cid, ids))}
      />
    </div>
  );
}

interface BodyProps {
  type: string;
  payload: unknown;
  busy: boolean;
  onApprove: () => void;
  onEdit: (payload: unknown) => void;
  onReject: (rejectedIds: string[]) => void;
}

function CheckpointBody(props: BodyProps) {
  switch (props.type) {
    case "confirm_identity":
      return <IdentityBody {...props} />;
    case "select_competitors":
      return <CompetitorsBody {...props} />;
    case "review_sources":
      return <SourcesBody {...props} />;
    case "review_claims":
      return <ClaimsBody {...props} />;
    case "review_gaps":
      return <GapsBody {...props} />;
    default:
      return (
        <Actions>
          <Button color="default" isDisabled={props.busy} onPress={props.onApprove}>
            Approve & continue
          </Button>
        </Actions>
      );
  }
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="mt-4 flex flex-wrap gap-2.5">{children}</div>;
}

function IdentityBody({ payload, busy, onApprove, onEdit }: BodyProps) {
  const p = payload as { businessIdea?: string; targetCustomer?: string };
  const [businessIdea, setBusinessIdea] = useState(p.businessIdea ?? "");
  const [targetCustomer, setTargetCustomer] = useState(p.targetCustomer ?? "");
  const changed =
    businessIdea !== (p.businessIdea ?? "") ||
    targetCustomer !== (p.targetCustomer ?? "");

  return (
    <div className="flex flex-col gap-3">
      <Input
        label="Business idea"
        labelPlacement="outside"
        variant="bordered"
        value={businessIdea}
        onValueChange={setBusinessIdea}
      />
      <Input
        label="Target customer"
        labelPlacement="outside"
        variant="bordered"
        value={targetCustomer}
        onValueChange={setTargetCustomer}
      />
      <Actions>
        <Button color="default" isDisabled={busy} onPress={onApprove}>
          Approve
        </Button>
        <Button
          variant="flat"
          isDisabled={busy || !changed}
          onPress={() => onEdit({ businessIdea, targetCustomer })}
        >
          Save edits & continue
        </Button>
      </Actions>
    </div>
  );
}

function CompetitorsBody({ payload, busy, onApprove, onEdit }: BodyProps) {
  const initial = useMemo<EditableCompetitor[]>(
    () =>
      Array.isArray(payload)
        ? (payload as Array<{ id?: string; name: string }>).map((c) => ({
            id: c.id,
            name: c.name,
          }))
        : [],
    [payload]
  );
  const [comps, setComps] = useState<EditableCompetitor[]>(initial);

  return (
    <div>
      <p className="mb-2 text-xs text-default-400">
        Add, rename, or remove the discovered competitors.
      </p>
      <CompetitorInputList competitors={comps} onChange={setComps} />
      <Actions>
        <Button color="default" isDisabled={busy} onPress={onApprove}>
          Approve list
        </Button>
        <Button
          variant="flat"
          isDisabled={busy}
          onPress={() => onEdit(comps.filter((c) => c.name.trim()))}
        >
          Save edits & continue
        </Button>
      </Actions>
    </div>
  );
}

function RejectableList({
  items,
  render,
  busy,
  onApprove,
  onReject,
  approveLabel,
}: {
  items: { id: string }[];
  render: (item: { id: string }) => ReactNode;
  busy: boolean;
  onApprove: () => void;
  onReject: (ids: string[]) => void;
  approveLabel: string;
}) {
  const [rejected, setRejected] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setRejected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div>
      <ul className="no-scrollbar flex max-h-[46vh] flex-col gap-2 overflow-y-auto overflow-x-hidden">
        {items.map((it) => (
          <li
            key={it.id}
            className={`rounded-medium bg-content2 p-2.5 ${
              rejected.has(it.id) ? "line-through opacity-50" : ""
            }`}
          >
            <Checkbox
              size="sm"
              isSelected={rejected.has(it.id)}
              onValueChange={() => toggle(it.id)}
              classNames={{ base: "items-start max-w-full", label: "min-w-0" }}
            >
              <span className="block w-full break-words text-sm [overflow-wrap:anywhere]">
                {render(it)}
              </span>
            </Checkbox>
          </li>
        ))}
      </ul>
      <Actions>
        <Button color="default" isDisabled={busy} onPress={onApprove}>
          {approveLabel}
        </Button>
        <Button
          color="default"
          variant="bordered"
          isDisabled={busy || rejected.size === 0}
          onPress={() => onReject([...rejected])}
        >
          Reject selected ({rejected.size}) & continue
        </Button>
      </Actions>
    </div>
  );
}

function SourcesBody({ payload, busy, onApprove, onReject }: BodyProps) {
  const sources = (Array.isArray(payload) ? payload : []) as SourceState[];
  return (
    <RejectableList
      items={sources}
      busy={busy}
      onApprove={onApprove}
      onReject={onReject}
      approveLabel="Keep all & continue"
      render={(it) => {
        const s = it as SourceState;
        return (
          <>
            <strong>{s.title || s.url}</strong>
            <span className="text-xs text-default-400"> {s.url}</span>
          </>
        );
      }}
    />
  );
}

function ClaimsBody({ payload, busy, onApprove, onReject }: BodyProps) {
  const claims = (Array.isArray(payload) ? payload : []) as ClaimState[];
  return (
    <RejectableList
      items={claims}
      busy={busy}
      onApprove={onApprove}
      onReject={onReject}
      approveLabel="Keep all & continue"
      render={(it) => {
        const c = it as ClaimState;
        return (
          <>
            <span className="font-semibold text-default-500">[{c.type}]</span> {c.value}
            {c.evidence && (
              <span className="mt-1 block text-xs italic text-default-400">
                “{c.evidence}”
              </span>
            )}
          </>
        );
      }}
    />
  );
}

function GapsBody({ payload, busy, onApprove, onEdit }: BodyProps) {
  const p = payload as {
    gaps?: string[];
    sharedPatterns?: string[];
    recommendation?: string;
  };
  const [gapsText, setGapsText] = useState((p.gaps ?? []).join("\n"));
  const [recommendation, setRecommendation] = useState(p.recommendation ?? "");

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        label="Gaps (one per line)"
        labelPlacement="outside"
        variant="bordered"
        value={gapsText}
        onValueChange={setGapsText}
      />
      <Textarea
        label="Recommendation"
        labelPlacement="outside"
        variant="bordered"
        value={recommendation}
        onValueChange={setRecommendation}
      />
      <Actions>
        <Button color="default" isDisabled={busy} onPress={onApprove}>
          Approve
        </Button>
        <Button
          variant="flat"
          isDisabled={busy}
          onPress={() =>
            onEdit({
              gaps: gapsText
                .split("\n")
                .map((g) => g.trim())
                .filter(Boolean),
              sharedPatterns: p.sharedPatterns,
              recommendation,
            })
          }
        >
          Save edits & finish
        </Button>
      </Actions>
    </div>
  );
}
