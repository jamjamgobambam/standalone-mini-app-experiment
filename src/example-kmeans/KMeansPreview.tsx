/**
 * Adapted from apps/src/codebridge/MiniAppPreview/KMeansPreview.tsx
 *
 * Changes vs. production:
 *  - No CodebridgeRegistry (uses React.forwardRef + useImperativeHandle instead)
 *  - No Redux dispatch — setIsRunning is handled via local useState
 *  - No props required — conforms to the generic MiniAppPreviewHandle interface
 *  - Exposes handleParsedSignal() which translates the generic ParsedSignal
 *    from the engine into the KMeans-specific KMeansSignal type
 *
 * When promoting to production:
 *  - Replace useImperativeHandle with CodebridgeRegistry.getInstance().setKMeans()
 *  - Replace local setIsRunning with useAppDispatch(setIsRunning)
 *  - Swap ParsedSignal routing for the pyodideWorkerManager dispatch branch
 */

import React, {useImperativeHandle, useMemo, useState} from 'react';

import {ParsedSignal} from '../engine/signalParser';
import {KMeansSignalType} from './constants';
import KMeans from './KMeans';
import KMeansVisualization from './KMeansVisualization';
import {KMeansSignal, KMeansVisualizationState} from './types';

export interface KMeansPreviewHandle {
  handleParsedSignal: (signal: ParsedSignal) => void;
  reset: () => void;
  onRun: () => void;
  onClose: () => void;
}

const defaultState: KMeansVisualizationState = {
  points: [],
  centroids: [],
  assignments: new Map(),
  converged: false,
  iteration: 0,
  isReady: false,
  isAnimating: false,
};

// No props required — conforms to the generic MiniAppPreviewHandle contract.
const KMeansPreview = React.forwardRef<KMeansPreviewHandle>((_props, ref) => {
  const [state, setState] = useState<KMeansVisualizationState>(defaultState);
  // isRunning is internal state; in production this would be dispatched to Redux.
  const [, setIsRunning] = useState(false);

    const kmeans = useMemo(
      () =>
        new KMeans({
          setIsRunning,
          onAddPoint: point =>
            setState(prev => ({...prev, points: [...prev.points, point]})),
          onReady: () => setState(prev => ({...prev, isReady: true})),
          onReset: () => setState(defaultState),
          onCentroidsInitialized: centroids =>
            setState(prev => ({...prev, centroids, iteration: 0})),
          onAssigned: assignments =>
            setState(prev => ({
              ...prev,
              assignments: new Map(assignments),
              iteration:
                assignments.length > 0 ? prev.iteration + 1 : prev.iteration,
            })),
          onCentroidsUpdated: centroids =>
            setState(prev => ({...prev, centroids})),
          onConverged: () =>
            setState(prev => ({...prev, converged: true, isAnimating: false})),
          onAnimationStart: () =>
            setState(prev => ({...prev, isAnimating: true})),
          onAnimationEnd: () =>
            setState(prev => ({...prev, isAnimating: false})),
        }),
      [] // eslint-disable-line react-hooks/exhaustive-deps
    );

    useImperativeHandle(ref, () => ({
      handleParsedSignal(signal: ParsedSignal) {
        if (signal.type !== 'KMEANS') return;
        const kmeansSignal: KMeansSignal = {
          value: signal.key as KMeansSignalType,
          detail: (signal.detail ?? undefined) as KMeansSignal['detail'],
        };
        kmeans.handleSignal(kmeansSignal);
      },
      reset: () => kmeans.reset(),
      onRun: () => kmeans.onRun(),
      onClose: () => kmeans.onClose(),
    }));

    return (
      <KMeansVisualization
        state={state}
        onInitialize={() => kmeans.initialize()}
        onStep={() => kmeans.step()}
        onPlay={() => kmeans.play()}
      />
    );
  }
);

KMeansPreview.displayName = 'KMeansPreview';

export default KMeansPreview;
