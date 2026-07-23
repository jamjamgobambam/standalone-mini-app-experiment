import React from 'react';

import {
  MINI_APP_REGISTRY,
  MiniAppPreviewHandle,
} from './miniAppRegistry';

/**
 * Mini-app catalogue.
 *
 * Mini-apps come from two sources:
 *  - built-ins registered in miniAppRegistry.ts (with hand-written labels)
 *  - user-created folders discovered on disk (any src/<key>/ that contains a
 *    *Preview.tsx). Their preview components are code-split and loaded lazily.
 *
 * This lets a curriculum developer create a brand-new mini-app, Save it (which
 * writes its files to disk), and have it appear here after a reload — with a
 * real, hot-reloading preview — without editing any registry code by hand.
 */

// Sentinel key for an unsaved draft mini-app.
export const DRAFT_KEY = '__draft__';

const LS_LABELS = 'miniapp:labels';

// Lazy preview loaders for every mini-app folder, keyed by their module path.
const PREVIEW_GLOB = import.meta.glob('./*/*Preview.tsx');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PreviewComponent = any;

export interface MiniApp {
  key: string;
  label: string;
  defaultStudentCode: string;
  PreviewComponent: PreviewComponent;
  source: 'builtin' | 'user' | 'draft';
}

function loaderForKey(key: string): (() => Promise<unknown>) | undefined {
  const prefix = `./${key}/`;
  const entry = Object.entries(PREVIEW_GLOB).find(([p]) => p.startsWith(prefix));
  return entry?.[1] as (() => Promise<unknown>) | undefined;
}

function readLabels(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(LS_LABELS) || '{}');
  } catch {
    return {};
  }
}

export function setLabel(key: string, label: string): void {
  const map = readLabels();
  map[key] = label;
  localStorage.setItem(LS_LABELS, JSON.stringify(map));
}

