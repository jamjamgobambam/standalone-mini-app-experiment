import {SVMSignalType} from './constants';

// ── Signal types ─────────────────────────────────────────────────────────────

export interface SVMSignal {
  value: SVMSignalType;
  detail?: {
    x?: number;
    y?: number;
    label?: number; // 1 or -1
    id?: number;
    C?: number;
  };
}

// ── Data structures ───────────────────────────────────────────────────────────

export interface LabeledPoint {
  id: number;
  x: number;
  y: number;
  label: 1 | -1;
}

export type KernelType = 'linear' | 'rbf';

/** Raw data min/max used for feature scaling. Does not include SVG padding. */
export interface Scaler {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface SVMResult {
  /** Lagrange multipliers, one per training point (same order as LabeledPoints). */
  alphas: number[];
  bias: number;
  /** Weight vector in scaled space. null for RBF kernel. */
  weights: [number, number] | null;
  gamma: number;
  /** Indices into the training points array where alpha_i > SMO_ALPHA_TOL. */
  supportVectorIndices: number[];
  /** 2 / ||w|| in scaled space. null for RBF kernel. */
  marginWidth: number | null;
  kernel: KernelType;
  C: number;
  scaler: Scaler;
}

// ── Visualization state ───────────────────────────────────────────────────────

export type SVMPhase = 'idle' | 'collecting' | 'training' | 'trained';

export interface SVMVisualizationState {
  points: LabeledPoint[];
  result: SVMResult | null;
  phase: SVMPhase;
  kernel: KernelType;
  C: number;
}

// ── Callbacks from controller → React ────────────────────────────────────────

export interface SVMCallbacks {
  setIsRunning: (isRunning: boolean) => void;
  onAddPoint: (point: LabeledPoint) => void;
  onTrainingStart: () => void;
  onTrainingComplete: (result: SVMResult) => void;
  onReset: () => void;
}
