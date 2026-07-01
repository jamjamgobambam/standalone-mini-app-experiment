import React, {useMemo} from 'react';

import {
  COUNTER_CAPTION_FILL,
  COUNTER_FILL,
  DAY_BADGE_FILL,
  DEFAULT_NETWORK_SIZE,
  EDGES_PER_NODE,
  EDGE_STROKE,
  EDGE_STROKE_LIT,
  LIT_EXPONENT,
  MAX_ZOOM_SCALE,
  MIN_VISIBLE_NODES,
  NETWORK_CX,
  NETWORK_CY,
  NODE_FILL,
  NODE_LIT_FILL,
  NODE_LIT_STROKE,
  NODE_RADIUS,
  NODE_RADIUS_LIT,
  NODE_SPACING,
  NODE_STROKE,
  SVG_HEIGHT,
  SVG_WIDTH,
  WORLD_POP,
  ZOOM_BUFFER_NODES,
} from './constants';
import {ViralVisualizationState} from './types';

import moduleStyles from './viral.module.css';

interface Props {
  state: ViralVisualizationState;
}

interface Node {
  /** Stable index = order of insertion (0 = center) */
  index: number;
  x: number;
  y: number;
}

interface Edge {
  a: number;
  b: number;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * Build a phyllotaxis (golden-angle) spiral and re-index the nodes so
 * that index 0 is closest to the centre. The visualization lights nodes
 * up in index order, so this gives a "spreading from the centre" feel.
 */
function buildNetwork(networkSize: number): {nodes: Node[]; edges: Edge[]} {
  const raw: Array<{x: number; y: number; dist: number}> = [];
  for (let i = 0; i < networkSize; i++) {
    const r = NODE_SPACING * Math.sqrt(i + 0.5);
    const theta = i * GOLDEN_ANGLE;
    const x = NETWORK_CX + r * Math.cos(theta);
    const y = NETWORK_CY + r * Math.sin(theta);
    raw.push({x, y, dist: r});
  }
  raw.sort((a, b) => a.dist - b.dist);
  const nodes: Node[] = raw.map((p, i) => ({index: i, x: p.x, y: p.y}));

  const edgeSet = new Set<string>();
  const edges: Edge[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    const dists: Array<{j: number; d: number}> = [];
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      const dx = nodes[j].x - a.x;
      const dy = nodes[j].y - a.y;
      dists.push({j, d: dx * dx + dy * dy});
    }
    dists.sort((p, q) => p.d - q.d);
    for (let k = 0; k < EDGES_PER_NODE && k < dists.length; k++) {
      const j = dists[k].j;
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (edgeSet.has(key)) continue;
      edgeSet.add(key);
      edges.push({a: Math.min(i, j), b: Math.max(i, j)});
    }
  }

  return {nodes, edges};
}

/**
 * Map a view count to a "lit node count" using a gentle power curve.
 * Pure linear hides the first ~12.5M views on one barely-filled node;
 * pure log smears big numbers together. The exponent ~0.3 keeps both
 * ends visible: every doubling lights new nodes early on, and each
 * order of magnitude grows the cluster meaningfully later on.
 */
function nodeProgress(
  views: number,
  networkSize: number
): {fullyLit: number; partial: number; litTotal: number} {
  if (views <= 0) return {fullyLit: 0, partial: 0, litTotal: 0};
  const capped = Math.min(WORLD_POP, views);
  const fraction = Math.pow(capped / WORLD_POP, LIT_EXPONENT);
  const litTotal = Math.min(networkSize, networkSize * fraction);
  const fullyLit = Math.min(networkSize, Math.floor(litTotal));
  const partial = fullyLit >= networkSize ? 0 : litTotal - fullyLit;
  return {fullyLit, partial, litTotal};
}

/**
 * Choose the zoom scale so the lit edge (plus a small unlit buffer)
 * fills the visible area. Starts tightly framed on the center when no
 * nodes are lit, then smoothly zooms out as the network fills.
 */
function zoomScale(litTotal: number, networkSize: number): number {
  const networkRadius = NODE_SPACING * Math.sqrt(networkSize);
  const targetCount = Math.max(MIN_VISIBLE_NODES, litTotal + ZOOM_BUFFER_NODES);
  const targetRadius = NODE_SPACING * Math.sqrt(targetCount);
  return Math.min(MAX_ZOOM_SCALE, Math.max(1, networkRadius / targetRadius));
}

function formatViews(views: number): string {
  return views.toLocaleString('en-US');
}

function formatWorldFraction(views: number): string {
  if (views <= 0) return '0% of users';
  const pct = (Math.min(views, WORLD_POP) / WORLD_POP) * 100;
  if (pct >= 1) return `${pct.toFixed(1)}% of users`;
  if (pct >= 0.01) return `${pct.toFixed(2)}% of users`;
  if (pct >= 0.0001) return `${pct.toFixed(4)}% of users`;
  return `<0.0001% of users`;
}

