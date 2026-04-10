# Ready to Publish: Integrating Your Mini-App into Code.org

Once your mini-app is working in the prototyping environment, follow these steps to integrate it into Code.org's PythonLab. The steps follow the checklist from the K-means PR and reference which standalone files become which production files.

Throughout this guide, replace `{name}` with your mini-app's lowercase identifier (e.g. `kmeans`) and `{Name}` with its capitalized form (e.g. `KMeans`).

---

## Step 0 — Confirm your prototype is ready to export

Before touching any Code.org files, make sure both of your prototype's outputs are in their final state.

### Library code

Your library lives on disk at `src/example-{name}/python/library.py`. Because the file is the source of truth (not the browser panel), it should already reflect your latest work. Open the file and confirm the Python API is exactly what you want students to use.

### Student code

Your student code is saved in the browser's localStorage. To retrieve it:

1. Open the prototyping environment in your browser (`npm run dev`)
2. Select your mini-app from the dropdown
3. Click **📋 Copy** in the student code panel header

This copies your current student code to the clipboard. Save it somewhere — you'll use it as the starter code for your demo level in Step 11.

If you want to see or edit the saved value directly, it's stored under the key `miniapp:{name}:student` in your browser's localStorage (DevTools → Application → Local Storage → `http://localhost:5173`).

---

## Step 1 — Create the Python package

The single `library.py` file in the prototype becomes a proper Python package with multiple files.

**Source:** `src/example-kmeans/python/library.py`

**Create this directory structure:**

```
python/pythonlab/{name}/
  pyproject.toml
  {name}/
    __init__.py
    {name}.py
    support/
      __init__.py
      {name}_signal_key.py
      {name}_signal_message.py
      signal_message_type.py
```

**Split `library.py` into the package files:**

`{name}/{name}.py` — the student-facing class (the `KMeans` class at the bottom of `library.py`):
```python
from .support.{name}_signal_key import {Name}SignalKey
from .support.{name}_signal_message import {Name}SignalMessage

class {Name}:
    # ... paste your class here, replacing the _KMeans* references
    # with imports from the support modules below
```

`{name}/support/{name}_signal_key.py` — the `_KMeansSignalKey` enum from `library.py`:
```python
from enum import Enum

class {Name}SignalKey(Enum):
    ADD_POINT = "ADD_POINT"
    READY = "READY"
    # ... your signal keys
```

`{name}/support/{name}_signal_message.py` — the `_KMeansSignalMessage` class from `library.py`:
```python
import json
from .{name}_signal_key import {Name}SignalKey
from .signal_message_type import SignalMessageType

class {Name}SignalMessage:
    def __init__(self, key, detail):
        self.type = SignalMessageType.{NAME}  # uppercase
        self.key = key
        self.detail = detail

    def _get_formatted_message(self):
        msg = f'[{self.type.value}] {self.key.value}'
        if self.detail:
            msg += f' {json.dumps(self.detail)}'
        return msg

    def send(self):
        print(self._get_formatted_message())
```

`{name}/support/signal_message_type.py` — the `_SignalType` enum from `library.py`:
```python
from enum import Enum

class SignalMessageType(Enum):
    {NAME} = "{NAME}"  # e.g. KMEANS = "KMEANS"
```

`{name}/__init__.py`:
```python
from .{name} import {Name} as {Name}
```

`{name}/support/__init__.py` — empty file.

`pyproject.toml`:
```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "{name}"
version = "0.1.0"
requires-python = '>=3.12'
dependencies = []
```

---

## Step 2 — Build the wheel file

From inside `python/pythonlab/{name}/`:

```bash
pip install build
python -m build --wheel
```

This creates `dist/{name}-0.1.0-py3-none-any.whl`.

Copy it to two locations:

```bash
cp dist/{name}-0.1.0-py3-none-any.whl \
   ../../../apps/lib/pyodide/{name}-0.1.0-py3-none-any.whl

cp dist/{name}-0.1.0-py3-none-any.whl \
   ../../../dist/{name}-0.1.0-py3-none-any.whl
```

Commit both files. These are binary files — the `.whl` extension is a zip archive, not a text file.

---

## Step 3 — Register the wheel in the Pyodide worker

**File:** `apps/src/pythonlab/pyodideWebWorker.ts`