/** Built-in mini-apps plus any user-created folders discovered on disk. */
export function listMiniApps(): MiniApp[] {
  const builtinKeys = new Set(MINI_APP_REGISTRY.map(a => a.key));
  const builtins: MiniApp[] = MINI_APP_REGISTRY.map(a => ({
    key: a.key,
    label: a.label,
    defaultStudentCode: a.defaultStudentCode,
    PreviewComponent: a.PreviewComponent,
    source: 'builtin',
  }));

  const labels = readLabels();
  const discovered = new Set<string>();
  for (const p of Object.keys(PREVIEW_GLOB)) {
    const m = p.match(/^\.\/([^/]+)\//);
    if (m && !builtinKeys.has(m[1])) discovered.add(m[1]);
  }

  const users: MiniApp[] = [];
  for (const key of discovered) {
    const loader = loaderForKey(key);
    if (!loader) continue;
    users.push({
      key,
      label: labels[key] ?? key,
      defaultStudentCode: '',
      PreviewComponent: React.lazy(
        loader as () => Promise<{default: React.ComponentType}>,
      ),
      source: 'user',
    });
  }

  return [...builtins, ...users];
}

/** Slugify a display name into a Python-safe module/folder key. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^([0-9])/, '_$1');
}

// ── Blank stub files for a new mini-app ─────────────────────────────────────
// Internal names are intentionally generic ("MiniApp", signal prefix "APP") so
// they don't depend on the eventual mini-app name — the folder name becomes the
// Python module a student imports, and nothing here needs to be rewritten.

export const STUB_STUDENT_CODE = `\
# New mini-app (stub)
# Save this mini-app, then press Run to send a READY signal to the visualization.
from mini_app import run

run()
`;

export const STUB_FILES: Record<string, string> = {
  'python/library.py': `\
"""New mini-app library (stub).

Prints signals like "[APP] READY {..}" that the visualization listens for.
Build your student-facing API here — each method should emit a signal.
"""
import json


def _signal(kind, detail=None):
    print(f"[APP] {kind} {json.dumps(detail or {})}")


def narrate(text):
    """Announce text to screen-reader users.

    Shows up in the Accessibility panel and is read aloud by real screen
    readers. Call this whenever something meaningful changes so the mini-app
    is usable without sight.
    """
    print(f'[A11Y] SAY {json.dumps({"text": text})}')


def run():
    # TODO: replace this with your mini-app's API. For now it just tells the
    # visualization that the program is ready...
    _signal("READY", {"message": "Hello from your new mini-app!"})
    # ...and narrates that for screen-reader users.
    narrate("The mini-app is ready.")
`,

  'constants.ts': `\
// Signal type names emitted by the Python library and understood by the controller.
export const SIGNAL_PREFIX = 'APP';

export enum AppSignalType {
  READY = 'READY',
}
`,

  'types.ts': `\
import {AppSignalType} from './constants';

export interface AppSignal {
  value: AppSignalType;
  detail?: Record<string, unknown>;
}

export interface AppState {
  ready: boolean;
  message: string;
}
`,

  'MiniApp.ts': `\
import {AppSignalType} from './constants';
import {AppSignal} from './types';

interface Callbacks {
  onReady: (message: string) => void;
  onReset: () => void;
}

// Controller: receives parsed Python signals and drives the visualization state.
export default class MiniApp {
  constructor(private cb: Callbacks) {}

  handleSignal(signal: AppSignal) {
    if (signal.value === AppSignalType.READY) {
      this.cb.onReady(String(signal.detail?.message ?? ''));
    }
  }

  reset() {
    this.cb.onReset();
  }

  onRun() {}
  onClose() {}
}
`,

  'MiniAppVisualization.tsx': `\
import React from 'react';

import {AppState} from './types';
import styles from './styles.module.css';

// The React component students see. Render your mini-app's output here.
export default function MiniAppVisualization({state}: {state: AppState}) {
  return (
    <div className={styles.wrap}>
      {state.ready ? (
        <p className={styles.message}>{state.message}</p>
      ) : (
        <p className={styles.hint}>Run your code to start the mini-app.</p>
      )}
    </div>
  );
}
`,

  'MiniAppPreview.tsx': `\
import React, {useImperativeHandle, useMemo, useState} from 'react';

import {ParsedSignal} from '../engine/signalParser';
import {SIGNAL_PREFIX, AppSignalType} from './constants';
import MiniApp from './MiniApp';
import MiniAppVisualization from './MiniAppVisualization';
import {AppSignal, AppState} from './types';

export interface MiniAppPreviewHandle {
  handleParsedSignal: (signal: ParsedSignal) => void;
  reset: () => void;
  onRun: () => void;
  onClose: () => void;
}

const defaultState: AppState = {ready: false, message: ''};

// Wires the controller into the prototyping environment.
const MiniAppPreview = React.forwardRef<MiniAppPreviewHandle>((_props, ref) => {
  const [state, setState] = useState<AppState>(defaultState);

  const controller = useMemo(
    () =>
      new MiniApp({
        onReady: (message: string) => setState({ready: true, message}),
        onReset: () => setState(defaultState),
      }),
    [],
  );

  useImperativeHandle(ref, () => ({
    handleParsedSignal(signal: ParsedSignal) {
      if (signal.type !== SIGNAL_PREFIX) return;
      controller.handleSignal({
        value: signal.key as AppSignalType,
        detail: (signal.detail ?? undefined) as AppSignal['detail'],
      });
    },
    reset: () => controller.reset(),
    onRun: () => controller.onRun(),
    onClose: () => controller.onClose(),
  }));

  return <MiniAppVisualization state={state} />;
});

MiniAppPreview.displayName = 'MiniAppPreview';

export default MiniAppPreview;
`,

  'styles.module.css': `\
.wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 24px;
  text-align: center;
}

.message {
  font-size: 20px;
  font-weight: 600;
  color: #4c42cf;
}

.hint {
  color: #888;
  font-style: italic;
}
`,
};

export type {MiniAppPreviewHandle};
