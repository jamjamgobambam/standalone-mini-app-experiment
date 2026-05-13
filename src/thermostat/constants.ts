export enum ThermostatSignalType {
  INIT = 'INIT',
  TURN = 'TURN',
  DONE = 'DONE',
}

// ── Scenario (mirrors python/library.py) ────────────────────────────────────

export const MIN_TEMP = 64;
export const MAX_TEMP = 80;

// preferences[i] = number of people who prefer temperature (MIN_TEMP + i)
export const INITIAL_PREFERENCES = [
  1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 7, 5, 4, 3, 2, 1, 1,
];

export const INITIAL_TEMP = 65;

// ── Animation timing (ms) ───────────────────────────────────────────────────
// Keep TURN_ANIMATION_MS in sync with the CSS transition on .tickRotate.
export const TURN_ANIMATION_MS = 600;
export const TURN_PAUSE_MS = 200;
export const TURN_TOTAL_MS = TURN_ANIMATION_MS + TURN_PAUSE_MS;

export const SIGNAL_CHECK_TIME = 100;

// ── Layout ──────────────────────────────────────────────────────────────────

export const SVG_WIDTH = 520;
export const SVG_HEIGHT = 400;

export const DIAL_CX = SVG_WIDTH / 2;
export const DIAL_CY = 300;

export const DIAL_OUTER_R = 100;
export const DIAL_INNER_R = 84;
export const DIAL_FACE_R = 72;

// Tick mark on the dial (red triangle pointing outward).
export const TICK_OUTER_R = DIAL_OUTER_R - 4;
export const TICK_INNER_R = DIAL_INNER_R + 4;

// Temperature labels sit just outside the dial; bars sit further out.
export const TEMP_LABEL_R = DIAL_OUTER_R + 18;
export const BAR_INNER_R = DIAL_OUTER_R + 36;
export const BAR_PIXELS_PER_PERSON = 8;
export const BAR_WIDTH = 7;

// ── Colors ──────────────────────────────────────────────────────────────────

export const DIAL_RING_OUTER = '#9ca3af';
export const DIAL_RING_INNER = '#e5e7eb';
export const DIAL_FACE_FILL = '#f8fafc';
export const DIAL_FACE_STROKE = '#cbd5e1';
export const DIAL_TICK_FILL = '#dc2626';

export const BAR_FILL = '#94a3b8';
export const BAR_FILL_SELECTED = '#f59e0b';
export const TEMP_LABEL_FILL = '#475569';
export const TEMP_LABEL_FILL_SELECTED = '#1e293b';
export const READOUT_FILL = '#1e293b';
