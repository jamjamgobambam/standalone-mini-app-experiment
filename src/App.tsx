import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {ParsedSignal} from './engine/signalParser';
import {usePyodide} from './engine/usePyodide';
import {MiniAppPreviewHandle} from './miniAppRegistry';
import {describeFiles, FileLanguage, getAppFiles} from './miniAppFiles';
import {
  DRAFT_KEY,
  listMiniApps,
  MiniApp,
  setLabel,
  slugify,
  STUB_FILES,
  STUB_STUDENT_CODE,
} from './miniApps';
import AiAssistant from './AiAssistant';
import CodeEditor from './CodeEditor';
import DraftPreview from './DraftPreview';

import logoUrl from './codeai_logo.svg';
import styles from './App.module.css';

// ── localStorage helpers ──────────────────────────────────────────────────────

const LS_SELECTED_KEY = 'miniapp:selected';
const studentCodeKey = (appKey: string) => `miniapp:${appKey}:student`;

// Sentinel tab id for the (virtual) student-code file.
const STUDENT_TAB = '__student__';

const FILE_ICONS: Record<FileLanguage, string> = {
  py: '🐍',
  ts: '📘',
  tsx: '⚛️',
  css: '🎨',
  text: '📄',
};

// The draft mini-app descriptor (before it has been saved to disk).
const DRAFT_APP: MiniApp = {
  key: DRAFT_KEY,
  label: 'Untitled',
  defaultStudentCode: STUB_STUDENT_CODE,
  PreviewComponent: DraftPreview,
  source: 'draft',
};

function loadStudentCode(app: MiniApp): string {
  return localStorage.getItem(studentCodeKey(app.key)) ?? app.defaultStudentCode;
}

interface AuditFinding {
  impact: string; // critical | serious | moderate | minor
  help: string;
  where: string;
}

