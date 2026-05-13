import * as timeoutList from '../engine/timeoutList';

import {
  SIGNAL_CHECK_TIME,
  ThermostatSignalType,
  TURN_TOTAL_MS,
} from './constants';
import {ThermostatCallbacks, ThermostatSignal} from './types';

export default class Thermostat {
  private callbacks: ThermostatCallbacks;

  // Signal queue (Python → JS)
  private signals: ThermostatSignal[];
  private nextSignalIndex: number;
  private isProcessingSignals: boolean;
  private resolveOnDone?: () => void;
  private donePromise: Promise<void> | null;

  constructor(callbacks: ThermostatCallbacks) {
    this.callbacks = callbacks;
    this.signals = [];
    this.nextSignalIndex = 0;
    this.isProcessingSignals = false;
    this.donePromise = null;
  }

  // ── Signal queue ──────────────────────────────────────────────────────────

  handleSignal(signal: ThermostatSignal | null) {
    if (!signal) return;
    this.signals.push(signal);
  }

  processSignals() {
    if (this.signals.length > this.nextSignalIndex) {
      const signal = this.signals[this.nextSignalIndex];

      if (signal.value === ThermostatSignalType.DONE) {
        this.callbacks.onDone();
        this.callbacks.setIsRunning(false);
        this.isProcessingSignals = false;
        if (this.resolveOnDone) this.resolveOnDone();
        return;
      }

      const delay =
        signal.value === ThermostatSignalType.TURN ? TURN_TOTAL_MS : 0;

      this.applySignal(signal);
      this.nextSignalIndex++;
      timeoutList.setTimeout(() => this.processSignals(), delay);
    } else {
      timeoutList.setTimeout(() => this.processSignals(), SIGNAL_CHECK_TIME);
    }
  }

  private applySignal(signal: ThermostatSignal) {
    switch (signal.value) {
      case ThermostatSignalType.INIT: {
        const minTemp = signal.detail?.min_temp ?? 0;
        const maxTemp = signal.detail?.max_temp ?? 0;
        const preferences = signal.detail?.preferences ?? [];
        const startTemp = signal.detail?.start_temp ?? minTemp;
        this.callbacks.onInit(minTemp, maxTemp, preferences, startTemp);
        break;
      }
      case ThermostatSignalType.TURN: {
        const temp = signal.detail?.temp;
        if (typeof temp === 'number') this.callbacks.onTurn(temp);
        break;
      }
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  onRun() {
    this.isProcessingSignals = true;
    this.callbacks.setIsRunning(true);
    timeoutList.setTimeout(() => this.processSignals(), SIGNAL_CHECK_TIME);
  }

  onClose() {
    this.signals.push({value: ThermostatSignalType.DONE});
  }

  reset() {
    timeoutList.clearTimeouts();
    this.signals = [];
    this.nextSignalIndex = 0;
    this.isProcessingSignals = false;
    this.callbacks.onReset();
  }

  isRunning() {
    return this.isProcessingSignals;
  }

  waitUntilDone(): Promise<void> {
    if (!this.isRunning()) return Promise.resolve();
    if (this.donePromise) return this.donePromise;
    this.donePromise = new Promise(resolve => {
      this.resolveOnDone = () => {
        resolve();
        this.donePromise = null;
        this.resolveOnDone = undefined;
      };
    });
    return this.donePromise;
  }
}
