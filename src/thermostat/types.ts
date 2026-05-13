import {ThermostatSignalType} from './constants';

// ── Signal types ─────────────────────────────────────────────────────────────

export interface ThermostatSignal {
  value: ThermostatSignalType;
  detail?: {
    min_temp?: number;
    max_temp?: number;
    preferences?: number[];
    start_temp?: number;
    temp?: number;
  };
}

// ── Phase ────────────────────────────────────────────────────────────────────

export type ThermostatPhase = 'idle' | 'running' | 'done';

// ── Visualization state ──────────────────────────────────────────────────────

export interface ThermostatVisualizationState {
  minTemp: number;
  maxTemp: number;
  /** preferences[i] = number of people preferring (minTemp + i) */
  preferences: number[];
  /** Currently set temperature */
  currentTemp: number;
  phase: ThermostatPhase;
}

// ── Callbacks: controller → React ────────────────────────────────────────────

export interface ThermostatCallbacks {
  setIsRunning: (b: boolean) => void;
  onInit: (
    minTemp: number,
    maxTemp: number,
    preferences: number[],
    startTemp: number
  ) => void;
  onTurn: (temp: number) => void;
  onDone: () => void;
  onReset: () => void;
}
