/**
 * Wires the SVM controller into the prototyping environment.
 *
 * Mirrors the pattern of KMeansPreview.tsx:
 *  - forwardRef + useImperativeHandle implements MiniAppPreviewHandle
 *  - useMemo creates the controller once (capturing callbacks from first render)
 *  - handleParsedSignal translates generic ParsedSignal → SVMSignal
 *  - Local useState manages visualization state via controller callbacks
 */

import React, {useImperativeHandle, useMemo, useState} from 'react';

import {ParsedSignal} from '../engine/signalParser';
import {C_DEFAULT, SVMSignalType} from './constants';
import SVM from './SVM';
import SVMVisualization from './SVMVisualization';
import {SVMSignal, SVMVisualizationState} from './types';

export interface SVMPreviewHandle {
  handleParsedSignal: (signal: ParsedSignal) => void;
  reset: () => void;
  onRun: () => void;
  onClose: () => void;
}

const defaultState: SVMVisualizationState = {
  points: [],
  result: null,
  phase: 'idle',
  kernel: 'linear',
  C: C_DEFAULT,
};

const SVMPreview = React.forwardRef<SVMPreviewHandle>((_props, ref) => {
  const [state, setState] = useState<SVMVisualizationState>(defaultState);
  // isRunning is internal; in production this would dispatch to Redux
  const [, setIsRunning] = useState(false);

  const svm = useMemo(
    () =>
      new SVM({
        setIsRunning,
        onAddPoint: point =>
          setState(prev => ({
            ...prev,
            points: [...prev.points, point],
            phase: 'collecting',
          })),
        onTrainingStart: () =>
          setState(prev => ({...prev, phase: 'training'})),
        onTrainingComplete: result =>
          setState(prev => ({
            ...prev,
            result,
            phase: 'trained',
            C: result.C,
            kernel: result.kernel,
          })),
        onReset: () => setState(defaultState),
      }),
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useImperativeHandle(ref, () => ({
    handleParsedSignal(signal: ParsedSignal) {
      if (signal.type !== 'SVM') return;
      const svmSignal: SVMSignal = {
        value: signal.key as SVMSignalType,
        detail: (signal.detail ?? undefined) as SVMSignal['detail'],
      };
      svm.handleSignal(svmSignal);
    },
    reset: () => svm.reset(),
    onRun: () => svm.onRun(),
    onClose: () => svm.onClose(),
  }));

  return (
    <SVMVisualization
      state={state}
      onRetrain={(C, kernel) => svm.retrain(C, kernel)}
    />
  );
});

SVMPreview.displayName = 'SVMPreview';

export default SVMPreview;
