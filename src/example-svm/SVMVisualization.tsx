import React, {useEffect, useMemo, useState} from 'react';

import {
  C_DEFAULT,
  C_LOG_MAX,
  C_LOG_MIN,
  C_LOG_STEP,
  CLASS_COLOR_NEG,
  CLASS_COLOR_POS,
  DECISION_BOUNDARY_COLOR,
  MARGIN_COLOR,
  MARGIN_FILL_OPACITY,
  POINT_RADIUS,
  RBF_GRID_SIZE,
  SMO_ALPHA_TOL,
  SUPPORT_VECTOR_RING_RADIUS,
} from './constants';
import {KernelType, LabeledPoint, SVMResult, SVMVisualizationState, Scaler} from './types';

import moduleStyles from './svm.module.css';

interface SVMVisualizationProps {
  state: SVMVisualizationState;
  onRetrain: (C: number, kernel: KernelType) => void;
}

const SVG_SIZE = 380;
const PADDING = 28;

// ── Coordinate helpers ────────────────────────────────────────────────────────

function computeBounds(points: LabeledPoint[]) {
  if (points.length === 0) {
    return {xMin: -1, xMax: 1, yMin: -1, yMax: 1};
  }
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const dataXMin = Math.min(...xs);
  const dataXMax = Math.max(...xs);
  const dataYMin = Math.min(...ys);
  const dataYMax = Math.max(...ys);

  const xRange = dataXMax - dataXMin || 1;
  const yRange = dataYMax - dataYMin || 1;
  const padX = xRange * 0.2;
  const padY = yRange * 0.2;

  return {
    xMin: dataXMin - padX,
    xMax: dataXMax + padX,
    yMin: dataYMin - padY,
    yMax: dataYMax + padY,
  };
}

type Bounds = ReturnType<typeof computeBounds>;

function makeScalers(bounds: Bounds) {
  const {xMin, xMax, yMin, yMax} = bounds;
  const plotW = SVG_SIZE - 2 * PADDING;
  const plotH = SVG_SIZE - 2 * PADDING;

  const toSvgX = (x: number) => PADDING + ((x - xMin) / (xMax - xMin)) * plotW;
  // SVG y-axis is inverted vs. mathematical y-axis
  const toSvgY = (y: number) =>
    SVG_SIZE - PADDING - ((y - yMin) / (yMax - yMin)) * plotH;

  return {toSvgX, toSvgY};
}

/**
 * Clips the line  w[0]*sx + w[1]*sy + bias = offset  (in scaled space)
 * to the data bounding box, returning two endpoint coords in data space.
 * Returns null if the line doesn't intersect the box.
 */
function clipLine(
  weights: [number, number],
  bias: number,
  offset: number,
  scaler: Scaler,
  bounds: Bounds
): {x1: number; y1: number; x2: number; y2: number} | null {
  const {xMin: sxMin, xMax: sxMax, yMin: syMin, yMax: syMax} = scaler;
  const xRange = sxMax - sxMin || 1;
  const yRange = syMax - syMin || 1;

  // Convert between data space and scaled space
  const toSx = (x: number) => (2 * (x - sxMin)) / xRange - 1;
  const toSy = (y: number) => (2 * (y - syMin)) / yRange - 1;
  const fromSy = (sy: number) => ((sy + 1) * yRange) / 2 + syMin;
  const fromSx = (sx: number) => ((sx + 1) * xRange) / 2 + sxMin;

  // Line equation in scaled space: w[0]*sx + w[1]*sy = target
  const target = offset - bias;
  const [w0, w1] = weights;

  const pts: {x: number; y: number}[] = [];

  // Intersect with left and right bounds
  if (Math.abs(w1) > 1e-8) {
    for (const x of [bounds.xMin, bounds.xMax]) {
      const sx = toSx(x);
      const sy = (target - w0 * sx) / w1;
      const y = fromSy(sy);
      if (y >= bounds.yMin - 1e-6 && y <= bounds.yMax + 1e-6) {
        pts.push({x, y: Math.max(bounds.yMin, Math.min(bounds.yMax, y))});
      }
    }
  }

  // Intersect with top and bottom bounds (only if we still need more points)
  if (pts.length < 2 && Math.abs(w0) > 1e-8) {
    for (const y of [bounds.yMin, bounds.yMax]) {
      const sy = toSy(y);
      const sx = (target - w1 * sy) / w0;
      const x = fromSx(sx);
      // Use strict interior to avoid duplicating corner points
      if (x > bounds.xMin + 1e-6 && x < bounds.xMax - 1e-6) {
        pts.push({x, y});
      }
    }
  }

  if (pts.length < 2) return null;
  return {
    x1: pts[0].x,
    y1: pts[0].y,
    x2: pts[pts.length - 1].x,
    y2: pts[pts.length - 1].y,
  };
}

