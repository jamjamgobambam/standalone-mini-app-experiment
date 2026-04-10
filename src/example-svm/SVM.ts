import * as timeoutList from '../engine/timeoutList';

import {
  C_DEFAULT,
  RBF_GAMMA_DEFAULT,
  SIGNAL_CHECK_TIME,
  SMO_ALPHA_TOL,
  SMO_MAX_ITER,
  SMO_MAX_PASSES,
  SMO_TOLERANCE,
  SVMSignalType,
} from './constants';
import {
  KernelType,
  LabeledPoint,
  SVMCallbacks,
  SVMResult,
  SVMSignal,
  Scaler,
} from './types';

export default class SVM {
  private callbacks: SVMCallbacks;

  // Signal queue (from Python)
  private signals: SVMSignal[];
  private nextSignalIndex: number;
  private isProcessingSignals: boolean;
  private resolveOnDone?: () => void;
  private donePromise: Promise<void> | null;

  // Data and model state
  private points: LabeledPoint[];
  private kernel: KernelType;
  private C: number;
  private result: SVMResult | null;

  constructor(callbacks: SVMCallbacks) {
    this.callbacks = callbacks;
    this.signals = [];
    this.nextSignalIndex = 0;
    this.isProcessingSignals = false;
    this.donePromise = null;
    this.points = [];
    this.kernel = 'linear';
    this.C = C_DEFAULT;
    this.result = null;
  }

  // ── Signal queue (Python → JS) ────────────────────────────────────────────

  handleSignal(signal: SVMSignal | null) {
    if (!signal) return;
    this.signals.push(signal);
  }

  processSignals() {
    if (this.signals.length > this.nextSignalIndex) {
      const signal = this.signals[this.nextSignalIndex];

      if (signal.value === SVMSignalType.DONE) {
        this.callbacks.setIsRunning(false);
        if (this.resolveOnDone) {
          this.resolveOnDone();
        }
        return;
      }

      this.applySignal(signal);
      this.nextSignalIndex++;
      timeoutList.setTimeout(() => this.processSignals(), 0);
    } else {
      timeoutList.setTimeout(() => this.processSignals(), SIGNAL_CHECK_TIME);
    }
  }

  private applySignal(signal: SVMSignal) {
    switch (signal.value) {
      case SVMSignalType.ADD_POINT: {
        const {x, y, label, id} = signal.detail!;
        const point: LabeledPoint = {
          x: x!,
          y: y!,
          label: label as 1 | -1,
          id: id!,
        };
        this.points.push(point);
        this.callbacks.onAddPoint(point);
        break;
      }
      case SVMSignalType.FIT: {
        const C = signal.detail?.C ?? C_DEFAULT;
        this.C = C;
        this.callbacks.onTrainingStart();
        const result = this._train(C, this.kernel);
        this.result = result;
        this.callbacks.onTrainingComplete(result);
        break;
      }
    }
  }

  // ── Retraining (triggered by UI controls) ────────────────────────────────

  retrain(C: number, kernel: KernelType) {
    if (this.points.length < 2) return;
    this.C = C;
    this.kernel = kernel;
    this.callbacks.onTrainingStart();
    const result = this._train(C, kernel);
    this.result = result;
    this.callbacks.onTrainingComplete(result);
  }

  // ── SVM Algorithm (Simplified SMO) ───────────────────────────────────────

  private _train(C: number, kernel: KernelType): SVMResult {
    const n = this.points.length;

    if (n < 2) {
      return this._emptyResult(C, kernel);
    }

    // Require both classes to be present
    const hasPositive = this.points.some(p => p.label === 1);
    const hasNegative = this.points.some(p => p.label === -1);
    if (!hasPositive || !hasNegative) {
      return this._emptyResult(C, kernel);
    }

    // Feature scaling to [-1, 1] for numerical stability
    const xs = this.points.map(p => p.x);
    const ys = this.points.map(p => p.y);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    const xRange = xMax - xMin || 1;
    const yRange = yMax - yMin || 1;

    const scaler: Scaler = {xMin, xMax, yMin, yMax};

    const scaledPts = this.points.map(p => ({
      sx: (2 * (p.x - xMin)) / xRange - 1,
      sy: (2 * (p.y - yMin)) / yRange - 1,
      label: p.label,
    }));

    const gamma = RBF_GAMMA_DEFAULT;
    const {alphas, bias} = this._runSMO(scaledPts, C, kernel, gamma);

    // Identify support vectors (alpha_i > threshold)
    const supportVectorIndices = alphas
      .map((a, i) => ({a, i}))
      .filter(({a}) => a > SMO_ALPHA_TOL)
      .map(({i}) => i);

    // Compute weight vector for linear kernel
    let weights: [number, number] | null = null;
    let marginWidth: number | null = null;

    if (kernel === 'linear') {
      let wx = 0;
      let wy = 0;
      for (let i = 0; i < n; i++) {
        wx += alphas[i] * this.points[i].label * scaledPts[i].sx;
        wy += alphas[i] * this.points[i].label * scaledPts[i].sy;
      }
      weights = [wx, wy];
      // Margin width in scaled space (2/||w||)
      const wNorm = Math.sqrt(wx * wx + wy * wy);
      marginWidth = wNorm > 1e-10 ? 2 / wNorm : null;
    }

    return {
      alphas,
      bias,
      weights,
      gamma,
      supportVectorIndices,
      marginWidth,
      kernel,
      C,
      scaler,
    };
  }

