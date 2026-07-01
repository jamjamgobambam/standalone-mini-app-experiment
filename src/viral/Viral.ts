import * as timeoutList from '../engine/timeoutList';

import {
  SIGNAL_CHECK_TIME,
  VIEW_ANIMATION_MS,
  ViralSignalType,
} from './constants';
import {ViralCallbacks, ViralSignal} from './types';

export default class Viral {
  private callbacks: ViralCallbacks;

  // Signal queue (Python → JS)
  private signals: ViralSignal[];
  private nextSignalIndex: number;
  private isProcessingSignals: boolean;
  private resolveOnDone?: () => void;
  private donePromise: Promise<void> | null;

  constructor(callbacks: ViralCallbacks) {
    this.callbacks = callbacks;
    this.signals = [];
    this.nextSignalIndex = 0;
    this.isProcessingSignals = false;
    this.donePromise = null;
  }

  // ── Signal queue ──────────────────────────────────────────────────────────

  handleSignal(signal: ViralSignal | null) {
    if (!signal) return;
    this.signals.push(signal);
  }

  processSignals() {
    if (this.signals.length > this.nextSignalIndex) {
      const signal = this.signals[this.nextSignalIndex];

      if (signal.value === ViralSignalType.DONE) {
        this.callbacks.onDone();
        this.callbacks.setIsRunning(false);
        this.isProcessingSignals = false;
        if (this.resolveOnDone) this.resolveOnDone();
        return;
      }

      const delay =
        signal.value === ViralSignalType.VIEW ? VIEW_ANIMATION_MS : 0;

      this.applySignal(signal);
      this.nextSignalIndex++;
      timeoutList.setTimeout(() => this.processSignals(), delay);
    } else {
      timeoutList.setTimeout(() => this.processSignals(), SIGNAL_CHECK_TIME);
    }
  }

  private applySignal(signal: ViralSignal) {
    switch (signal.value) {
      case ViralSignalType.INIT: {
        const networkSize = signal.detail?.network_size ?? 0;
        this.callbacks.onInit(networkSize);
        break;
      }
      case ViralSignalType.VIEW: {
        const day = signal.detail?.day ?? 0;
        const views = signal.detail?.views ?? 0;
        this.callbacks.onView(day, views);
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
    this.signals.push({value: ViralSignalType.DONE});
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