Find the array in the `loadPackages()` function (look for other `.whl` paths). Add one line:

```typescript
`/blockly/js/pyodide/${version}/{name}-0.1.0-py3-none-any.whl`,
```

---

## Step 4 — Add the message tag

**File:** `apps/src/pythonlab/pythonHelpers/patches.ts`

Add a new value to the `MessageTag` enum:

```typescript
export enum MessageTag {
  MATPLOTLIB_IMG = 'MATPLOTLIB_SHOW_IMG',
  NEIGHBORHOOD_SIGNAL = '[NEIGHBORHOOD]',
  {NAME}_SIGNAL = '[{NAME}]',  // ← add this
  INPUT_PROMPT = '[INPUT_PROMPT]',
  INPUT_FAILED = '[INPUT_FAILED]',
}
```

---

## Step 5 — Add the signal parser

**File:** `apps/src/pythonlab/pythonHelpers/messageHelpers.ts`

Add a new parser function. Model it after `parseMessageToKMeansSignal` (already in the file). The structure to follow:

```typescript
export function parseMessageTo{Name}Signal(
  message: string
): {Name}Signal | null {
  const regex = /^\[(\w+)]\s+([^\s]+)(?:\s+(\{.*\}))?$/;
  const match = message.match(regex);
  if (!match) {
    Lab2Registry.getInstance()
      .getMetricsReporter()
      .logError(`Error in parseMessageTo{Name}Signal. message: ${message}`);
    return null;
  }
  const [, , value, detail] = match;
  const signal: {Name}Signal = {value: value as {Name}SignalType};
  if (detail) {
    signal.detail = JSON.parse(detail);
  }
  return signal;
}
```

Import `{Name}SignalType` from the controller constants file you'll create in Step 9. Import `Lab2Registry` from `'@cdo/apps/lab2/Lab2Registry'`.

---

## Step 6 — Add the worker dispatch branch

**File:** `apps/src/pythonlab/pyodideWorkerManager.ts`

Find the `onmessage` handler where other `MessageTag` checks live. Add a branch for your mini-app:

```typescript
if (message.startsWith(MessageTag.{NAME}_SIGNAL)) {
  const {name} = CodebridgeRegistry.getInstance().get{Name}();
  if ({name}) {
    const data = parseMessageTo{Name}Signal(message);
    {name}.handleSignal(data);
  }
  break;
}
```

Add the import for `parseMessageTo{Name}Signal` at the top of the file.

---

## Step 7 — Register in the controller registry

**File:** `apps/src/codebridge/CodebridgeRegistry.ts`

Add a private field, getter, and setter for your controller:

```typescript
private {name}: {Name} | null;

// In constructor:
this.{name} = null;

// New methods:
public set{Name}({name}: {Name} | null) {
  this.{name} = {name};
}

public get{Name}() {
  return this.{name};
}
```

Add the import for your `{Name}` controller class at the top.

---

## Step 8 — Wire lifecycle hooks in the runner

**File:** `apps/src/pythonlab/pyodideRunner.ts`

Add a level-detection helper (look at `isNeighborhoodLevel()` to see the pattern):

```typescript
function is{Name}Level() {
  return (
    getStore().getState().lab2Project.projectSources?.labConfig?.miniApp
      ?.name === MiniApps.{Name}
  );
}
```

Then add five lifecycle calls in the existing handlers, following the same pattern as the Neighborhood hooks:

| Location in the file | Code to add |
|---|---|
| Start of run — `runPythonCode()` (reset + onRun, both here) | `if (is{Name}Level()) { CodebridgeRegistry.getInstance().get{Name}()?.reset(); CodebridgeRegistry.getInstance().get{Name}()?.onRun(); }` |
| After run completes — `handleRunClick()` after `await runPythonCode()` | `if (is{Name}Level()) { CodebridgeRegistry.getInstance().get{Name}()?.onClose(); }` |
| Stop handler — `stopPythonCode()` | `if (is{Name}Level()) { CodebridgeRegistry.getInstance().get{Name}()?.onStop(); }` |
| Unexpected exit — `handleRunEndedUnexpectedly()` | `else if (is{Name}Level()) { ... reset(), onRun(), onClose() }` |

---

## Step 9 — Add the controller, types, and visualization

