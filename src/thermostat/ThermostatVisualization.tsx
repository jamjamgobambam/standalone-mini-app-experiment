import React, {useMemo} from 'react';

import {
  BAR_FILL,
  BAR_FILL_SELECTED,
  BAR_INNER_R,
  BAR_PIXELS_PER_PERSON,
  BAR_WIDTH,
  DIAL_CX,
  DIAL_CY,
  DIAL_FACE_FILL,
  DIAL_FACE_R,
  DIAL_FACE_STROKE,
  DIAL_INNER_R,
  DIAL_OUTER_R,
  DIAL_RING_INNER,
  DIAL_RING_OUTER,
  DIAL_TICK_FILL,
  READOUT_FILL,
  SVG_HEIGHT,
  SVG_WIDTH,
  TEMP_LABEL_FILL,
  TEMP_LABEL_FILL_SELECTED,
  TEMP_LABEL_R,
  TICK_INNER_R,
  TICK_OUTER_R,
} from './constants';
import {ThermostatVisualizationState} from './types';

import moduleStyles from './thermostat.module.css';

interface Props {
  state: ThermostatVisualizationState;
}

/**
 * Map a temperature index to its angle around the dial.
 * Math convention (0° = right, 90° = up, 180° = left).
 * Index 0 (lowest temp) sits on the left, last index on the right,
 * with the bars sweeping over the upper semicircle.
 */
function mathAngleDeg(index: number, count: number): number {
  if (count <= 1) return 90;
  return 180 - (index * 180) / (count - 1);
}

/**
 * CSS rotate() angle (clockwise from 12 o'clock) needed to point a
 * "facing up" element toward the given math angle.
 */
function cssRotateDeg(index: number, count: number): number {
  if (count <= 1) return 0;
  return (index * 180) / (count - 1) - 90;
}

function polar(cx: number, cy: number, r: number, mathAngleRad: number) {
  return {
    x: cx + r * Math.cos(mathAngleRad),
    y: cy - r * Math.sin(mathAngleRad),
  };
}

