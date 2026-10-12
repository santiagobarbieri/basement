# BASEMENT shell — Phase 4

Build with `scripts/build-basement.command`, open with `scripts/run-basement.command`.
Both scripts run from the repository root regardless of the caller's directory.
The debug app is generated at `shell/spike/src-tauri/target/debug/bundle/macos/BASEMENT.app`
using the shared local Rust cache. Generated assets and build artifacts are ignored.

## Implemented

- Home based on Santi's Main Page: SVG wordmark, Cooper BT Medium Italic titles,
  bundled Albert Sans, seven Studio pills, eight filters, current Buenos Aires
  clock, real artboard count/list, empty state and scrollable rows.
- Only ENDO and PRISM create artboards. Other Studio pills are disabled with Soon.
- Approved new-artboard form: name, preset/custom size, ppi and transparent/color background.
- Common Studio chrome, accent variables, editable project name, canvas fit/zoom,
  metadata panel, background layer and native PNG export dialog.
- Native folder storage at ~/Basement by default: visible flat *.artboard packages
  with project.json, main.png, thumbnail.png and assets/. No artboard database.
- Atomic metadata/image writes; collision-safe folder names; folder rename preserves
  project identity. Corrupt packages are reported without hiding valid artboards.
- Preferences via Cmd-comma or the application menu: root-folder chooser and theme.
  Preferences are persisted in the app config directory.
- .artboard document/package registration and Finder open events, constrained to
  the configured root. Opening a package selects the correct Studio.

## Scope boundary

This phase implements the shell and document lifecycle. It does not connect either
editing engine yet. The canvas is a real empty PNG document; painting/image-editing
tools and canvas undo/redo are disabled until ENDO integration (Phase 5) and PRISM
integration (Phase 6). Original engines remain unchanged and separately runnable.
Brush/property rows are layout placeholders, not an additional brush engine.

PNG export is the current work file, initially a blank background. JPG and engine
project formats belong to engine integration. No draft strokes can be lost because
editing is not available in this phase.

## Verification

Four storage tests cover creation/reopen/rename/collisions, invalid paths and
oversized documents, corrupted packages, persisted root/theme changes, and PNG
dimensions/background/print-resolution encoding:

```sh
source scripts/env.sh
CARGO_TARGET_DIR="$PWD/shell/spike/src-tauri/target" cargo test --manifest-path shell/app/src-tauri/Cargo.toml --features custom-protocol
```

Native UI QA creates and opens ENDO/PRISM documents, submits the actual new-artboard
form, and records Finder-open events. It is opt-in using BASEMENT_QA_DIR,
BASEMENT_CONFIG_DIR and BASEMENT_ARTBOARD_ROOT pointing to isolated test directories.
QA fixtures are not seeded into the normal ~/Basement folder.

Screenshots in docs/design render the same frontend in Chrome with a read-only
bridge to the actual native QA files. Native creation/reopening is separately
verified in phase4-native-checks.json; screenshots are not claimed to be native
window captures. Exact Cooper typography depends on Santi's installed licensed font;
it is not embedded. Brand/source notices are in assets/brand and assets/icons.
