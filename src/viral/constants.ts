export enum ViralSignalType {
  INIT = 'INIT',
  VIEW = 'VIEW',
  DONE = 'DONE',
}

// ── Scenario (mirrors python/library.py) ────────────────────────────────────

export const DEFAULT_NETWORK_SIZE = 400;

// ── Animation timing (ms) ───────────────────────────────────────────────────

// Time each daily update is held before the next one is processed.
// Tuned for a satisfying spread without dragging.
export const VIEW_ANIMATION_MS = 700;
export const SIGNAL_CHECK_TIME = 100;

// ── Layout ──────────────────────────────────────────────────────────────────

export const SVG_WIDTH = 520;
export const SVG_HEIGHT = 440;

export const NETWORK_CX = SVG_WIDTH / 2;
export const NETWORK_CY = 280;

// Phyllotaxis (golden-angle) spiral spacing. Larger = more spread out.
// Sized so a 400-node spiral fits below the counter without overlap.
export const NODE_SPACING = 8;
export const NODE_RADIUS = 3.5;
export const NODE_RADIUS_LIT = 4.8;

// Edges: each node connects to its K nearest neighbors. Duplicates removed.
export const EDGES_PER_NODE = 3;

// Ceiling for view counts. The full network represents this many people
// — the rough count of social media users worldwide (~5 billion). Views
// beyond this are clamped, so the network can never overflow the world.
export const WORLD_POP = 5_000_000_000;

// How "views → number of lit nodes" is shaped. Pure linear (=1) makes
// the first ~12.5M views invisible (sub-pixel partial fill on one
// node), so doubling-from-1 demos sit on a single dim node for most of
// their length. Pure log (≈0) gives every decade equal weight, but
// then 100M and 1B look almost identical (the original complaint).
// 0.3 keeps both ends meaningful: every doubling lights up visible new
// nodes, AND each new order of magnitude clearly grows the cluster.
export const LIT_EXPONENT = 0.3;

// ── Camera (zoom) ───────────────────────────────────────────────────────────

// Smallest "interesting area" we ever frame, in equivalent node count.
// At the start of a run, no nodes are lit yet, so we still show roughly
// this many nodes' worth of network around the centre.
export const MIN_VISIBLE_NODES = 25;

// Margin around the lit edge: how many additional unlit nodes we keep
// in frame, so the viewer can see "what's about to light up."
export const ZOOM_BUFFER_NODES = 20;

// Hard cap on zoom-in, to prevent absurdly huge nodes at views ≈ 0.
export const MAX_ZOOM_SCALE = 4.5;

// ── Colors ──────────────────────────────────────────────────────────────────

export const BG_FILL = '#ffffff';
export const NODE_FILL = '#e2e8f0';
export const NODE_STROKE = '#cbd5e1';
export const NODE_LIT_FILL = '#f97316';
export const NODE_LIT_STROKE = '#ea580c';
export const NODE_NEW_FILL = '#fbbf24';

export const EDGE_STROKE = '#e2e8f0';
export const EDGE_STROKE_LIT = '#fdba74';

export const COUNTER_FILL = '#1e293b';
export const COUNTER_CAPTION_FILL = '#94a3b8';
export const DAY_BADGE_FILL = '#64748b';
