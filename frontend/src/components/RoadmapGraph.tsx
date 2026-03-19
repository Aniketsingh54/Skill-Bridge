import { useMemo, useRef, useState } from "react";

type GraphNode = {
  node_id: string;
  skill: string;
  resource: string;
  estimated_weeks: number;
  rationale?: string | null;
};

type GraphEdge = {
  source: string;
  target: string;
};

type RoadmapGraphProps = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

type PositionedNode = GraphNode & {
  depth: number;
  x: number;
  y: number;
};

const NODE_WIDTH = 220;
const NODE_HEIGHT = 96;
const START_WIDTH = 180;
const START_HEIGHT = 68;
const H_GAP = 40;
const V_GAP = 64;
const PAD_X = 28;
const PAD_Y = 28;

function splitLabel(label: string, maxLineLength = 18) {
  const words = label.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxLineLength) { current = next; continue; }
    if (current) lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines.slice(0, 2);
}

function buildDepthMap(nodes: GraphNode[], edges: GraphEdge[]) {
  const incoming = new Map<string, string[]>();
  for (const node of nodes) incoming.set(node.node_id, []);
  for (const edge of edges) {
    if (!incoming.has(edge.source) || !incoming.has(edge.target)) continue;
    incoming.get(edge.target)?.push(edge.source);
  }
  const depthMap = new Map<string, number>();
  const visit = (nodeId: string): number => {
    if (depthMap.has(nodeId)) return depthMap.get(nodeId)!;
    const parents = incoming.get(nodeId) ?? [];
    if (parents.length === 0) { depthMap.set(nodeId, 0); return 0; }
    const depth = Math.max(...parents.map(visit)) + 1;
    depthMap.set(nodeId, depth);
    return depth;
  };
  for (const node of nodes) visit(node.node_id);
  return depthMap;
}

function positionNodes(nodes: GraphNode[], edges: GraphEdge[]) {
  const minColumns = 2;
  if (edges.length === 0) {
    const totalColumns = Math.max(nodes.length, minColumns);
    const width = PAD_X * 2 + totalColumns * NODE_WIDTH + Math.max(totalColumns - 1, 0) * H_GAP;
    const rowWidth = nodes.length * NODE_WIDTH + Math.max(nodes.length - 1, 0) * H_GAP;
    const rowStartX = (width - rowWidth) / 2;
    const y = PAD_Y + START_HEIGHT + 84;
    const positioned = nodes.map((node, index) => ({
      ...node, depth: 0, x: rowStartX + index * (NODE_WIDTH + H_GAP), y,
    }));
    return { positioned, width, height: y + NODE_HEIGHT + PAD_Y };
  }
  const depthMap = buildDepthMap(nodes, edges);
  const rows = new Map<number, GraphNode[]>();
  for (const node of nodes) {
    const depth = depthMap.get(node.node_id) ?? 0;
    const row = rows.get(depth) ?? [];
    row.push(node);
    rows.set(depth, row);
  }
  const maxColumns = Math.max(...Array.from(rows.values()).map((r) => r.length), minColumns);
  const width = PAD_X * 2 + maxColumns * NODE_WIDTH + (maxColumns - 1) * H_GAP;
  const positioned: PositionedNode[] = [];
  for (const [depth, row] of rows.entries()) {
    const rowWidth = row.length * NODE_WIDTH + (row.length - 1) * H_GAP;
    const rowStartX = (width - rowWidth) / 2;
    row.forEach((node, index) => {
      positioned.push({
        ...node, depth,
        x: rowStartX + index * (NODE_WIDTH + H_GAP),
        y: PAD_Y + START_HEIGHT + 84 + depth * (NODE_HEIGHT + V_GAP),
      });
    });
  }
  const maxDepth = Math.max(...positioned.map((n) => n.depth), 0);
  const height = PAD_Y + START_HEIGHT + 84 + (maxDepth + 1) * NODE_HEIGHT + maxDepth * V_GAP + PAD_Y;
  return { positioned, width, height };
}