**Source files:**

| Standalone file | → Production file |
|---|---|
| `src/example-kmeans/types.ts` | `apps/src/miniApps/{name}/types.ts` |
| `src/example-kmeans/constants.ts` | `apps/src/miniApps/{name}/constants.ts` |
| `src/example-kmeans/KMeans.ts` | `apps/src/miniApps/{name}/{Name}.ts` |
| `src/example-kmeans/KMeansVisualization.tsx` | `apps/src/miniApps/{name}/{Name}Visualization.tsx` |
| `src/example-kmeans/kmeans.module.css` | `apps/src/miniApps/{name}/{name}.module.scss` |

**`types.ts` and `constants.ts`:** copy unchanged.

**`{Name}.ts` (controller):** one import change only:
```typescript
// Change this:
import * as timeoutList from '../engine/timeoutList';
// To this:
import * as timeoutList from '@cdo/apps/lib/util/timeoutList';
```

**`{Name}Visualization.tsx`:** one import change only:
```typescript
// Change this:
import moduleStyles from './{name}.module.css';
// To this:
import moduleStyles from './{name}.module.scss';
```

**`{name}.module.scss`:** rename the file from `.css` to `.scss`. If you want to use SCSS nesting, convert the flat CSS selectors back:
```scss
// Standalone (CSS):
.controlButton:hover:not(:disabled) { background: #e8e8e8; }
.controlButton:disabled { opacity: 0.4; cursor: not-allowed; }

// Production (SCSS with nesting):
.controlButton {
  &:hover:not(:disabled) { background: #e8e8e8; }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
}
```

---

## Step 10 — Wire the frontend routing

**Three changes:**

**`apps/src/codebridge/constants.ts`** — add to the `MiniApps` enum:
```typescript
export enum MiniApps {
  Neighborhood = 'neighborhood',
  {Name} = '{name}',  // ← add this
}
```

**`apps/src/codebridge/MiniAppPreview/MiniAppPreview.tsx`** — add a routing branch and reset hook, following the Neighborhood pattern:
```typescript
if (miniApp === MiniApps.{Name}) return <{Name}Preview />;
// and in the reset handler:
CodebridgeRegistry.getInstance().get{Name}()?.reset();
```

**Create `apps/src/codebridge/MiniAppPreview/{Name}Preview.tsx`:**

Use `src/example-kmeans/KMeansPreview.tsx` from the standalone as your starting point, replacing the standalone-specific wiring with production wiring:

```typescript
// Replace useImperativeHandle + forwardRef with:
CodebridgeRegistry.getInstance().set{Name}(instance);

// Replace onIsRunningChange prop with:
setIsRunning: isRunning => dispatch(setIsRunning(isRunning)),
// (import setIsRunning from '@cdo/apps/lab2/redux/systemRedux')
// (import useAppDispatch from '@cdo/apps/util/reduxHooks')
```

---

## Step 11 — Add to the Rails level editor

**File:** `dashboard/app/models/levels/pythonlab.rb`

Find the `mini_apps` method and add your entry:

```ruby
def self.mini_apps
  [['None', nil], ['Neighborhood', 'neighborhood'], ['{Display Name}', '{name}']]
end
```

After deploying, the mini-app will appear as an option in the level editor dropdown when creating or editing a PythonLab level.

---

## Summary checklist

- [ ] 1. Python package created at `python/pythonlab/{name}/`
- [ ] 2. Wheel built and committed to `apps/lib/pyodide/` and `dist/`
- [ ] 3. Wheel path added to `pyodideWebWorker.ts`
- [ ] 4. `MessageTag.{NAME}_SIGNAL` added to `patches.ts`
- [ ] 5. `parseMessageTo{Name}Signal()` added to `messageHelpers.ts`
- [ ] 6. Dispatch branch added to `pyodideWorkerManager.ts`
- [ ] 7. Registry getter/setter added to `CodebridgeRegistry.ts`
- [ ] 8. Lifecycle hooks added to `pyodideRunner.ts`
- [ ] 9. Controller + types + visualization files added to `apps/src/miniApps/{name}/`
- [ ] 10. Routing + preview component added in `MiniAppPreview/`
- [ ] 11. Entry added to `mini_apps` in `pythonlab.rb`