const ViralVisualization: React.FunctionComponent<Props> = ({state}) => {
  const {networkSize, views, day, peakViews, phase} = state;

  const size = networkSize || DEFAULT_NETWORK_SIZE;
  const {nodes, edges} = useMemo(() => buildNetwork(size), [size]);

  const {fullyLit, partial, litTotal} = nodeProgress(views, size);
  const scale = zoomScale(litTotal, size);

  const isIdle = phase === 'idle';

  const status = (() => {
    if (isIdle) {
      return (
        <span className={moduleStyles.emptyMessage}>
          Run your code to launch the post
        </span>
      );
    }
    if (phase === 'done') {
      return (
        <span>
          Done — peaked at {formatViews(peakViews)} views ·{' '}
          {formatWorldFraction(peakViews)}
        </span>
      );
    }
    return (
      <span>
        Spreading… {formatViews(views)} views · {formatWorldFraction(views)}
      </span>
    );
  })();

  // Translate-scale-translate keeps the network centred under zoom while
  // letting the surrounding HUD (counter, day badge) sit at a fixed
  // position outside the transformed group.
  const networkTransform = `translate(${NETWORK_CX}px, ${NETWORK_CY}px) scale(${scale}) translate(${-NETWORK_CX}px, ${-NETWORK_CY}px)`;

  return (
    <div className={moduleStyles.container}>
      <svg
        className={moduleStyles.svgCanvas}
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* ── Network (clipped + zoomed) ─────────────────────────────── */}
        {!isIdle && (
          <g
            className={moduleStyles.networkGroup}
            style={{
              transform: networkTransform,
              transformOrigin: '0 0',
            }}
          >
            {edges.map(({a, b}) => {
              const lit = a < fullyLit && b < fullyLit;
              return (
                <line
                  key={`${a}-${b}`}
                  x1={nodes[a].x}
                  y1={nodes[a].y}
                  x2={nodes[b].x}
                  y2={nodes[b].y}
                  stroke={lit ? EDGE_STROKE_LIT : EDGE_STROKE}
                  strokeWidth={lit ? 1 : 0.6}
                  vectorEffect="non-scaling-stroke"
                  className={moduleStyles.edge}
                />
              );
            })}
            {nodes.map(n => {
              const lit = n.index < fullyLit;
              const isLeading = n.index === fullyLit && partial > 0;
              const radius = lit
                ? NODE_RADIUS_LIT
                : isLeading
                ? NODE_RADIUS + (NODE_RADIUS_LIT - NODE_RADIUS) * partial
                : NODE_RADIUS;
              const fillOpacity = isLeading ? partial : 1;
              return (
                <circle
                  key={n.index}
                  cx={n.x}
                  cy={n.y}
                  r={radius}
                  fill={lit || isLeading ? NODE_LIT_FILL : NODE_FILL}
                  fillOpacity={fillOpacity}
                  stroke={lit || isLeading ? NODE_LIT_STROKE : NODE_STROKE}
                  strokeWidth={lit ? 1 : 0.5}
                  vectorEffect="non-scaling-stroke"
                  className={moduleStyles.node}
                />
              );
            })}
          </g>
        )}

        {/* ── Headline counter (drawn after the network so it stays on top) ── */}
        <text
          x={SVG_WIDTH / 2}
          y={36}
          textAnchor="middle"
          className={moduleStyles.counterCaption}
          fill={COUNTER_CAPTION_FILL}
        >
          VIEWS
        </text>
        <text
          x={SVG_WIDTH / 2}
          y={78}
          textAnchor="middle"
          className={moduleStyles.counter}
          fill={COUNTER_FILL}
        >
          {isIdle ? '—' : formatViews(views)}
        </text>
        {!isIdle && (
          <>
            <text
              x={SVG_WIDTH / 2}
              y={100}
              textAnchor="middle"
              className={moduleStyles.fractionBadge}
              fill={DAY_BADGE_FILL}
            >
              {formatWorldFraction(views)}
            </text>
            <text
              x={SVG_WIDTH / 2}
              y={118}
              textAnchor="middle"
              className={moduleStyles.dayBadge}
              fill={DAY_BADGE_FILL}
            >
              DAY {day}
            </text>
          </>
        )}

        {isIdle && (
          <text
            x={SVG_WIDTH / 2}
            y={SVG_HEIGHT / 2 + 40}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={14}
            fill="#aaa"
          >
            Run your code to begin
          </text>
        )}
      </svg>

      <div className={moduleStyles.status}>{status}</div>
    </div>
  );
};

export default ViralVisualization;
