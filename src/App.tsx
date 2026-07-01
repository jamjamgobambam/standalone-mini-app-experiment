import React, {useCallback, useEffect, useRef, useState} from 'react';

import {ParsedSignal} from './engine/signalParser';
import {usePyodide} from './engine/usePyodide';
import {
  MINI_APP_REGISTRY,
  MiniAppDefinition,
  MiniAppPreviewHandle,
} from './miniAppRegistry';

import styles from './App.module.css';

// ── localStorage helpers ──────────────────────────────────────────────────────

const LS_SELECTED_KEY = 'miniapp:selected';
const studentCodeKey = (appKey: string) => `miniapp:${appKey}:student`;

function loadSelectedApp(): MiniAppDefinition {
  const saved = localStorage.getItem(LS_SELECTED_KEY);
  return (
    MINI_APP_REGISTRY.find(a => a.key === saved) ?? MINI_APP_REGISTRY[0]
  );
}

function loadStudentCode(app: MiniAppDefinition): string {
  return localStorage.getItem(studentCodeKey(app.key)) ?? app.defaultStudentCode;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function App() {
  const [activeApp, setActiveApp] = useState<MiniAppDefinition>(loadSelectedApp);
  const [studentCode, setStudentCode] = useState(() => loadStudentCode(activeApp));
  // Library code is NOT persisted — the file on disk is the source of truth.
  // Vite's ?raw hot-reload propagates disk edits to this panel automatically.
  const [libraryCode, setLibraryCode] = useState(activeApp.defaultLibraryCode);
  const [error, setError] = useState<string | null>(null);
  const [copyConfirm, setCopyConfirm] = useState(false);

  const previewRef = useRef<MiniAppPreviewHandle>(null);

  // Persist student code to localStorage as the user types (debounced).
  useEffect(() => {
    const id = window.setTimeout(() => {
      localStorage.setItem(studentCodeKey(activeApp.key), studentCode);
    }, 500);
    return () => window.clearTimeout(id);
  }, [activeApp.key, studentCode]);

  // ── Mini-app switching ──────────────────────────────────────────────────────

  const handleAppChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = MINI_APP_REGISTRY.find(a => a.key === e.target.value);
    if (!next || next.key === activeApp.key) return;
    localStorage.setItem(LS_SELECTED_KEY, next.key);
    setActiveApp(next);
    setStudentCode(loadStudentCode(next));
    setLibraryCode(next.defaultLibraryCode);
    setError(null);
  };

  // ── Signal pipeline ─────────────────────────────────────────────────────────

  const handleSignal = useCallback((signal: ParsedSignal) => {
    previewRef.current?.handleParsedSignal(signal);
  }, []);

  const handleStdout = useCallback((line: string) => {
    previewRef.current?.handleStdout?.(line);
  }, []);

  const handleDone = useCallback(() => {
    previewRef.current?.onClose();
  }, []);

  const handleError = useCallback((message: string) => {
    setError(message);
    previewRef.current?.onClose();
  }, []);

  const {runCode, isRunning, isPyodideLoading} = usePyodide({
    onSignal: handleSignal,
    onStdout: handleStdout,
    onDone: handleDone,
    onError: handleError,
  });

  // ── Run / reset ─────────────────────────────────────────────────────────────

  const handleRun = () => {
    setError(null);
    previewRef.current?.reset();
    previewRef.current?.onRun();
    runCode(libraryCode, studentCode, activeApp.key);
  };

  // ── Copy student code ───────────────────────────────────────────────────────

  const handleCopyStudentCode = () => {
    navigator.clipboard.writeText(studentCode).then(() => {
      setCopyConfirm(true);
      window.setTimeout(() => setCopyConfirm(false), 2000);
    });
  };

  // ── Reset student code ──────────────────────────────────────────────────────

  const handleResetStudentCode = () => {
    localStorage.removeItem(studentCodeKey(activeApp.key));
    setStudentCode(activeApp.defaultStudentCode);
  };

  const busy = isRunning || isPyodideLoading;
  const ActivePreview = activeApp.PreviewComponent;

  return (
    <div className={styles.app}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <span className={styles.title}>Mini-App Prototype Environment</span>
        <div className={styles.headerActions}>
          <label className={styles.dropdownLabel} htmlFor="miniapp-select">
            Mini-app:
          </label>
          <select
            id="miniapp-select"
            className={styles.dropdown}
            value={activeApp.key}
            onChange={handleAppChange}
          >
            {MINI_APP_REGISTRY.map(app => (
              <option key={app.key} value={app.key}>
                {app.label}
              </option>
            ))}
          </select>
          {isPyodideLoading && (
            <span className={styles.loadingLabel}>Loading Python…</span>
          )}
          <button
            className={styles.runButton}
            onClick={handleRun}
            disabled={busy}
          >
            {isRunning ? 'Running…' : '▶ Run'}
          </button>
        </div>
      </header>

      {/* ── Main: left editor + right preview ── */}
      <div className={styles.main}>
        <div className={styles.leftPanel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelLabel}>Student code</span>
            <div className={styles.panelActions}>
              <button
                className={styles.panelButton}
                onClick={handleCopyStudentCode}
                title="Copy student code to clipboard (use this as your level's starter code)"
              >
                {copyConfirm ? '✓ Copied' : '📋 Copy'}
              </button>
              <button
                className={styles.panelButton}
                onClick={handleResetStudentCode}
                title="Reset to default student code"
              >
                Reset
              </button>
            </div>
          </div>
          <textarea
            className={styles.editor}
            value={studentCode}
            onChange={e => setStudentCode(e.target.value)}
            spellCheck={false}
          />
        </div>

        <div className={styles.rightPanel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelLabel}>Mini-app preview</span>
          </div>
          <div className={styles.previewArea}>
            <ActivePreview key={activeApp.key} ref={previewRef} />
          </div>
        </div>
      </div>

      {/* ── Bottom: library code (disk is source of truth) ── */}
      <div className={styles.bottomPanel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelLabel}>
            Library code
          </span>
          <span className={styles.panelSublabel}>
            source of truth is{' '}
            <code>src/example-{activeApp.key}/python/library.py</code>
            {' '}— edits here are not saved
          </span>
        </div>
        <textarea
          className={styles.editor}
          value={libraryCode}
          onChange={e => setLibraryCode(e.target.value)}
          spellCheck={false}
        />
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className={styles.errorBanner}>
          <strong>Python error:</strong> {error}
          <button
            className={styles.errorDismiss}
            onClick={() => setError(null)}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