// Static accessibility review of the whole mini-app source (all files), not
// just whatever happens to be rendered. Heuristic pattern checks — a first
// pass that catches the common issues.
function staticCodeAudit(files: Record<string, string>): AuditFinding[] {
  const findings: AuditFinding[] = [];
  let narrates = false;
  let ariaLive = false;

  for (const [path, code] of Object.entries(files)) {
    if (/\bnarrate\s*\(/.test(code)) narrates = true;
    if (/aria-live/.test(code)) ariaLive = true;

    if (!path.endsWith('.tsx') && !path.endsWith('.ts')) continue;

    for (const tag of code.match(/<img\b[^>]*>/g) ?? []) {
      if (!/\balt\s*=/.test(tag)) {
        findings.push({impact: 'serious', help: '<img> without alt text', where: path});
      }
    }
    for (const m of code.match(/<(div|span|li)\b[^>]*onClick/g) ?? []) {
      const el = /<(\w+)/.exec(m)?.[1] ?? 'element';
      findings.push({
        impact: 'serious',
        help: `Click handler on <${el}> — use a <button> (or add role, tabIndex, and a key handler) so keyboard users can activate it`,
        where: path,
      });
    }
    for (const tag of code.match(/<a\b[^>]*>/g) ?? []) {
      if (!/\bhref\s*=/.test(tag)) {
        findings.push({impact: 'moderate', help: '<a> without href is not keyboard-focusable — use a <button>', where: path});
      }
    }
    for (const tag of code.match(/<svg\b[^>]*>/g) ?? []) {
      const labelled = /\brole\s*=/.test(tag) || /aria-label/.test(tag) || /aria-hidden/.test(tag);
      if (!labelled) {
        findings.push({
          impact: 'moderate',
          help: '<svg> without role/aria-label (or aria-hidden) — screen readers may skip or mis-announce it',
          where: path,
        });
      }
    }
    if (/tabindex\s*=\s*\{?["']?[1-9]/i.test(code)) {
      findings.push({impact: 'moderate', help: 'Positive tabIndex disrupts the natural focus order', where: path});
    }
  }

  if (!narrates && !ariaLive) {
    findings.push({
      impact: 'serious',
      help: 'No screen-reader narration: the mini-app never calls narrate() and has no aria-live region, so its output is invisible to screen readers',
      where: 'library.py / visualization',
    });
  }

  return findings;
}

// Build the editable contents map for an app, seeding the "already on disk"
// reference so freshly loaded files aren't seen as dirty.
function loadFileContents(
  key: string,
  savedRef: React.MutableRefObject<Record<string, string>>,
): Record<string, string> {
  if (key === DRAFT_KEY) return {...STUB_FILES};
  const contents: Record<string, string> = {};
  for (const f of getAppFiles(key)) {
    contents[f.path] = f.content;
    savedRef.current[`${key}::${f.path}`] = f.content;
  }
  return contents;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function App() {
  const [apps] = useState<MiniApp[]>(() => listMiniApps());
  const [draft, setDraft] = useState<MiniApp | null>(null);
  const [activeKey, setActiveKey] = useState<string>(() => {
    const saved = localStorage.getItem(LS_SELECTED_KEY);
    return apps.find(a => a.key === saved)?.key ?? apps[0].key;
  });

  const activeApp: MiniApp =
    (activeKey === DRAFT_KEY ? draft : apps.find(a => a.key === activeKey)) ??
    apps[0];
  const isDraft = activeApp.key === DRAFT_KEY;

  const [studentCode, setStudentCode] = useState(() => loadStudentCode(activeApp));

  // Editable contents of every on-disk source file for the active mini-app,
  // keyed by path relative to the mini-app folder. Edits are written back to
  // the real files (dev-only), so the workspace is a true editor of the source.
  const savedRef = useRef<Record<string, string>>({});
  const [fileContents, setFileContents] = useState<Record<string, string>>(() =>
    loadFileContents(activeApp.key, savedRef),
  );

  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>(STUDENT_TAB);
  const [fileSave, setFileSave] =
    useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Naming modal (shown on the first Save of a new mini-app).
  const [naming, setNaming] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);

  // Resizable layout (px). Sidebar holds the 400×400 preview, so it can't go
  // narrower than 400.
  const [railWidth, setRailWidth] = useState(400);
  const [a11yHeight, setA11yHeight] = useState(380);

  // Accessibility panel state.
  const [narration, setNarration] = useState<string[]>([]);
  const [liveMessage, setLiveMessage] = useState('');
  const [auditResult, setAuditResult] = useState<AuditFinding[] | null>(null);
  const [auditing, setAuditing] = useState(false);
  const [focusables, setFocusables] = useState<{tag: string; name: string}[]>([]);
  const [showFocus, setShowFocus] = useState(false);

  const previewRef = useRef<MiniAppPreviewHandle>(null);
  const previewStageRef = useRef<HTMLDivElement>(null);
  const focusSigRef = useRef('');

  const fileList = useMemo(
    () => describeFiles(Object.keys(fileContents)),
    [fileContents],
  );
  const libraryPath = useMemo(
    () => fileList.find(f => f.path.endsWith('library.py'))?.path,
    [fileList],
  );

  // Persist student code to localStorage as the user types (debounced).
  useEffect(() => {
    const id = window.setTimeout(() => {
      localStorage.setItem(studentCodeKey(activeApp.key), studentCode);
    }, 500);
    return () => window.clearTimeout(id);
  }, [activeApp.key, studentCode]);

  // Persist edited files back to their real paths on disk (debounced).
  // Dev-only, and skipped for an unsaved draft (its folder doesn't exist yet).
  useEffect(() => {
    if (!import.meta.env.DEV || isDraft) return;
    const dirty = Object.entries(fileContents).filter(
      ([p, c]) => c !== savedRef.current[`${activeApp.key}::${p}`],
    );
    if (dirty.length === 0) return;
    setFileSave('saving');
    const id = window.setTimeout(async () => {
      try {
        for (const [p, c] of dirty) {
          const res = await fetch('/__save_file', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({key: activeApp.key, path: p, code: c}),
          });
          if (!res.ok) throw new Error(await res.text());
          savedRef.current[`${activeApp.key}::${p}`] = c;
        }
        setFileSave('saved');
      } catch {
        setFileSave('error');
      }
    }, 600);
    return () => window.clearTimeout(id);
  }, [activeApp.key, fileContents, isDraft]);

  // Keep the focusable-controls list in sync with the (live) preview DOM, so
  // the "Check focusable elements" button can be disabled when there are none.
  useEffect(() => {
    const root = previewStageRef.current;
    if (!root) return;
    const recompute = () => {
      const els = root.querySelectorAll<HTMLElement>(
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      const list = Array.from(els).map(el => ({
        tag: el.tagName.toLowerCase(),
        name:
          (el.getAttribute('aria-label') || el.textContent || '').trim() ||
          '(no accessible name)',
      }));
      const sig = list.map(f => `${f.tag}:${f.name}`).join('|');
      if (sig === focusSigRef.current) return; // ignore animation churn
      focusSigRef.current = sig;
      setFocusables(list);
    };
    recompute();
    const obs = new MutationObserver(recompute);
    obs.observe(root, {childList: true, subtree: true});
    return () => obs.disconnect();
  }, [activeApp.key]);

  // ── Mini-app selection / creation ─────────────────────────────────────────────

  const selectApp = (key: string) => {
    if (key === activeApp.key) return;
    const next =
      key === DRAFT_KEY ? draft : apps.find(a => a.key === key);
    if (!next) return;
    if (key !== DRAFT_KEY) localStorage.setItem(LS_SELECTED_KEY, key);
    setActiveKey(key);
    setStudentCode(loadStudentCode(next));
    setFileContents(loadFileContents(key, savedRef));
    setActiveTab(STUDENT_TAB);
    setFileSave('idle');
    setError(null);
    setAuditResult(null);
    setShowFocus(false);
  };

  const handleNew = () => {
    setDraft(DRAFT_APP);
    setActiveKey(DRAFT_KEY);
    setStudentCode(STUB_STUDENT_CODE);
    setFileContents({...STUB_FILES});
    setActiveTab(STUDENT_TAB);
    setFileSave('idle');
    setError(null);
    setAuditResult(null);
    setShowFocus(false);
  };

  // ── Signal pipeline ─────────────────────────────────────────────────────────

  const handleSignal = useCallback((signal: ParsedSignal) => {
    // Accessibility narration is a universal channel: `[A11Y] SAY {"text": …}`.
    // Capture it for the panel + live region instead of forwarding to the app.
    if (signal.type === 'A11Y') {
      const text =
        typeof signal.detail?.text === 'string'
          ? signal.detail.text
          : signal.key;
      setNarration(prev => [...prev, text]);
      setLiveMessage(text);
      return;
    }
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

  // ── Run ────────────────────────────────────────────────────────────────────

  const handleRun = () => {
    setError(null);
    setNarration([]);
    setLiveMessage('');
    previewRef.current?.reset();
    previewRef.current?.onRun();
    const libraryCode = libraryPath ? fileContents[libraryPath] ?? '' : '';
    runCode(libraryCode, studentCode, activeApp.key);
  };

  // ── Accessibility checks ──────────────────────────────────────────────────────

  const runAudit = async () => {
    setAuditing(true);
    // Review the complete mini-app source, then also scan the rendered preview.
    const findings = staticCodeAudit(fileContents);
    try {
      if (previewStageRef.current) {
        const axe = (await import('axe-core')).default;
        const results = await axe.run(previewStageRef.current);
        for (const v of results.violations) {
          findings.push({
            impact: v.impact ?? 'minor',
            help: `${v.help} (${v.nodes.length} in rendered preview)`,
            where: 'rendered preview',
          });
        }
      }
    } catch {
      /* axe unavailable — keep the static findings */
    }
    setAuditResult(findings);
    setAuditing(false);
  };

  // ── Save ─────────────────────────────────────────────────────────────────────

  const flushFiles = async () => {
    setFileSave('saving');
    try {
      for (const [p, c] of Object.entries(fileContents)) {
        const res = await fetch('/__save_file', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({key: activeApp.key, path: p, code: c}),
        });
        if (!res.ok) throw new Error(await res.text());
        savedRef.current[`${activeApp.key}::${p}`] = c;
      }
      setFileSave('saved');
    } catch {
      setFileSave('error');
    }
  };

  const handleSave = () => {
    if (isDraft) {
      setNameInput('');
      setNameError(null);
      setNaming(true);
      return;
    }
    void flushFiles();
  };

  const confirmCreate = async () => {
    const name = nameInput.trim();
    if (!name) {
      setNameError('Please enter a name.');
      return;
    }
    const key = slugify(name);
    if (!key) {
      setNameError('Name must contain letters or numbers.');
      return;
    }
    if (apps.some(a => a.key === key)) {
      setNameError(`A mini-app named "${key}" already exists.`);
      return;
    }

    try {
      // Write every stub file to the new mini-app's folder on disk.
      for (const [p, c] of Object.entries(fileContents)) {
        const res = await fetch('/__save_file', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({key, path: p, code: c}),
        });
        if (!res.ok) throw new Error(await res.text());
      }
    } catch (err) {
      setNameError(
        `Save failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return;
    }

    // Point the student code's import at the new module, and persist state so
    // it survives the reload below.
    const student = studentCode.replace(
      /from\s+\w+\s+import/,
      `from ${key} import`,
    );
    localStorage.setItem(studentCodeKey(key), student);
    setLabel(key, name);
    localStorage.setItem(LS_SELECTED_KEY, key);

    // Reload so Vite discovers the new folder and its (real) preview component.
    window.location.reload();
  };

  // ── Editing the active file ───────────────────────────────────────────────────

  const setActiveFileContent = (value: string) =>
    setFileContents(prev => ({...prev, [activeTab]: value}));

  // ── Resizable dividers ────────────────────────────────────────────────────────

  const startDrag =
    (
      axis: 'x' | 'y',
      getStart: () => number,
      apply: (value: number) => void,
    ) =>
    (e: React.MouseEvent) => {
      e.preventDefault();
      const origin = axis === 'x' ? e.clientX : e.clientY;
      const start = getStart();
      const onMove = (ev: MouseEvent) => {
        const now = axis === 'x' ? ev.clientX : ev.clientY;
        apply(start + (now - origin));
      };
      const stop = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', stop);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', stop);
      document.body.style.cursor = axis === 'x' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    };

  const startRailResize = startDrag('x', () => railWidth, next =>
    setRailWidth(Math.min(640, Math.max(400, next))),
  );
  // Accessibility is the bottom of the middle column: it grows as the divider
  // moves up, so track the negated height.
  const startA11yResize = startDrag('y', () => -a11yHeight, next =>
    setA11yHeight(Math.min(520, Math.max(140, -next))),
  );

  const busy = isRunning || isPyodideLoading;
  const ActivePreview = activeApp.PreviewComponent;
  const activeLanguage: FileLanguage =
    fileList.find(f => f.path === activeTab)?.language ?? 'py';
  const activeFileLabel =
    activeTab === STUDENT_TAB
      ? 'student_code.py'
      : fileList.find(f => f.path === activeTab)?.label ?? activeTab;

  return (
    <div className={styles.app}>
      {/* ── Header (teal chrome) ── */}
      <header className={styles.header}>
        <div className={styles.brand}>
          <img className={styles.logo} src={logoUrl} alt="CodeAI" />
          <span className={styles.brandDivider} />
          <div className={styles.projectMeta}>
            <span className={styles.projectTitle}>Mini-App Studio</span>
          </div>
        </div>
        <div className={styles.headerActions}>
          {isPyodideLoading && (
            <span className={styles.loadingLabel}>Loading Python…</span>
          )}
        </div>
      </header>

      {/* ── Body: sidebar (project controls + AI Assistant) + workspace ── */}
      <div
        className={styles.body}
        style={{gridTemplateColumns: `${railWidth}px 6px 1fr`}}
      >
        <div className={styles.sidebar}>
          <div className={styles.projectBar}>
            <select
              className={styles.dropdown}
              value={activeApp.key}
              onChange={e => selectApp(e.target.value)}
            >
              {apps.map(app => (
                <option key={app.key} value={app.key}>
                  {app.label}
                </option>
              ))}
              {draft && (
                <option value={DRAFT_KEY}>{draft.label} (unsaved)</option>
              )}
            </select>
            <div className={styles.projectButtons}>
              <button className={styles.newButton} onClick={handleNew}>
                + New
              </button>
              <button
                className={styles.saveButton}
                onClick={handleSave}
                title={
                  isDraft
                    ? 'Name and save this new mini-app'
                    : 'Save all files to disk'
                }
              >
                {fileSave === 'saving'
                  ? 'Saving…'
                  : fileSave === 'saved'
                    ? 'Saved ✓'
                    : 'Save'}
              </button>
            </div>
          </div>

          <div className={styles.assistantWrap}>
            <AiAssistant />
          </div>

          {/* Preview — fixed 400×400, beneath the AI Assistant */}
          <div className={styles.previewPanel}>
            <div className={styles.panelHeader}>
              <span className={`${styles.tab} ${styles.tabActive}`}>
                <span className={styles.tabIcon}>▦</span> Preview
              </span>
            </div>
            <div className={styles.previewArea}>
              <div className={styles.previewStage} ref={previewStageRef}>
                <Suspense fallback={<div className={styles.previewLoading}>Loading preview…</div>}>
                  <ActivePreview key={activeApp.key} ref={previewRef} />
                </Suspense>
              </div>
            </div>
          </div>
        </div>

        <div
          className={styles.vDivider}
          onMouseDown={startRailResize}
          title="Drag to resize"
        />

        <div className={styles.workspace}>
          {/* Workspace toolbar with Run */}
          <div className={styles.workspaceBar}>
            <button
              className={styles.runButton}
              onClick={handleRun}
              disabled={busy}
            >
              <span className={styles.runIcon}>▶</span>
              {isRunning ? 'Running…' : 'Run'}
            </button>
          </div>

          {/* Middle: files + editor on top, accessibility below */}
          <div
            className={styles.middle}
            style={{gridTemplateRows: `1fr 6px ${a11yHeight}px`}}
          >
            <div className={styles.editorRow}>
              {/* File browser */}
              <div className={styles.fileBrowser}>
                <div className={styles.fileBrowserHeader}>Files</div>
                <div className={styles.fileList}>
                  <button
                    className={`${styles.fileItem} ${
                      activeTab === STUDENT_TAB ? styles.fileItemActive : ''
                    }`}
                    onClick={() => setActiveTab(STUDENT_TAB)}
                  >
                    <span className={styles.fileIcon}>🐍</span>
                    student_code.py
                  </button>
                  {fileList.map(f => (
                    <button
                      key={f.path}
                      className={`${styles.fileItem} ${
                        activeTab === f.path ? styles.fileItemActive : ''
                      }`}
                      onClick={() => setActiveTab(f.path)}
                      title={f.path}
                    >
                      <span className={styles.fileIcon}>
                        {FILE_ICONS[f.language]}
                      </span>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Editor */}
              <div className={styles.editorPanel}>
                <div className={styles.panelHeader}>
                  <span className={`${styles.tab} ${styles.tabActive}`}>
                    <span className={styles.tabIcon}>
                      {activeTab === STUDENT_TAB
                        ? '🐍'
                        : FILE_ICONS[activeLanguage]}
                    </span>{' '}
                    {activeFileLabel}
                  </span>
                  {activeTab !== STUDENT_TAB && fileSave !== 'idle' && (
                    <span className={styles.panelSublabel}>
                      {fileSave === 'saving' && (
                        <span className={styles.saveStatus}>Saving…</span>
                      )}
                      {fileSave === 'saved' && (
                        <span className={styles.saveStatusOk}>Saved ✓</span>
                      )}
                      {fileSave === 'error' && (
                        <span className={styles.saveStatusErr}>Save failed</span>
                      )}
                    </span>
                  )}
                </div>

                {activeTab === STUDENT_TAB ? (
                  <CodeEditor
                    value={studentCode}
                    onChange={setStudentCode}
                    language="py"
                  />
                ) : (
                  <CodeEditor
                    value={fileContents[activeTab] ?? ''}
                    onChange={setActiveFileContent}
                    language={activeLanguage}
                  />
                )}
              </div>
            </div>

            <div
              className={styles.hDivider}
              onMouseDown={startA11yResize}
              title="Drag to resize"
            />

            {/* Accessibility panel (sections laid out as columns) */}
            <div className={styles.a11yPanel}>
            <div className={styles.a11yHeader}>Accessibility</div>
            <div className={styles.a11yBody}>
              {/* Screen reader narration */}
              <section className={styles.a11ySection}>
                <h3 className={styles.a11ySectionTitle}>
                  Screen reader narration
                </h3>
                <p className={styles.a11yNote}>
                  What a screen reader announces as the mini-app runs. Emit from
                  Python with <code>narrate("…")</code>.
                </p>
                <div className={styles.narrationLog}>
                  {narration.length === 0 ? (
                    <p className={styles.a11yEmpty}>
                      No narration yet. Run a mini-app that calls{' '}
                      <code>narrate()</code>.
                    </p>
                  ) : (
                    narration.map((t, i) => (
                      <div key={i} className={styles.narrationItem}>
                        {t}
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Automated audit */}
              <section className={styles.a11ySection}>
                <h3 className={styles.a11ySectionTitle}>Automated audit</h3>
                <p className={styles.a11yNote}>
                  Reviews the mini-app's complete source (all files) for common
                  issues — plus an axe-core scan of the rendered preview.
                </p>
                <button
                  className={styles.a11yButton}
                  onClick={runAudit}
                  disabled={auditing}
                >
                  {auditing ? 'Auditing…' : 'Run accessibility audit'}
                </button>
                {auditResult !== null &&
                  (auditResult.length === 0 ? (
                    <p className={styles.a11yPass}>
                      ✓ No issues found in the code or rendered preview.
                    </p>
                  ) : (
                    <ul className={styles.a11yList}>
                      {auditResult.map((f, i) => (
                        <li key={i} className={styles.violation}>
                          <span
                            className={styles.violationImpact}
                            data-impact={f.impact}
                          >
                            {f.impact}
                          </span>{' '}
                          {f.help}{' '}
                          <span className={styles.violationCount}>
                            — {f.where}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ))}
              </section>

              {/* Keyboard focus */}
              <section className={styles.a11ySection}>
                <h3 className={styles.a11ySectionTitle}>Keyboard focus order</h3>
                <p className={styles.a11yNote}>
                  Interactive controls a keyboard user can reach, in tab order,
                  with their accessible names.
                </p>
                <button
                  className={styles.a11yButton}
                  onClick={() => setShowFocus(true)}
                  disabled={focusables.length === 0}
                >
                  Check focusable elements
                </button>
                {focusables.length === 0 ? (
                  <p className={styles.a11yEmpty}>
                    No focusable controls in the preview.
                  </p>
                ) : (
                  showFocus && (
                    <ol className={styles.a11yList}>
                      {focusables.map((f, i) => (
                        <li key={i}>
                          <code>{f.tag}</code> — {f.name}
                        </li>
                      ))}
                    </ol>
                  )
                )}
              </section>
            </div>

            {/* Live region so a real screen reader narrates the running preview */}
            <div aria-live="polite" className={styles.visuallyHidden}>
              {liveMessage}
            </div>
          </div>
          </div>
        </div>
      </div>

      {/* ── Naming modal (first Save of a new mini-app) ── */}
      {naming && (
        <div className={styles.modalOverlay} onClick={() => setNaming(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Name your mini-app</h2>
            <p className={styles.modalHint}>
              This becomes the folder and the Python module students import.
            </p>
            <input
              className={styles.modalInput}
              autoFocus
              value={nameInput}
              placeholder="e.g. Bouncing Ball"
              onChange={e => {
                setNameInput(e.target.value);
                setNameError(null);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') void confirmCreate();
                if (e.key === 'Escape') setNaming(false);
              }}
            />
            {nameInput.trim() && (
              <p className={styles.modalSlug}>
                folder: <code>src/{slugify(nameInput)}/</code>
              </p>
            )}
            {nameError && <p className={styles.modalError}>{nameError}</p>}
            <div className={styles.modalActions}>
              <button
                className={styles.panelButton}
                onClick={() => setNaming(false)}
              >
                Cancel
              </button>
              <button className={styles.saveButton} onClick={() => void confirmCreate()}>
                Create &amp; Save
              </button>
            </div>
          </div>
        </div>
      )}

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
