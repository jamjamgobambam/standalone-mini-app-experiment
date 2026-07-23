/**
 * Mini-app file discovery.
 *
 * A mini-app is more than its Python library — it also includes the TypeScript
 * visualization files (types, constants, controller, React component, styles).
 * A curriculum developer generates/edits all of these, so they should all be
 * editable in the workspace.
 *
 * This module discovers every source file under each mini-app's folder via
 * Vite's import.meta.glob, so newly added files show up as tabs automatically.
 */

export type FileLanguage = 'py' | 'ts' | 'tsx' | 'css' | 'text';

export interface AppFile {
  /** Path relative to the mini-app folder, e.g. "python/library.py", "types.ts" */
  path: string;
  /** Basename shown on the tab, e.g. "library.py" */
  label: string;
  /** Language for syntax highlighting */
  language: FileLanguage;
  /** File contents as loaded from disk */
  content: string;
}

// Raw contents of every file in every mini-app folder. Eager so the contents
// are available synchronously. A broad glob (rather than a brace-extension
// pattern, which misses `.module.css`) is filtered by extension below.
// `engine/` and top-level files are filtered out per-app (they aren't part of
// any single mini-app).
const RAW = import.meta.glob('./*/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function languageFor(path: string): FileLanguage | null {
  if (path.endsWith('.py')) return 'py';
  if (path.endsWith('.tsx')) return 'tsx';
  if (path.endsWith('.ts')) return 'ts';
  if (path.endsWith('.css')) return 'css';
  return null;
}

// Sort so the files a developer touches most come first, in the same order the
// README documents them: library → types → constants → controller →
// visualization → preview → styles.
function rank(path: string): number {
  if (path.endsWith('library.py')) return 0;
  if (path.endsWith('types.ts')) return 1;
  if (path.endsWith('constants.ts')) return 2;
  if (/Visualization\.tsx$/.test(path)) return 4;
  if (/Preview\.tsx$/.test(path)) return 5;
  if (path.endsWith('.module.css')) return 6;
  if (path.endsWith('.ts')) return 3; // {Name}.ts controller
  return 7;
}

export interface FileMeta {
  path: string;
  label: string;
  language: FileLanguage;
}

/** Describe a set of file paths (label, language, display order). */
export function describeFiles(paths: string[]): FileMeta[] {
  const metas: FileMeta[] = [];
  for (const path of paths) {
    const language = languageFor(path);
    if (!language) continue;
    metas.push({path, label: path.split('/').pop() ?? path, language});
  }
  return metas.sort(
    (a, b) => rank(a.path) - rank(b.path) || a.label.localeCompare(b.label),
  );
}

/** All editable source files for a given mini-app key, in display order. */
export function getAppFiles(key: string): AppFile[] {
  const prefix = `./${key}/`;
  const files: AppFile[] = [];
  for (const [p, content] of Object.entries(RAW)) {
    if (!p.startsWith(prefix)) continue;
    const path = p.slice(prefix.length);
    const language = languageFor(path);
    if (!language) continue; // skip non-code files
    files.push({path, label: path.split('/').pop() ?? path, language, content});
  }
  return files.sort(
    (a, b) => rank(a.path) - rank(b.path) || a.label.localeCompare(b.label),
  );
}
