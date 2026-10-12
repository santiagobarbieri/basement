# Architecture preview

Phase 3 only. This is a Tauri/WebKit wrapper around the unchanged PhotoCraft web
build, not BASEMENT's finished interface or a production architecture decision.

- Build: double-click `scripts/build-spike.command` at the repository root.
- Run: double-click `scripts/run-spike.command`.
- Choose **Abrir ejemplo PSD** or **Abrir archivo…**, edit, and use File > Save.
- Exports go to `.audit-runtime/spike/exports/`; input files are not overwritten.

Builds require network and the authenticated GitHub CLI for the local Trunk
download. Trunk 0.21.14 is downloaded inside `.audit-runtime/tools`, not installed
system-wide. Generated WASM assets and build outputs are ignored by Git.
This prototype currently targets this Mac's Apple Silicon architecture.

The shell uses native Rust file commands and a proof-of-concept adapter to the
original web file picker/downloads. DOM/keyboard interception is deliberately a
spike; production needs a typed host/engine bridge before replacing panels.
File size is bounded to 32 MiB for this preview. CSP is disabled only for this
local spike and must be configured before any production packaging.

Measurements are written under `.audit-runtime/spike`. Set
`BASEMENT_SPIKE_AUTOTEST=1` to open the fixture, attempt a save, and sample
requestAnimationFrame cadence; `BASEMENT_SPIKE_BACKEND=webgl` forces the GL
fallback. Cadence is not an engine rendering or large-document benchmark.
The keyboard adapter is not reliable automation; inspect `exportConfirmed` in
after-files.json rather than treating a ready canvas as a successful file save.

The launcher sets `BASEMENT_SPIKE_WORKSPACE`. The generated `.app` also locates
the checkout through its executable's parent directories, so it can be opened
directly while it stays inside this project. It is not portable until workspace
storage is replaced with actual artboard/preferences handling in later phases.
