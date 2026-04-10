# Mini-App Prototyping Environment

A standalone development environment for building and testing PythonLab mini-apps before integrating them into Code.org. It runs entirely in your browser — no server, no database — and lets you iterate on all three parts of a mini-app at once:

- **The Python library** students will `import` in their code
- **The interactive visualization** that responds to their code
- **Student code samples** to verify the experience works as intended

The project includes a fully-working K-means clustering mini-app as a reference implementation. When you're ready to build your own, copy and adapt it. When you're satisfied with how everything works, see [READY-TO-PUBLISH.md](./READY-TO-PUBLISH.md) for instructions on integrating it into Code.org's production system.

---

## What is a mini-app?

A mini-app is an interactive panel that appears alongside a student's Python editor. When students run their code, the mini-app visualizes the output — and often provides buttons or controls for further exploration that code alone can't do.

The communication works through a simple signal protocol: the Python library prints specially-formatted messages to stdout, and the JavaScript visualization listens for those messages and updates accordingly. This prototyping environment replicates that same pipeline in a browser tab.

For example, the K-means mini-app uses signals like `[KMEANS] ADD_POINT {"x": 1.0, "y": 2.0}` and `[KMEANS] READY {"k": 3}`. When students call `model.add_point(1.0, 2.0)`, the Python library prints that signal, and the visualization immediately places a point on the scatter plot.

---

## Prerequisites

