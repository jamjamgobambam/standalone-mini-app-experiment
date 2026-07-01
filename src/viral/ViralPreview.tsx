/**
 * Wires the Viral controller into the prototyping environment.
 *
 * Unlike most mini-apps, ``viral`` does not consume structured signals.
 * Instead it parses raw stdout lines matching:
 *
 *     Day <day>: <views> views
 *
 * Students write a plain Python loop with a normal ``print`` call;
 * this preview component handles the rest.
 */

import React, {useImperativeHandle, useMemo, useState} from 'react';

import {ParsedSignal} from '../engine/signalParser';
import {DEFAULT_NETWORK_SIZE, ViralSignalType} from './constants';
import Viral from './Viral';
import ViralVisualization from './ViralVisualization';
import {ViralSignal, ViralVisualizationState} from './types';

export interface ViralPreviewHandle {
  handleParsedSignal: (signal: ParsedSignal) => void;
  handleStdout?: (line: string) => void;
  reset: () => void;
  onRun: () => void;
  onClose: () => void;
}

const defaultState: ViralVisualizationState = {
  networkSize: DEFAULT_NETWORK_SIZE,
  views: 0,
  day: 0,
  peakViews: 0,
  phase: 'idle',
};

/**
 * Matches lines like:
 *   "Day 0: 150 views"
 *   "Day 12: 19,403 views"
 *   "Day 33: 7_000_000_000 view"
 *
 * Tolerates extra whitespace; allows commas and underscores in the
 * number (Python's ``f"{n:,}"`` and ``1_000_000`` literal styles).
 */
const VIEW_LINE_RE = /^\s*Day\s+(\d+)\s*:\s*([\d,_]+)\s+views?\s*$/i;

function parseViewLine(line: string): {day: number; views: number} | null {
  const m = VIEW_LINE_RE.exec(line);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const views = parseInt(m[2].replace(/[,_]/g, ''), 10);
  if (Number.isNaN(day) || Number.isNaN(views)) return null;
  return {day, views};
}

const ViralPreview = React.forwardRef<ViralPreviewHandle>((_props, ref) => {
  const [state, setState] = useState<ViralVisualizationState>(defaultState);
  const [, setIsRunning] = useState(false);

  const controller = useMemo(
    () =>
      new Viral({
        setIsRunning,
        onInit: (networkSize: number) =>
          setState({
            networkSize: networkSize || DEFAULT_NETWORK_SIZE,
            views: 0,
            day: 0,
            peakViews: 0,
            phase: 'running',
          }),
        onView: (day: number, views: number) =>
          setState(prev => ({
            ...prev,
            day,
            views,
            peakViews: Math.max(prev.peakViews, views),
          })),
        onDone: () => setState(prev => ({...prev, phase: 'done'})),
        onReset: () => setState(defaultState),
      }),
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useImperativeHandle(ref, () => ({
    handleParsedSignal(signal: ParsedSignal) {
      // No structured signals expected; left in for interface compatibility.
      if (signal.type !== 'VIRAL') return;
      const s: ViralSignal = {
        value: signal.key as ViralSignalType,
        detail: (signal.detail ?? undefined) as ViralSignal['detail'],
      };
      controller.handleSignal(s);
    },
    handleStdout(line: string) {
      const parsed = parseViewLine(line);
      if (!parsed) return;
      controller.handleSignal({
        value: ViralSignalType.VIEW,
        detail: {day: parsed.day, views: parsed.views},
      });
    },
    reset: () => controller.reset(),
    onRun: () => {
      controller.reset();
      // Push the INIT directly so the visualization wakes up before any
      // print lines arrive — no Python-side INIT signal exists anymore.
      controller.handleSignal({
        value: ViralSignalType.INIT,
        detail: {network_size: DEFAULT_NETWORK_SIZE},
      });
      controller.onRun();
    },
    onClose: () => controller.onClose(),
  }));

  return <ViralVisualization state={state} />;
});

ViralPreview.displayName = 'ViralPreview';

export default ViralPreview;
