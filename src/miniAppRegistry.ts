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

import React from "react";

import { ParsedSignal } from "./engine/signalParser";
import ThermostatPreview from "./thermostat/ThermostatPreview";
import thermostatLibraryCode from "./thermostat/python/library.py?raw";
import ViralPreview from "./viral/ViralPreview";
import viralLibraryCode from "./viral/python/library.py?raw";

// The handle interface every PreviewComponent must satisfy.
// When you create a new mini-app, its forwardRef handle must implement these.
export interface MiniAppPreviewHandle {
  handleParsedSignal: (signal: ParsedSignal) => void;
  /**
   * Optional: receive every raw stdout line. Use this if your mini-app
   * prefers to parse human-readable print output rather than the
   * structured `[TYPE] KEY {...}` signal format.
   */
  handleStdout?: (line: string) => void;
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

const THERMOSTAT_DEFAULT_STUDENT_CODE = `\
# Thermostat — Hill Climbing on a Dial
# Press Run to watch your strategy turn the thermostat dial toward the
# temperature most people prefer. The bars around the dial show how many
# people prefer each temperature; the highlighted bar is the dial's
# current setting.
#
# Your move(current, left, right) function decides what the dial does:
#   - current = people who prefer the current temperature
#   - left    = people who prefer the temperature one degree cooler
#               (0 if the dial is already at the minimum)
#   - right   = people who prefer the temperature one degree warmer
#               (0 if the dial is already at the maximum)
#
# Print "LEFT" (cooler), "RIGHT" (warmer), or "STAY" (stop here).

from thermostat import run


def move(current, left, right):
    if left > current:
        print("LEFT")
    elif right > current:
        print("RIGHT")
    else:
        print("STAY")


run(move)`;

const VIRAL_DEFAULT_STUDENT_CODE = `\
# Viral — simulating a post spreading through a network
# Press Run to watch the post spread. The full network represents the world's
# ~5 billion social media users. The camera starts zoomed in on the first few
# people, then zooms out as the post reaches more of the network.
#
# The visualization listens for print lines that look like:
#     Day <day>: <views> views
# So students don't need to import anything—just print in that format
# from inside a loop, and the network animates automatically.


def simulate(views, growth, days):
    for i in range(days):
        print(f"Day {i}: {views} views")
        views = views + views * growth


simulate(100, 1, 10)
`;

export const MINI_APP_REGISTRY: MiniAppDefinition[] = [
  {
    key: "thermostat",
    label: "Thermostat — Hill Climbing on a Dial",
    PreviewComponent: ThermostatPreview,
    defaultStudentCode: THERMOSTAT_DEFAULT_STUDENT_CODE,
    defaultLibraryCode: thermostatLibraryCode,
  },
  {
    key: "viral",
    label: "Viral — Post Spreading Through a Network",
    PreviewComponent: ViralPreview,
    defaultStudentCode: VIRAL_DEFAULT_STUDENT_CODE,
    defaultLibraryCode: viralLibraryCode,
  },
];