  private _kernelFn(
    kernel: KernelType,
    gamma: number,
    sx1: number,
    sy1: number,
    sx2: number,
    sy2: number
  ): number {
    if (kernel === 'linear') {
      return sx1 * sx2 + sy1 * sy2;
    }
    const dx = sx1 - sx2;
    const dy = sy1 - sy2;
    return Math.exp(-gamma * (dx * dx + dy * dy));
  }

  /**
   * Simplified SMO (Platt 1998).
   *
   * Solves the SVM dual: maximize Σαi - 0.5 * Σij αi αj yi yj K(xi,xj)
   * subject to 0 ≤ αi ≤ C and Σ αi yi = 0.
   *
   * Support vectors are points where alpha_i > SMO_ALPHA_TOL.
   */
  private _runSMO(
    pts: {sx: number; sy: number; label: number}[],
    C: number,
    kernel: KernelType,
    gamma: number
  ): {alphas: number[]; bias: number} {
    const n = pts.length;
    const alphas = new Array<number>(n).fill(0);
    let bias = 0;

    const predict = (idx: number): number => {
      let sum = 0;
      for (let j = 0; j < n; j++) {
        if (alphas[j] < SMO_ALPHA_TOL) continue;
        sum +=
          alphas[j] *
          pts[j].label *
          this._kernelFn(
            kernel,
            gamma,
            pts[idx].sx,
            pts[idx].sy,
            pts[j].sx,
            pts[j].sy
          );
      }
      return sum + bias;
    };

    let passes = 0;
    let iter = 0;

    while (passes < SMO_MAX_PASSES && iter < SMO_MAX_ITER) {
      let numChanged = 0;
      iter++;

      for (let i = 0; i < n; i++) {
        const yi = pts[i].label;
        const Ei = predict(i) - yi;

        const violatesKKT =
          (yi * Ei < -SMO_TOLERANCE && alphas[i] < C) ||
          (yi * Ei > SMO_TOLERANCE && alphas[i] > 0);

        if (!violatesKKT) continue;

        // Pick j ≠ i at random
        let j = Math.floor(Math.random() * (n - 1));
        if (j >= i) j++;

        const yj = pts[j].label;
        const Ej = predict(j) - yj;

        const oldAi = alphas[i];
        const oldAj = alphas[j];

        // Compute clipping bounds L, H for α_j
        let L: number, H: number;
        if (yi === yj) {
          L = Math.max(0, oldAj + oldAi - C);
          H = Math.min(C, oldAj + oldAi);
        } else {
          L = Math.max(0, oldAj - oldAi);
          H = Math.min(C, C + oldAj - oldAi);
        }
        if (L >= H) continue;

        // Kernel values at the selected pair
        const kii = this._kernelFn(
          kernel,
          gamma,
          pts[i].sx,
          pts[i].sy,
          pts[i].sx,
          pts[i].sy
        );
        const kjj = this._kernelFn(
          kernel,
          gamma,
          pts[j].sx,
          pts[j].sy,
          pts[j].sx,
          pts[j].sy
        );
        const kij = this._kernelFn(
          kernel,
          gamma,
          pts[i].sx,
          pts[i].sy,
          pts[j].sx,
          pts[j].sy
        );

        // Second-order step
        const eta = 2 * kij - kii - kjj;
        if (eta >= 0) continue;

        let newAj = oldAj - (yj * (Ei - Ej)) / eta;
        newAj = Math.max(L, Math.min(H, newAj));

        if (Math.abs(newAj - oldAj) < SMO_ALPHA_TOL) continue;

        const newAi = oldAi + yi * yj * (oldAj - newAj);

        // Update bias using KKT conditions
        const b1 =
          bias -
          Ei -
          yi * (newAi - oldAi) * kii -
          yj * (newAj - oldAj) * kij;
        const b2 =
          bias -
          Ej -
          yi * (newAi - oldAi) * kij -
          yj * (newAj - oldAj) * kjj;

        if (newAi > 0 && newAi < C) {
          bias = b1;
        } else if (newAj > 0 && newAj < C) {
          bias = b2;
        } else {
          bias = (b1 + b2) / 2;
        }

        alphas[i] = newAi;
        alphas[j] = newAj;
        numChanged++;
      }

      if (numChanged === 0) {
        passes++;
      } else {
        passes = 0;
      }
    }

    return {alphas, bias};
  }

  private _emptyResult(C: number, kernel: KernelType): SVMResult {
    return {
      alphas: [],
      bias: 0,
      weights: null,
      gamma: RBF_GAMMA_DEFAULT,
      supportVectorIndices: [],
      marginWidth: null,
      kernel,
      C,
      scaler: {xMin: 0, xMax: 1, yMin: 0, yMax: 1},
    };
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  onRun() {
    this.isProcessingSignals = true;
    this.callbacks.setIsRunning(true);
    timeoutList.setTimeout(() => this.processSignals(), SIGNAL_CHECK_TIME);
  }

  onStop() {
    timeoutList.clearTimeouts();
    this.resetSignalQueue();
  }

  onClose() {
    // Inject DONE so the signal loop terminates cleanly
    this.signals.push({value: SVMSignalType.DONE});
  }

  reset() {
    timeoutList.clearTimeouts();
    this.resetSignalQueue();
    this.points = [];
    this.kernel = 'linear';
    this.C = C_DEFAULT;
    this.result = null;
    this.callbacks.onReset();
  }

  private resetSignalQueue() {
    this.signals = [];
    this.nextSignalIndex = 0;
    this.isProcessingSignals = false;
  }

  isRunning() {
    return this.isProcessingSignals;
  }

  waitUntilDone(): Promise<void> {
    if (!this.isRunning()) {
      return Promise.resolve();
    }
    if (this.donePromise) {
      return this.donePromise;
    }
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
