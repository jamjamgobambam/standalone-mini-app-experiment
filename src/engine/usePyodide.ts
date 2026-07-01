import { useEffect, useRef, useState } from "react";
import { parseSignal, ParsedSignal } from "./signalParser";

interface UsePyodideOptions {
  /** Called for each stdout line that matches the [TYPE] KEY signal format. */
  onSignal: (signal: ParsedSignal) => void;
  /**
   * Called for every raw stdout line, whether or not it matched the signal
   * format. Mini-apps that prefer to parse human-readable print output
   * (e.g. "Day 3: 1,234 views") use this channel instead of structured
   * signals.
   */
  onStdout?: (line: string) => void;
  /** Called when student code finishes executing cleanly. */
  onDone: () => void;
  /** Called when Python raises an unhandled exception. */
  onError: (message: string) => void;
}

interface UsePyodideReturn {
  runCode: (
    libraryCode: string,
    studentCode: string,
    moduleKey: string,
  ) => void;
  isRunning: boolean;
  /** True while Pyodide is downloading/initializing on first use. */
  isPyodideLoading: boolean;
}

export function usePyodide({
  onSignal,
  onStdout,
  onDone,
  onError,
}: UsePyodideOptions): UsePyodideReturn {
  const workerRef = useRef<Worker | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isPyodideLoading, setIsPyodideLoading] = useState(false);

  // Keep callback refs stable so the worker handler never captures stale closures.
  const onSignalRef = useRef(onSignal);
  const onStdoutRef = useRef(onStdout);
  const onDoneRef = useRef(onDone);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onSignalRef.current = onSignal;
  }, [onSignal]);
  useEffect(() => {
    onStdoutRef.current = onStdout;
  }, [onStdout]);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    const worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });

    worker.onmessage = (e: MessageEvent) => {
      const { type, line, message } = e.data as {
        type: string;
        line?: string;
        message?: string;
      };

      switch (type) {
        case "loading":
          setIsPyodideLoading(true);
          break;
        case "ready":
          setIsPyodideLoading(false);
          break;
        case "stdout": {
          if (line) {
            onStdoutRef.current?.(line);
            const signal = parseSignal(line);
            if (signal) onSignalRef.current(signal);
          }
          break;
        }
        case "done":
          setIsRunning(false);
          onDoneRef.current();
          break;
        case "error":
          setIsRunning(false);
          onErrorRef.current(message ?? "Unknown error");
          break;
      }
    };

    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  const runCode = (
    libraryCode: string,
    studentCode: string,
    moduleKey: string,
  ) => {
    if (!workerRef.current) return;
    setIsRunning(true);
    workerRef.current.postMessage({
      type: "run",
      libraryCode,
      studentCode,
      moduleKey,
    });
  };

  return { runCode, isRunning, isPyodideLoading };
}