// ── Formatting ────────────────────────────────────────────────────────────────

function formatC(c: number): string {
  if (c >= 100) return c.toFixed(0);
  if (c >= 10) return c.toFixed(0);
  if (c >= 1) return c.toFixed(1);
  if (c >= 0.1) return c.toFixed(2);
  return c.toFixed(3);
}

// ── Component ─────────────────────────────────────────────────────────────────

const SVMVisualization: React.FunctionComponent<SVMVisualizationProps> = ({
  state,
  onRetrain,
}) => {
  const {points, result, phase} = state;

  // Local UI state for the controls (independent of the last-trained values)
  const [sliderLog, setSliderLog] = useState(() => Math.log10(state.C || C_DEFAULT));
  const [pendingKernel, setPendingKernel] = useState<KernelType>(state.kernel);

  // Sync controls back to defaults when reset is triggered
  useEffect(() => {
    if (!result) {
      setSliderLog(Math.log10(C_DEFAULT));
      setPendingKernel('linear');
    }
  }, [result]);

  // ── Coordinate computation ────────────────────────────────────────────────

  const bounds = useMemo(() => computeBounds(points), [points]);
  const {toSvgX, toSvgY} = useMemo(() => makeScalers(bounds), [bounds]);

  // Decision boundary and margin lines (linear kernel only)
  const decisionLines = useMemo(() => {
    if (!result || result.kernel !== 'linear' || !result.weights) return null;
    const {weights, bias, scaler} = result;
    return {
      boundary: clipLine(weights, bias, 0, scaler, bounds),
      marginPos: clipLine(weights, bias, 1, scaler, bounds),
      marginNeg: clipLine(weights, bias, -1, scaler, bounds),
    };
  }, [result, bounds]);

  // RBF decision region grid
  const gridCells = useMemo(() => {
    if (!result || result.kernel !== 'rbf' || points.length === 0) return [];

    const {scaler, alphas, bias, gamma} = result;
    const {xMin: sxMin, xMax: sxMax, yMin: syMin, yMax: syMax} = scaler;
    const xRange = sxMax - sxMin || 1;
    const yRange = syMax - syMin || 1;

    const toSx = (x: number) => (2 * (x - sxMin)) / xRange - 1;
    const toSy = (y: number) => (2 * (y - syMin)) / yRange - 1;

    // Precompute scaled support vectors (skip zero-alpha points for speed)
    const svPts = points
      .map((p, i) => ({
        sx: toSx(p.x),
        sy: toSy(p.y),
        label: p.label,
        alpha: i < alphas.length ? alphas[i] : 0,
      }))
      .filter(p => p.alpha > SMO_ALPHA_TOL);

    const g = RBF_GRID_SIZE;
    const cellW = (bounds.xMax - bounds.xMin) / g;
    const cellH = (bounds.yMax - bounds.yMin) / g;

    const cells: {x: number; y: number; w: number; h: number; predicted: 1 | -1}[] =
      [];

    for (let ix = 0; ix < g; ix++) {
      for (let iy = 0; iy < g; iy++) {
        const x = bounds.xMin + (ix + 0.5) * cellW;
        const y = bounds.yMin + (iy + 0.5) * cellH;
        const sx = toSx(x);
        const sy = toSy(y);

        let fval = bias;
        for (const p of svPts) {
          const dx = sx - p.sx;
          const dy = sy - p.sy;
          fval += p.alpha * p.label * Math.exp(-gamma * (dx * dx + dy * dy));
        }

        cells.push({x, y, w: cellW, h: cellH, predicted: fval >= 0 ? 1 : -1});
      }
    }
    return cells;
  }, [result, bounds, points]);

  // ── Control handlers ──────────────────────────────────────────────────────

  const isTrained = phase === 'trained';
  const displayC = Math.pow(10, sliderLog);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSliderLog(parseFloat(e.target.value));
  };

  const handleSliderRelease = () => {
    if (isTrained) onRetrain(Math.pow(10, sliderLog), pendingKernel);
  };

  const handleKernelChange = (kernel: KernelType) => {
    setPendingKernel(kernel);
    if (isTrained) onRetrain(Math.pow(10, sliderLog), kernel);
  };

  const handleRetrain = () => {
    if (isTrained) onRetrain(Math.pow(10, sliderLog), pendingKernel);
  };

  // ── Status text ───────────────────────────────────────────────────────────

  const statusContent = (() => {
    if (phase === 'training') {
      return <span>Training...</span>;
    }
    if (phase === 'trained' && result) {
      const n = result.supportVectorIndices.length;
      return (
        <>
          <span className={moduleStyles.svBadge}>
            {n} support vector{n !== 1 ? 's' : ''}
          </span>
          {result.marginWidth !== null && (
            <span className={moduleStyles.marginBadge}>
              margin {result.marginWidth.toFixed(2)}
            </span>
          )}
          <span>C = {formatC(result.C)}</span>
          <span>{result.kernel === 'linear' ? 'Linear' : 'RBF'}</span>
        </>
      );
    }
    return (
      <span className={moduleStyles.emptyMessage}>
        Run your code to train the model
      </span>
    );
  })();

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={moduleStyles.container}>
      {/* Control bar */}
      <div className={moduleStyles.controls}>
        {/* C slider */}
        <span className={moduleStyles.cLabel}>C:</span>
        <input
          type="range"
          className={moduleStyles.cSlider}
          min={C_LOG_MIN}
          max={C_LOG_MAX}
          step={C_LOG_STEP}
          value={sliderLog}
          disabled={!isTrained}
          onChange={handleSliderChange}
          onMouseUp={handleSliderRelease}
          onPointerUp={handleSliderRelease}
        />
        <span className={moduleStyles.cValue}>{formatC(displayC)}</span>

        <div className={moduleStyles.separator} />

        {/* Kernel toggle */}
        <div className={moduleStyles.kernelToggle}>
          <button
            type="button"
            className={`${moduleStyles.controlButton}${pendingKernel === 'linear' ? ` ${moduleStyles.active}` : ''}`}
            disabled={!isTrained}
            onClick={() => handleKernelChange('linear')}
          >
            Linear
          </button>
          <button
            type="button"
            className={`${moduleStyles.controlButton}${pendingKernel === 'rbf' ? ` ${moduleStyles.active}` : ''}`}
            disabled={!isTrained}
            onClick={() => handleKernelChange('rbf')}
          >
            RBF
          </button>
        </div>

        <div className={moduleStyles.separator} />

        {/* Retrain button */}
        <button
          type="button"
          className={moduleStyles.controlButton}
          disabled={!isTrained}
          onClick={handleRetrain}
        >
          Retrain
        </button>
      </div>

      {/* SVG canvas */}
      <svg
        className={moduleStyles.svgCanvas}
        viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {points.length === 0 && (
          <text
            x={SVG_SIZE / 2}
            y={SVG_SIZE / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={14}
            fill="#aaa"
          >
            Run your code to add data points
          </text>
        )}

        {/* RBF decision region grid (rendered first, behind everything) */}
        {result?.kernel === 'rbf' &&
          gridCells.map((cell, i) => {
            const svgX = toSvgX(cell.x - cell.w / 2);
            const svgY = toSvgY(cell.y + cell.h / 2); // top in SVG = higher data y
            const svgW = Math.abs(toSvgX(cell.x + cell.w / 2) - svgX);
            const svgH = Math.abs(toSvgY(cell.y - cell.h / 2) - svgY);
            return (
              <rect
                key={i}
                x={svgX}
                y={svgY}
                width={svgW}
                height={svgH}
                fill={cell.predicted === 1 ? CLASS_COLOR_POS : CLASS_COLOR_NEG}
                opacity={0.2}
              />
            );
          })}

        {/* Margin fill band (linear kernel) */}
        {result?.kernel === 'linear' &&
          decisionLines?.marginPos &&
          decisionLines?.marginNeg && (() => {
            const {marginPos: mp, marginNeg: mn} = decisionLines;
            const svgPts = [
              [toSvgX(mp.x1), toSvgY(mp.y1)],
              [toSvgX(mp.x2), toSvgY(mp.y2)],
              [toSvgX(mn.x2), toSvgY(mn.y2)],
              [toSvgX(mn.x1), toSvgY(mn.y1)],
            ];
            return (
              <polygon
                points={svgPts.map(([x, y]) => `${x},${y}`).join(' ')}
                fill={MARGIN_COLOR}
                fillOpacity={MARGIN_FILL_OPACITY}
              />
            );
          })()}

        {/* Margin lines (dashed, linear kernel) */}
        {result?.kernel === 'linear' &&
          decisionLines?.marginPos && (
            <line
              x1={toSvgX(decisionLines.marginPos.x1)}
              y1={toSvgY(decisionLines.marginPos.y1)}
              x2={toSvgX(decisionLines.marginPos.x2)}
              y2={toSvgY(decisionLines.marginPos.y2)}
              stroke={MARGIN_COLOR}
              strokeWidth={1.5}
              strokeDasharray="5,4"
            />
          )}
        {result?.kernel === 'linear' &&
          decisionLines?.marginNeg && (
            <line
              x1={toSvgX(decisionLines.marginNeg.x1)}
              y1={toSvgY(decisionLines.marginNeg.y1)}
              x2={toSvgX(decisionLines.marginNeg.x2)}
              y2={toSvgY(decisionLines.marginNeg.y2)}
              stroke={MARGIN_COLOR}
              strokeWidth={1.5}
              strokeDasharray="5,4"
            />
          )}

        {/* Decision boundary (solid, linear kernel) */}
        {result?.kernel === 'linear' && decisionLines?.boundary && (
          <line
            x1={toSvgX(decisionLines.boundary.x1)}
            y1={toSvgY(decisionLines.boundary.y1)}
            x2={toSvgX(decisionLines.boundary.x2)}
            y2={toSvgY(decisionLines.boundary.y2)}
            stroke={DECISION_BOUNDARY_COLOR}
            strokeWidth={2}
          />
        )}

        {/* Support vector rings (rendered behind the filled circle) */}
        {result &&
          result.supportVectorIndices.map(idx => {
            const point = points[idx];
            if (!point) return null;
            const color = point.label === 1 ? CLASS_COLOR_POS : CLASS_COLOR_NEG;
            return (
              <circle
                key={`sv-ring-${point.id}`}
                cx={toSvgX(point.x)}
                cy={toSvgY(point.y)}
                r={SUPPORT_VECTOR_RING_RADIUS}
                fill="none"
                stroke={color}
                strokeWidth={2}
                opacity={0.7}
              />
            );
          })}

        {/* Data points */}
        {points.map((point: LabeledPoint) => {
          const fill = point.label === 1 ? CLASS_COLOR_POS : CLASS_COLOR_NEG;
          return (
            <circle
              key={point.id}
              cx={toSvgX(point.x)}
              cy={toSvgY(point.y)}
              r={POINT_RADIUS}
              fill={fill}
              stroke="#fff"
              strokeWidth={1.5}
            />
          );
        })}
      </svg>

      {/* Training overlay */}
      {phase === 'training' && (
        <div className={moduleStyles.trainingOverlay}>Training...</div>
      )}

      {/* Status bar */}
      <div className={moduleStyles.status}>{statusContent}</div>
    </div>
  );
};

export default SVMVisualization;
