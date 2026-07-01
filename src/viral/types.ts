import {ViralSignalType} from './constants';

// ── Signal types ─────────────────────────────────────────────────────────────

export interface ViralSignal {
  value: ViralSignalType;
  detail?: {
    network_size?: number;
    day?: number;
    views?: number;
  };
}

// ── Phase ────────────────────────────────────────────────────────────────────

export type ViralPhase = 'idle' | 'running' | 'done';

// ── Visualization state ──────────────────────────────────────────────────────

export interface ViralVisualizationState {
  networkSize: number;
  /** Latest absolute view count emitted by the simulation */
  views: number;
  /** Latest day index emitted by the simulation */
  day: number;
  /** Highest view count seen — used to decide when nodes have flipped on */
  peakViews: number;
  phase: ViralPhase;
}

// ── Callbacks: controller → React ────────────────────────────────────────────

export interface ViralCallbacks {
  setIsRunning: (b: boolean) => void;
  onInit: (networkSize: number) => void;
  onView: (day: number, views: number) => void;
  onDone: () => void;
  onReset: () => void;
}
