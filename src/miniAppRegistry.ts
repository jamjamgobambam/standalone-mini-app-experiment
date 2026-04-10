/**
 * Mini-App Registry
 *
 * This is the single place where mini-app prototypes are registered.
 * It's the standalone equivalent of the `mini_apps` dropdown in
 * dashboard/app/models/levels/pythonlab.rb.
 *
 * To add a new mini-app:
 *   1. Create your mini-app folder under src/ (copy src/example-kmeans/ as a template)
 *   2. Import its PreviewComponent, library code, and default student code below
 *   3. Add one entry to MINI_APP_REGISTRY
 *   4. It will appear in the dropdown immediately
 */

import React from 'react';

import {ParsedSignal} from './engine/signalParser';
import KMeansPreview from './example-kmeans/KMeansPreview';
import kmeansLibraryCode from './example-kmeans/python/library.py?raw';

// The handle interface every PreviewComponent must satisfy.
// When you create a new mini-app, its forwardRef handle must implement these.
export interface MiniAppPreviewHandle {
  handleParsedSignal: (signal: ParsedSignal) => void;
  reset: () => void;
  onRun: () => void;
  onClose: () => void;
}

export interface MiniAppDefinition {
  /** Lowercase identifier — used as the localStorage key and signal type prefix */
  key: string;
  /** Human-readable name shown in the dropdown */
  label: string;
  /** The forwardRef React component that renders the mini-app visualization */
  PreviewComponent: React.ForwardRefExoticComponent<
    React.RefAttributes<MiniAppPreviewHandle>
  >;
  /**
   * Default student code shown on first open (before any localStorage value exists).
   * This also becomes the starter code for the published Code.org level.
   */
  defaultStudentCode: string;
  /**
   * Default library code loaded from disk via Vite's ?raw import.
   * This is informational — the file itself is the source of truth.
   * Students never see this panel; it's for the mini-app author's reference.
   */
  defaultLibraryCode: string;
}

// ─── Register mini-apps here ─────────────────────────────────────────────────

const KMEANS_DEFAULT_STUDENT_CODE = `\
# K-Means Clustering Demo
# Press Run, then use the mini-app buttons to step through the algorithm.
# - "Initialize Centroids" places 4 starting centroids randomly among the data points.
# - "Step" assigns each point to its nearest centroid (watch colors change),
#   then moves each centroid to the center of its group (watch markers slide).
# - "Play" runs all steps automatically until the centroids stop moving.

from kmeans import KMeans

model = KMeans(k=4)

# Cluster A: tight, bottom-left
model.add_point(1.0, 1.0)
model.add_point(1.2, 1.5)
model.add_point(0.8, 0.8)
model.add_point(1.5, 1.2)
model.add_point(1.1, 0.6)

# Cluster B: sparse, top-right (spread out — centroid will drift significantly)
model.add_point(8.0, 9.0)
model.add_point(9.5, 7.5)
model.add_point(6.5, 8.5)
model.add_point(9.0, 6.0)
model.add_point(7.0, 7.0)
model.add_point(10.0, 9.5)

# Cluster C: medium, top-left
model.add_point(1.5, 8.0)
model.add_point(2.0, 9.0)
model.add_point(0.5, 7.5)
model.add_point(2.5, 8.5)

# Cluster D: bottom-right
model.add_point(8.5, 1.5)
model.add_point(9.0, 2.0)
model.add_point(7.5, 1.0)
model.add_point(9.5, 1.8)

# Ambiguous middle points — will likely reassign 1-2 times before settling
model.add_point(4.5, 4.0)
model.add_point(5.0, 5.5)
model.add_point(5.5, 4.5)
model.add_point(4.0, 6.0)
model.add_point(6.0, 5.0)

model.init()`;

export const MINI_APP_REGISTRY: MiniAppDefinition[] = [
  {
    key: 'kmeans',
    label: 'K-Means Clustering',
    PreviewComponent: KMeansPreview,
    defaultStudentCode: KMEANS_DEFAULT_STUDENT_CODE,
    defaultLibraryCode: kmeansLibraryCode,
  },
  // Add new mini-apps here ↓
];
