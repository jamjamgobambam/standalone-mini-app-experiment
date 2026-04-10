/// <reference lib="webworker" />

/**
 * Pyodide Web Worker
 *
 * Loads Python (via Pyodide from CDN), registers library code as a Python
 * module, then runs student code. Each stdout line is posted back to the main
 * thread for signal routing.
 *
 * Messages IN  (from main thread):
 *   { type: 'run', libraryCode: string, studentCode: string }
 *
 * Messages OUT (to main thread):
 *   { type: 'loading' }                — Pyodide is initialising (first run)
 *   { type: 'ready' }                  — Pyodide finished loading
 *   { type: 'stdout', line: string }   — one line of Python stdout output
 *   { type: 'done' }                   — code finished cleanly
 *   { type: 'error', message: string } — Python raised an exception
 */

// Pyodide is loaded from CDN as a global — no npm dependency needed.
const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pyodide: any = null;

async function getPyodide() {
  if (pyodide) return pyodide;

  self.postMessage({type: 'loading'});

  const {loadPyodide} = await import(
    /* @vite-ignore */
    `${PYODIDE_CDN}pyodide.mjs`
  );

  pyodide = await loadPyodide({indexURL: PYODIDE_CDN});

  self.postMessage({type: 'ready'});
  return pyodide;
}

self.onmessage = async (e: MessageEvent) => {
  const {type, libraryCode, studentCode, moduleKey} = e.data as {
    type: string;
    libraryCode: string;
    studentCode: string;
    moduleKey: string;
  };

  if (type !== 'run') return;

  try {
    const py = await getPyodide();

    // Redirect Python stdout — each line is posted as a signal candidate.
    py.setStdout({
      batched: (line: string) => {
        self.postMessage({type: 'stdout', line});
      },
    });

    // Register library code as a real Python module so student code can do
    // `from {moduleKey} import {ClassName}` exactly as it would in production.
    py.globals.set('_library_code', libraryCode);
    py.globals.set('_module_key', moduleKey);
    await py.runPythonAsync(`
import types, sys
_mod = types.ModuleType(_module_key)
exec(_library_code, _mod.__dict__)
sys.modules[_module_key] = _mod
del _library_code, _module_key
`);

    // Run the student's code in the same namespace.
    await py.runPythonAsync(studentCode);

    self.postMessage({type: 'done'});
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage({type: 'error', message});
  }
};
