/**
 * Wires the Thermostat controller into the prototyping environment.
 * Mirrors the pattern of HillClimbingPreview.tsx.
 */

import React, {useImperativeHandle, useMemo, useState} from 'react';

import {ParsedSignal} from '../engine/signalParser';
import {
  INITIAL_PREFERENCES,
  INITIAL_TEMP,
  MAX_TEMP,
  MIN_TEMP,
  ThermostatSignalType,
} from './constants';
import Thermostat from './Thermostat';
import ThermostatVisualization from './ThermostatVisualization';
import {ThermostatSignal, ThermostatVisualizationState} from './types';

export interface ThermostatPreviewHandle {
  handleParsedSignal: (signal: ParsedSignal) => void;
  reset: () => void;
  onRun: () => void;
  onClose: () => void;
}

const defaultState: ThermostatVisualizationState = {
  minTemp: MIN_TEMP,
  maxTemp: MAX_TEMP,
  preferences: INITIAL_PREFERENCES,
  currentTemp: INITIAL_TEMP,
  phase: 'idle',
};

const ThermostatPreview = React.forwardRef<ThermostatPreviewHandle>(
  (_props, ref) => {
    const [state, setState] = useState<ThermostatVisualizationState>(defaultState);
    const [, setIsRunning] = useState(false);

    const controller = useMemo(
      () =>
        new Thermostat({
          setIsRunning,
          onInit: (
            minTemp: number,
            maxTemp: number,
            preferences: number[],
            startTemp: number
          ) =>
            setState({
              minTemp,
              maxTemp,
              preferences,
              currentTemp: startTemp,
              phase: 'running',
            }),
          onTurn: (temp: number) =>
            setState(prev => ({...prev, currentTemp: temp})),
          onDone: () => setState(prev => ({...prev, phase: 'done'})),
          onReset: () => setState(defaultState),
        }),
      [] // eslint-disable-line react-hooks/exhaustive-deps
    );

    useImperativeHandle(ref, () => ({
      handleParsedSignal(signal: ParsedSignal) {
        if (signal.type !== 'THERMOSTAT') return;
        const s: ThermostatSignal = {
          value: signal.key as ThermostatSignalType,
          detail: (signal.detail ?? undefined) as ThermostatSignal['detail'],
        };
        controller.handleSignal(s);
      },
      reset: () => controller.reset(),
      onRun: () => controller.onRun(),
      onClose: () => controller.onClose(),
    }));

    return <ThermostatVisualization state={state} />;
  }
);

ThermostatPreview.displayName = 'ThermostatPreview';

export default ThermostatPreview;
