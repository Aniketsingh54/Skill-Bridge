import { useMemo, useState } from "react";

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

const NODE_WIDTH = 280;
const NODE_HEIGHT = 124;
const START_WIDTH = 240;
const START_HEIGHT = 92;
const H_GAP = 56;
const V_GAP = 110;
const PAD_X = 40;
const PAD_Y = 40;

function buildDepthMap(nodes: GraphNode[], edges: GraphEdge[]) {
  const incoming = new Map<string, string[]>();
  for (const node of nodes) {
    incoming.set(node.node_id, []);
  }

  for (const edge of edges) {
    if (!incoming.has(edge.source) || !incoming.has(edge.target)) {
      continue;
    }
    incoming.get(edge.target)?.push(edge.source);
  }

  const depthMap = new Map<string, number>();

  const visit = (nodeId: string): number => {
    if (depthMap.has(nodeId)) {
      return depthMap.get(nodeId)!;
    }

    const parents = incoming.get(nodeId) ?? [];
    if (parents.length === 0) {
      depthMap.set(nodeId, 0);
      return 0;
    }

    const depth = Math.max(...parents.map(visit)) + 1;
    depthMap.set(nodeId, depth);
    return depth;
  };

  for (const node of nodes) {
    visit(node.node_id);
  }

  return depthMap;
}

function positionNodes(nodes: GraphNode[], edges: GraphEdge[]) {
  const depthMap = buildDepthMap(nodes, edges);
  const rows = new Map<number, GraphNode[]>();

  for (const node of nodes) {
    const depth = depthMap.get(node.node_id) ?? 0;
    const row = rows.get(depth) ?? [];
    row.push(node);
    rows.set(depth, row);
  }

  const maxColumns = Math.max(...Array.from(rows.values()).map((row) => row.length), 1);
  const width = PAD_X * 2 + maxColumns * NODE_WIDTH + (maxColumns - 1) * H_GAP;
  const positioned: PositionedNode[] = [];

  for (const [depth, row] of rows.entries()) {
    const rowWidth = row.length * NODE_WIDTH + (row.length - 1) * H_GAP;
    const rowStartX = (width - rowWidth) / 2;

    row.forEach((node, index) => {
      positioned.push({
        ...node,
        depth,
        x: rowStartX + index * (NODE_WIDTH + H_GAP),
        y: PAD_Y + START_HEIGHT + 84 + depth * (NODE_HEIGHT + V_GAP),
      });
    });
  }

  const maxDepth = Math.max(...positioned.map((node) => node.depth), 0);
  const height =
    PAD_Y + START_HEIGHT + 84 + (maxDepth + 1) * NODE_HEIGHT + maxDepth * V_GAP + PAD_Y;

  return { positioned, width, height };
}

function getRootNodeIds(nodes: GraphNode[], edges: GraphEdge[]) {
  const targets = new Set(edges.map((edge) => edge.target));
  return nodes.filter((node) => !targets.has(node.node_id)).map((node) => node.node_id);
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

  const [activeNodeId, setActiveNodeId] = useState(nodes[0]?.node_id ?? null);
  const { positioned, width, height } = useMemo(() => positionNodes(nodes, edges), [nodes, edges]);
  const positionedMap = new Map(positioned.map((node) => [node.node_id, node]));
  const rootNodeIds = getRootNodeIds(nodes, edges);
  const nextStep = nodes[0];
  const activeNode = nodes.find((node) => node.node_id === activeNodeId) ?? nodes[0];
  const startX = width / 2 - START_WIDTH / 2;
  const startY = PAD_Y;

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

      <div className="graph-stage">
        <svg className="graph-svg" viewBox={`0 0 ${width} ${height}`} aria-label="Skill graph">
          <defs>
            <linearGradient id="roadEdge" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffb703" />
              <stop offset="100%" stopColor="#0f766e" />
            </linearGradient>
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

          <g transform={`translate(${startX}, ${startY})`}>
            <rect
              width={START_WIDTH}
              height={START_HEIGHT}
              rx="28"
              className="graph-start-node"
              filter="url(#roadShadow)"
            />
            <text className="graph-start-label" x="22" y="30">
              You are here
            </text>
            <text className="graph-start-title" x="22" y="61">
              Current State
            </text>
          </g>

          {rootNodeIds.map((rootId) => {
            const rootNode = positionedMap.get(rootId);
            if (!rootNode) {
              return null;
            }

            const sx = width / 2;
            const sy = startY + START_HEIGHT;
            const tx = rootNode.x + NODE_WIDTH / 2;
            const ty = rootNode.y;
            const midY = sy + 38;

            return (
              <path
                key={`root-${rootId}`}
                className="graph-link"
                d={`M ${sx} ${sy} C ${sx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`}
              />
            );
          })}

          {edges.map((edge) => {
            const sourceNode = positionedMap.get(edge.source);
            const targetNode = positionedMap.get(edge.target);

            if (!sourceNode || !targetNode) {
              return null;
            }

            const sx = sourceNode.x + NODE_WIDTH / 2;
            const sy = sourceNode.y + NODE_HEIGHT;
            const tx = targetNode.x + NODE_WIDTH / 2;
            const ty = targetNode.y;
            const midY = sy + 44;

            return (
              <path
                key={`${edge.source}-${edge.target}`}
                className="graph-link"
                d={`M ${sx} ${sy} C ${sx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`}
              />
            );
          })}

          {positioned.map((node) => (
            <g
              key={node.node_id}
              transform={`translate(${node.x}, ${node.y})`}
              onMouseEnter={() => setActiveNodeId(node.node_id)}
              onClick={() => setActiveNodeId(node.node_id)}
            >
              <rect
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                rx="30"
                className={`graph-node${activeNodeId === node.node_id ? " graph-node-active" : ""}`}
                filter="url(#roadShadow)"
              />
              <text className="graph-node-title" x="22" y="48">
                {node.skill}
              </text>
              <text className="graph-node-weeks" x="22" y="79">
                {`${node.estimated_weeks} week(s)`}
              </text>
              <text className="graph-node-code" x="22" y="105">
                {node.node_id}
              </text>
            </g>
          ))}
        </svg>

        <aside className="graph-focus">
          <p className="graph-kicker">Focused Node</p>
          <h4>{activeNode.skill}</h4>
          <p>{activeNode.rationale ?? activeNode.resource}</p>
          <small>{activeNode.resource}</small>
        </aside>
      </div>
    </section>
  );
}

export default RoadmapGraph;