const ThermostatVisualization: React.FunctionComponent<Props> = ({state}) => {
  const {minTemp, maxTemp, preferences, currentTemp, phase} = state;

  const tempCount = preferences.length;
  const isInitialized = tempCount > 0;

  const currentIndex = isInitialized ? currentTemp - minTemp : 0;
  const peoplePreferring = isInitialized
    ? preferences[currentIndex] ?? 0
    : 0;

  const tickCss = useMemo(() => {
    if (!isInitialized) return 0;
    return cssRotateDeg(currentIndex, tempCount);
  }, [currentIndex, tempCount, isInitialized]);

  const status = (() => {
    if (!isInitialized) {
      return (
        <span className={moduleStyles.emptyMessage}>
          Run your code to set the thermostat
        </span>
      );
    }
    if (phase === 'running')
      return (
        <span>
          Climbing… current setting {currentTemp}°F · {peoplePreferring}{' '}
          {peoplePreferring === 1 ? 'person likes' : 'people like'} it
        </span>
      );
    if (phase === 'done')
      return (
        <span>
          Done — settled at {currentTemp}°F ({peoplePreferring}{' '}
          {peoplePreferring === 1 ? 'person' : 'people'})
        </span>
      );
    return <span>Setting: {currentTemp}°F</span>;
  })();

  // Pre-compute the bar / label positions.
  const ticks = useMemo(() => {
    if (!isInitialized) return [];
    return preferences.map((count, i) => {
      const temp = minTemp + i;
      const angleDeg = mathAngleDeg(i, tempCount);
      const rad = (angleDeg * Math.PI) / 180;
      const barLen = Math.max(count * BAR_PIXELS_PER_PERSON, 4);
      const inner = polar(DIAL_CX, DIAL_CY, BAR_INNER_R, rad);
      const outer = polar(DIAL_CX, DIAL_CY, BAR_INNER_R + barLen, rad);
      const label = polar(DIAL_CX, DIAL_CY, TEMP_LABEL_R, rad);
      const labelRotate = cssRotateDeg(i, tempCount);
      return {
        temp,
        count,
        inner,
        outer,
        label,
        labelRotate,
        isCurrent: temp === currentTemp,
      };
    });
  }, [preferences, minTemp, tempCount, currentTemp, isInitialized]);

  return (
    <div className={moduleStyles.container}>
      <svg
        className={moduleStyles.svgCanvas}
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {!isInitialized && (
          <text
            x={SVG_WIDTH / 2}
            y={SVG_HEIGHT / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={14}
            fill="#aaa"
          >
            Run your code to begin
          </text>
        )}

        {isInitialized && (
          <>
            {/* Bars + temperature labels */}
            {ticks.map(t => (
              <g key={`tick-${t.temp}`}>
                <line
                  x1={t.inner.x}
                  y1={t.inner.y}
                  x2={t.outer.x}
                  y2={t.outer.y}
                  stroke={t.isCurrent ? BAR_FILL_SELECTED : BAR_FILL}
                  strokeWidth={BAR_WIDTH}
                  strokeLinecap="round"
                  className={moduleStyles.bar}
                />
                <text
                  x={t.label.x}
                  y={t.label.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className={moduleStyles.tempLabel}
                  fill={
                    t.isCurrent
                      ? TEMP_LABEL_FILL_SELECTED
                      : TEMP_LABEL_FILL
                  }
                  transform={`rotate(${t.labelRotate} ${t.label.x} ${t.label.y})`}
                >
                  {t.temp}
                </text>
              </g>
            ))}

            {/* Dial — outer ring */}
            <circle
              cx={DIAL_CX}
              cy={DIAL_CY}
              r={DIAL_OUTER_R}
              fill={DIAL_RING_OUTER}
            />
            <circle
              cx={DIAL_CX}
              cy={DIAL_CY}
              r={DIAL_INNER_R}
              fill={DIAL_RING_INNER}
            />
            {/* Dial — face */}
            <circle
              cx={DIAL_CX}
              cy={DIAL_CY}
              r={DIAL_FACE_R}
              fill={DIAL_FACE_FILL}
              stroke={DIAL_FACE_STROKE}
              strokeWidth={1.5}
            />

            {/* Digital readout in the centre */}
            <text
              x={DIAL_CX}
              y={DIAL_CY - 32}
              textAnchor="middle"
              className={moduleStyles.readoutCaption}
            >
              SET TO
            </text>
            <text
              x={DIAL_CX}
              y={DIAL_CY + 12}
              textAnchor="middle"
              className={moduleStyles.readout}
              fill={READOUT_FILL}
            >
              {currentTemp}
              <tspan
                className={moduleStyles.readoutSuffix}
                dx={2}
                dy={-18}
              >
                °F
              </tspan>
            </text>
            <text
              x={DIAL_CX}
              y={DIAL_CY + 40}
              textAnchor="middle"
              fontSize={12}
              fill="#64748b"
            >
              {peoplePreferring}{' '}
              {peoplePreferring === 1 ? 'person prefers' : 'people prefer'}
            </text>

            {/* Red tick mark — rotates around dial centre */}
            <g
              style={{transform: `translate(${DIAL_CX}px, ${DIAL_CY}px)`}}
            >
              <g
                className={moduleStyles.tickRotate}
                style={{transform: `rotate(${tickCss}deg)`}}
              >
                <polygon
                  points={`0,${-TICK_OUTER_R} -7,${-TICK_INNER_R} 7,${-TICK_INNER_R}`}
                  fill={DIAL_TICK_FILL}
                />
              </g>
            </g>
          </>
        )}
      </svg>

      <div className={moduleStyles.status}>{status}</div>
    </div>
  );
};

export default ThermostatVisualization;