function getRootNodeIds(nodes: GraphNode[], edges: GraphEdge[]) {
  const targets = new Set(edges.map((e) => e.target));
  return nodes.filter((n) => !targets.has(n.node_id)).map((n) => n.node_id);
}

function getDistributedStartX(index: number, total: number, startLeft: number) {
  if (total <= 1) return startLeft + START_WIDTH / 2;
  const inset = 22;
  const usable = START_WIDTH - inset * 2;
  return startLeft + inset + index * (usable / (total - 1));
}

function getArrowHeadPoints(tx: number, ty: number, size = 7) {
  const tipY = ty - 4;
  const baseY = tipY - size;
  return `${tx},${tipY} ${tx - size},${baseY} ${tx + size},${baseY}`;
}

function RoadmapGraph({ nodes, edges }: RoadmapGraphProps) {
  if (nodes.length === 0) {
    return (
      <section className="graph-scene graph-empty-scene">
        <p className="graph-kicker">Roadmap Graph</p>
        <h3>No nodes match the current filter.</h3>
        <p className="graph-empty-copy">
          Try clearing the roadmap filter or choose a different sample input.
        </p>
      </section>
    );
  }

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const { positioned, width, height } = useMemo(
    () => positionNodes(nodes, edges),
    [nodes, edges],
  );
  const positionedMap = new Map(positioned.map((n) => [n.node_id, n]));
  const rootNodeIds = getRootNodeIds(nodes, edges);
  const nextStepId = rootNodeIds[0] ?? nodes[0]?.node_id;
  const nextStep = nodes.find((n) => n.node_id === nextStepId) ?? nodes[0];
  const startX = width / 2 - START_WIDTH / 2;
  const startY = PAD_Y;

  const hoveredNode = hoveredNodeId
    ? positioned.find((n) => n.node_id === hoveredNodeId) ?? null
    : null;

  // Convert SVG coordinates → percentage within the stage div so the HTML
  // tooltip can be positioned absolutely without any coordinate conversion.
  const popupStyle = hoveredNode
    ? {
        left: `${((hoveredNode.x + NODE_WIDTH / 2) / width) * 100}%`,
        // Position above the node's top edge
        top: `${(hoveredNode.y / height) * 100}%`,
        transform: "translate(-50%, calc(-100% - 12px))",
      }
    : undefined;

  return (
    <section className="graph-scene">
      <div className="graph-topbar">
        <div>
          <p className="graph-kicker">Roadmap Graph</p>
          <h3>One clean view of where they are and where they go next.</h3>
        </div>
        <div className="graph-next">
          <span>Next Step</span>
          <strong>{nextStep.skill}</strong>
        </div>
      </div>

      {/* graph-stage is position:relative — the HTML tooltip is absolute inside it */}
      <div className="graph-stage" ref={stageRef}>
        <svg
          className="graph-svg"
          viewBox={`0 0 ${width} ${height}`}
          aria-label="Skill graph"
        >
          <defs>
            <linearGradient id="roadStart" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0f766e" />
              <stop offset="100%" stopColor="#1d4ed8" />
            </linearGradient>
            <linearGradient id="roadNode" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fffdf8" />
              <stop offset="100%" stopColor="#f7fbff" />
            </linearGradient>
            <filter id="roadShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="14" stdDeviation="12" floodColor="rgba(15,23,42,0.16)" />
            </filter>
          </defs>

          {/* Start node */}
          <g transform={`translate(${startX}, ${startY})`}>
            <rect width={START_WIDTH} height={START_HEIGHT} rx="22"
              className="graph-start-node" filter="url(#roadShadow)" />
            <text className="graph-start-label" x="18" y="24">You are here</text>
            <text className="graph-start-title" x="18" y="48">Current State</text>
          </g>

          {/* Root edges */}
          {rootNodeIds.map((rootId, idx) => {
            const rootNode = positionedMap.get(rootId);
            if (!rootNode) return null;
            const sx = getDistributedStartX(idx, rootNodeIds.length, startX);
            const sy = startY + START_HEIGHT;
            const tx = rootNode.x + NODE_WIDTH / 2;
            const ty = rootNode.y;
            const midY = sy + 28;
            return (
              <g key={`root-${rootId}`}>
                <path className="graph-root-link"
                  d={`M ${sx} ${sy} L ${sx} ${midY} L ${tx} ${midY} L ${tx} ${ty - 12}`} />
                <polygon className="graph-root-arrowhead" points={getArrowHeadPoints(tx, ty)} />
              </g>
            );
          })}

          {/* Regular edges */}
          {edges.map((edge) => {
            const src = positionedMap.get(edge.source);
            const tgt = positionedMap.get(edge.target);
            if (!src || !tgt) return null;
            const sx = src.x + NODE_WIDTH / 2;
            const sy = src.y + NODE_HEIGHT;
            const tx = tgt.x + NODE_WIDTH / 2;
            const ty = tgt.y;
            const midY = sy + 28;
            return (
              <g key={`${edge.source}-${edge.target}`}>
                <path className="graph-link"
                  d={`M ${sx} ${sy} L ${sx} ${midY} L ${tx} ${midY} L ${tx} ${ty - 12}`} />
                <polygon className="graph-arrowhead" points={getArrowHeadPoints(tx, ty)} />
              </g>
            );
          })}

          {/* Skill nodes — clean SVG rects, no popup inside SVG */}
          {positioned.map((node) => {
            const labelLines = splitLabel(node.skill);
            const isHovered = hoveredNodeId === node.node_id;
            return (
              <g
                key={node.node_id}
                transform={`translate(${node.x}, ${node.y})`}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoveredNodeId(node.node_id)}
                onMouseLeave={() => setHoveredNodeId(null)}
              >
                <rect
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx="24"
                  className={`graph-node${isHovered ? " graph-node-active" : ""}`}
                  filter="url(#roadShadow)"
                />
                <text className="graph-node-title" x="18" y="34">
                  {labelLines.map((line, i) => (
                    <tspan key={i} x="18" dy={i === 0 ? 0 : 20}>{line}</tspan>
                  ))}
                </text>
                <text className="graph-node-weeks" x="18" y="72">
                  {`${node.estimated_weeks} week(s)`}
                </text>
                <text className="graph-node-code" x="18" y="88">{node.node_id}</text>
              </g>
            );
          })}
        </svg>

        {/* ── HTML tooltip overlay ──
            Absolutely positioned inside graph-stage (position:relative).
            Floats above the hovered node centre, never touches other nodes. */}
        <div
          className={`graph-tooltip${hoveredNode ? " graph-tooltip--visible" : ""}`}
          style={popupStyle}
          // Keep tooltip alive when cursor moves from node to tooltip
          onMouseEnter={() => hoveredNode && setHoveredNodeId(hoveredNode.node_id)}
          onMouseLeave={() => setHoveredNodeId(null)}
        >
          {hoveredNode && (
            <>
              <p className="graph-kicker" style={{ marginBottom: 4 }}>
                {hoveredNode.estimated_weeks} week{hoveredNode.estimated_weeks !== 1 ? "s" : ""}
              </p>
              <h4 className="graph-tooltip__title">{hoveredNode.skill}</h4>
              {(hoveredNode.rationale || hoveredNode.resource) && (
                <p className="graph-tooltip__body">
                  {hoveredNode.rationale ?? hoveredNode.resource}
                </p>
              )}
              {hoveredNode.rationale && hoveredNode.resource && (
                <span className="graph-tooltip__chip">{hoveredNode.resource}</span>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export default RoadmapGraph;