You need **Node.js version 20 or higher**. The project includes an `.nvmrc` file, so if you use [nvm](https://github.com/nvm-sh/nvm), switching is one command.

To check your current version:
```bash
node --version
```

If it's below 20, install and switch using nvm:
```bash
nvm install 20
nvm use 20
```

---

## Setup

From the `standalone-mini-app-experiment/` directory:

```bash
nvm use 20         # switch to Node 20 (skip if already on 20+)
npm install        # install dependencies (React, Vite, TypeScript)
```

This takes about 15–30 seconds and only needs to be done once (or after adding new packages).

---

## Running the app

```bash
npm run dev
```

Vite starts a local dev server and opens your browser to `http://localhost:5173`. The page loads immediately; the first time you click **Run**, the browser will spend a few seconds downloading the Python runtime (Pyodide, ~10 MB). Subsequent runs in the same session are instant.

To stop the dev server, press `Ctrl+C` in the terminal.

---

## The three panels

```
┌─────────────────────────┬─────────────────────────┐
│                         │                         │
│   Student code          │   Mini-app preview      │
│                         │                         │
│   (left panel)          │   (right panel)         │
│                         │                         │
├─────────────────────────┴─────────────────────────┤
│   Library code                                    │
│   (bottom panel)                                  │
└───────────────────────────────────────────────────┘
```

### Left panel — Student code

This is the code a student would write in PythonLab. It imports from the library defined in `library.py` and calls its API to send data to the visualization.

Click **▶ Run** to execute it. The visualization on the right responds in real time.

> **K-means example:** the default student code creates a `KMeans` model, adds a set of 2D points to it, and calls `model.init()`. The visualization then populates with those points and unlocks the interactive buttons.

### Right panel — Mini-app preview

The interactive visualization your students will see. It updates as Python signals arrive during execution and can include buttons, sliders, or any other controls relevant to your mini-app concept.

The visualization does not update until you click Run — it waits for Python to send it data first.

> **K-means example:** the preview shows an SVG scatter plot with three buttons — Initialize Centroids, Step, and Play — that let students walk through the clustering algorithm at their own pace.

### Bottom panel — Library code

This panel shows the Python that students will eventually `import` in their code — the class names, method names, and parameters a student will use. It's a read-only view of the file on disk.

**To change the library, edit the file directly:** open `src/example-{name}/python/library.py` in your code editor and save it. Vite detects the change and updates the panel automatically. Any typing done in the panel itself is not saved and will be lost on refresh.

> **K-means example:** the library defines a `KMeans` class with `add_point(x, y)` and `init()` methods. Each method call prints a signal like `[KMEANS] ADD_POINT {"x": 1.0, "y": 2.0, "id": 0}` that the visualization receives.

---

## Editing a mini-app

### The Python library

The library file lives at `src/your-mini-app/python/library.py` (for K-means, `src/example-kmeans/python/library.py`).

This single file contains everything that will eventually become the Python package students import:
- A **signal type enum** — the named actions the visualization understands (e.g. `ADD_POINT`, `READY`)
- A **signal message class** — formats and prints signals in the wire format `[TYPE] KEY {"json": "data"}`
- The **student-facing API class** — the methods a student calls, each of which emits a signal

**To define your API:** edit the student-facing class at the bottom of the file. Choose method names and parameters that feel natural for your subject matter, then decide what signal each method should emit.

**To add a new signal:** add a value to the signal key enum, then emit it in the appropriate method using the signal message class. You'll also need to add a handler for it in the TypeScript controller (see below).

Save the file — Vite will update the library panel in the browser automatically. Then click **Run** to execute the new library code against your student code.

### The TypeScript visualization

Each mini-app's visualization lives in its own folder under `src/` (for K-means, `src/example-kmeans/`). Here's what each file does and when you'd edit it:

| File | What it does | Edit it when… |
|---|---|---|
| `types.ts` | TypeScript interfaces for signals, data structures, and state | You add new signals, data fields, or visualization state |
| `constants.ts` | Signal type names, colors, sizes, animation timings | You add signal types, change visual style, or tune timing |
| `{Name}.ts` | The controller — receives Python signals, manages state, calls back into React | You add signal handlers or new interactive behavior |
| `{Name}Visualization.tsx` | The React component — renders the visual output and any UI controls | You change what the visualization looks like |
| `{name}.module.css` | Styles for the visualization panel | You change layout, button appearance, or colors |
| `{Name}Preview.tsx` | Wires the controller into the prototyping environment | Rarely — only if you change how the controller is connected |

**The dev server hot-reloads TypeScript and CSS changes automatically.** Save a file and the browser updates within a second — no manual rebuild needed while the dev server is running.

> Note: if you rename files or add new imports, the dev server may briefly show an error while it re-processes. It resolves on its own.

### Student code

Edit the left panel directly in the browser to try different inputs and edge cases. To change what loads by default when the app opens, edit the `defaultStudentCode` field in your mini-app's entry in `src/miniAppRegistry.ts`.

The student code runs in a sandboxed Python environment. It has access to:
- Everything defined in your library code (registered as a Python module named after your mini-app's `key` in the registry — e.g. `from kmeans import KMeans`)
- Python's standard library
- Any package included in Pyodide's default distribution

It does **not** have access to pip-installable packages that aren't already in Pyodide — for prototyping a mini-app library, this isn't usually a constraint.

---

## Iterating on your mini-app

The typical loop for each kind of change:

1. **Refining the Python API**: edit `library.py`, click Run, observe how the visualization responds
2. **Changing the visualization**: edit a `.tsx` or `.css` file, the browser hot-reloads automatically, then click Run to feed it fresh signals
3. **Changing signal handling logic**: edit the controller (`{Name}.ts`), browser hot-reloads, click Run
4. **Testing student scenarios**: edit the student code in the left panel, click Run

You do not need to restart the dev server for any of these. The only thing that requires a restart is adding or removing npm packages.

---

## Building for production (optional)

If you want to produce a static build (e.g. to share via a web server):

```bash
npm run build
```

Output goes to `dist/`. You can serve it with any static file server:

```bash
npx serve dist
```

The dev server (`npm run dev`) is sufficient for prototyping — you only need the build step to deploy or share a hosted version.

---

## Project structure

```
standalone-mini-app-experiment/
├── src/
│   ├── main.tsx                      Entry point
│   ├── App.tsx                       Three-panel layout, dropdown, Run button
│   ├── App.module.css                Layout and header styles
│   ├── miniAppRegistry.ts            ← Register new mini-apps here
│   ├── index.css                     Global reset
│   │
│   ├── engine/                       Signal pipeline — do not edit for new mini-apps
│   │   ├── worker.ts                 Pyodide Web Worker — runs Python, captures stdout
│   │   ├── usePyodide.ts             React hook — manages the worker, routes signals
│   │   ├── signalParser.ts           Parses "[TYPE] KEY {json}" strings into objects
│   │   └── timeoutList.ts            Trackable timeout utility (mirrors production)
│   │
│   ├── example-kmeans/              Reference mini-app — copy this folder to start a new one
│   │   ├── types.ts                  TypeScript interfaces for signals, data, and state
│   │   ├── constants.ts              Signal names, colors, sizes, animation timings
│   │   ├── KMeans.ts                 Controller — signal queue, algorithm, animation logic
│   │   ├── KMeansVisualization.tsx   React component — SVG scatter plot and buttons
│   │   ├── KMeansPreview.tsx         Connects the controller to the prototyping environment
│   │   ├── kmeans.module.css         Component styles
│   │   └── python/
│   │       └── library.py           Python library — student-facing API and signal emission
│   │
│   └── example-{your-app}/          Your new mini-app goes here (same structure as above)
│
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
└── .nvmrc                           Pins Node to version 20
```

The `engine/` folder and `App.tsx` run the same infrastructure regardless of which mini-app is active. `miniAppRegistry.ts` is the one file that connects mini-app folders to the dropdown.

---

## Creating a new mini-app

The `src/example-kmeans/` folder is the template. To start a new mini-app:

1. **Duplicate `src/example-kmeans/`** and rename the folder (e.g. `src/example-sorting/`)
2. **Rename the files** inside to match your concept (e.g. `Sorting.ts`, `SortingVisualization.tsx`)
3. **Edit `python/library.py`** — define your signal types and the student-facing API class
4. **Edit `constants.ts`** — update the signal type enum to match what your Python emits
5. **Edit the controller** (`Sorting.ts`) — add handlers for your signals and any interactive logic
6. **Edit the visualization** (`SortingVisualization.tsx`) — build the React component that renders your concept
7. **Edit `src/miniAppRegistry.ts`** — add one entry to `MINI_APP_REGISTRY` with your key, label, `PreviewComponent`, and default student code. Your mini-app will appear in the dropdown immediately.

The `engine/` files and `App.tsx` don't need to change — they work generically with any registered mini-app.

---

## Persistence and saving your work

**Student code is automatically saved per mini-app** to your browser's localStorage. Switching mini-apps, refreshing the page, or closing the tab won't lose your student code. Each mini-app has its own saved state.

To reset the student panel back to its original default, click the **Reset** button in the panel header.

**Library code is not saved in the browser.** The source of truth is the file on disk (`src/example-{name}/python/library.py`). Edit it in your code editor — Vite's dev server will update the panel automatically when you save. Any changes typed directly into the bottom panel will be lost on refresh.

**When you're ready to publish**, click **📋 Copy** in the student code panel to grab your final student code. See [READY-TO-PUBLISH.md](./READY-TO-PUBLISH.md) for the full publishing workflow.

---

## Known limitations

- **No stop button**: if student code has an infinite loop, it will hang the browser tab. Refresh to recover.
- **Pyodide loads on first Run**: expect a 5–15 second delay the first time you click Run in a new session (the Python runtime is ~10 MB). Subsequent runs are fast.
