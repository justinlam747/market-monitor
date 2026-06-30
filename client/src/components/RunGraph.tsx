import { useRef, useState, type PointerEvent, type WheelEvent } from "react";
import { Spinner } from "@heroui/react";
import type { TimelineItem } from "../useRunStream.js";

interface GNode {
  id: string;
  label: string;
  x: number;
  y: number;
}

// Nodes laid out as a cursive uppercase "Q": a full oval bowl (nodes 1-8) with a
// tail (9-10) crossing down through the lower-right. Edges are curved so it reads
// as a flowing, rounded letter.
const NODES: GNode[] = [
  { id: "validate_input", label: "validate input", x: 300, y: 75 },
  { id: "scrape_company_site", label: "scrape site", x: 445, y: 135 },
  { id: "extract_identity", label: "extract identity", x: 505, y: 280 },
  { id: "discover_competitors", label: "discover competitors", x: 445, y: 425 },
  { id: "collect_sources", label: "collect sources", x: 300, y: 485 },
  { id: "extract_signals", label: "extract signals", x: 155, y: 425 },
  { id: "evaluate_evidence", label: "evaluate evidence", x: 95, y: 280 },
  { id: "analyze_gaps", label: "analyze gaps", x: 155, y: 135 },
  { id: "maybe_review_gaps", label: "review gaps", x: 370, y: 380 },
  { id: "finalize_state", label: "finalize", x: 560, y: 545 },
];
const POS: Record<string, GNode> = Object.fromEntries(NODES.map((n) => [n.id, n]));
const EDGES: Array<[string, string]> = [
  ...NODES.slice(0, -1).map((n, i) => [n.id, NODES[i + 1].id] as [string, string]),
  // route retries loop back from evaluate_evidence
  ["evaluate_evidence", "collect_sources"],
  ["evaluate_evidence", "extract_signals"],
];

// Bowl center — bowl edges bow away from it so the oval rounds out.
const BOWL = { x: 300, y: 280 };
function curvePath(a: GNode, b: GNode): string {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = mx - BOWL.x;
  const dy = my - BOWL.y;
  const len = Math.hypot(dx, dy) || 1;
  const bow = 22;
  const cx = mx + (dx / len) * bow;
  const cy = my + (dy / len) * bow;
  return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
}

const VB_W = 720;
const VB_H = 620;
const CENTER = { x: VB_W / 2, y: VB_H / 2 };

type NodeState = "idle" | "visited" | "active";
const NODE_FILL: Record<NodeState, string> = {
  idle: "#cbbcab",
  visited: "#6f5e53",
  active: "#2c2621",
};
const LABEL_FILL: Record<NodeState, string> = {
  idle: "#9c8a78",
  visited: "#4e4339",
  active: "#2c2621",
};

export function RunGraph({
  timeline,
  status,
}: {
  timeline: TimelineItem[];
  status: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const drag = useRef<{ x: number; y: number } | null>(null);

  const running = !["complete", "error", "cancelled"].includes(status);
  const stepNodes = timeline
    .map((t) => t.node)
    .filter((n): n is string => !!n && n in POS);
  // Mark every node up to the furthest-reached one as visited, so earlier nodes
  // (validate input first) light up even if their exact event scrolled past.
  const reachedIdx = stepNodes.reduce(
    (mx, n) => Math.max(mx, NODES.findIndex((node) => node.id === n)),
    -1
  );
  const visited = new Set(NODES.filter((_, i) => i <= reachedIdx).map((n) => n.id));
  const current = running ? stepNodes[stepNodes.length - 1] : undefined;

  const stateFor = (id: string): NodeState => {
    if (id === current) return "active";
    if (visited.has(id) || !running) return "visited";
    return "idle";
  };

  // zoom keeping the viewBox center fixed
  const zoom = (factor: number) => {
    setScale((s) => {
      const ns = Math.min(3, Math.max(0.5, s * factor));
      setTx((t) => t + (s - ns) * CENTER.x);
      setTy((t) => t + (s - ns) * CENTER.y);
      return ns;
    });
  };
  const reset = () => {
    setScale(1);
    setTx(0);
    setTy(0);
  };

  const onPointerDown = (e: PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!drag.current || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const ratio = VB_W / rect.width;
    setTx((t) => t + (e.clientX - drag.current!.x) * ratio);
    setTy((t) => t + (e.clientY - drag.current!.y) * ratio);
    drag.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = () => {
    drag.current = null;
  };
  const onWheel = (e: WheelEvent) => {
    zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1);
  };

  const edgeStroke = (a: string, b: string) =>
    visited.has(a) && visited.has(b) ? "#ab947e" : "#d8ccc0";

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute right-2 top-2 z-10 flex flex-col gap-1">
        <ZoomBtn label="+" onClick={() => zoom(1.2)} />
        <ZoomBtn label="−" onClick={() => zoom(1 / 1.2)} />
        <ZoomBtn label="⟳" onClick={reset} />
      </div>

      {running && (
        <div className="absolute bottom-3 right-3 z-20 flex items-center gap-2 rounded-full bg-content1/90 px-3 py-1.5 backdrop-blur">
          <Spinner size="sm" color="default" />
          <span className="text-xs text-default-600">
            {current ? current.replace(/_/g, " ") : "running"}
          </span>
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMinYMid meet"
        className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing [&_text]:select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onWheel={onWheel}
      >
        <g transform={`translate(${tx} ${ty}) scale(${scale})`}>
          {EDGES.map(([a, b], i) => (
            <path
              key={`e-${i}`}
              d={curvePath(POS[a], POS[b])}
              fill="none"
              stroke={edgeStroke(a, b)}
              strokeWidth={1.4}
              strokeLinecap="round"
            />
          ))}

          {NODES.map((n, i) => {
            const s = stateFor(n.id);
            return (
              <g
                key={n.id}
                className="node-fade"
                style={{ animationDelay: `${i * 55}ms` }}
              >
                {s === "active" && (
                  <circle
                    key={`flash-${n.id}`}
                    cx={n.x}
                    cy={n.y}
                    r={7}
                    fill="#2c2621"
                    className="flash-once"
                  />
                )}
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={s === "active" ? 6.5 : 5}
                  fill={NODE_FILL[s]}
                />
                <text
                  x={n.x + 11}
                  y={n.y + 3.5}
                  fontSize={10}
                  fontStyle="italic"
                  fill={LABEL_FILL[s]}
                  fontWeight={s === "active" ? 700 : 400}
                >
                  {n.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

function ZoomBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid h-7 w-7 place-items-center rounded-full bg-content2 text-sm text-default-600 hover:bg-content3"
    >
      {label}
    </button>
  );
}
