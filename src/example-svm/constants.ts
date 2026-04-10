export enum SVMSignalType {
  ADD_POINT = 'ADD_POINT',
  FIT = 'FIT',
  DONE = 'DONE',
}

// Class colors
export const CLASS_COLOR_POS = '#3b82f6'; // blue for label +1
export const CLASS_COLOR_NEG = '#ef4444'; // red for label -1

// Point rendering
export const POINT_RADIUS = 6;
export const SUPPORT_VECTOR_RING_RADIUS = 11;

// Decision boundary colors
export const DECISION_BOUNDARY_COLOR = '#1e293b';
export const MARGIN_COLOR = '#94a3b8';
export const MARGIN_FILL_OPACITY = 0.12;

// SMO algorithm parameters
export const SMO_MAX_PASSES = 10;
export const SMO_MAX_ITER = 1000;
export const SMO_TOLERANCE = 1e-3;
export const SMO_ALPHA_TOL = 1e-5;

// RBF kernel
export const RBF_GAMMA_DEFAULT = 0.5;
export const RBF_GRID_SIZE = 35;

// Defaults
export const C_DEFAULT = 1.0;
export const C_LOG_MIN = -2; // 10^-2 = 0.01
export const C_LOG_MAX = 2; // 10^2  = 100
export const C_LOG_STEP = 0.1;

export const SIGNAL_CHECK_TIME = 200;
