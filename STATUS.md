# BASEMENT status

Updated: 2026-10-12 (Buenos Aires).

## Current phase

Phases 0, 1 and 2 approved by Santi. Phase 3 architecture spike implemented;
awaiting Santi's review and checkpoint 3 architecture approval. Phase 4 has not
started. The shell exists only as an experimental preview.

## Phase 3 results

- Built original PhotoCraft web app with local Trunk 0.21.14, including upstream HEIF feature. Build wall time 253.69 s; generated WASM 25,063,798 bytes (23.90 MiB).
- Created shell/spike: Tauri 2.12.3, plain HTML/JS, native file commands and original WASM editor in a frame. Both source submodules remain unmodified.
- Local tauri://localhost context is secure and returned a WebGPU adapter on this Mac. Engine logs confirm BrowserWebGpu, with real UI captured from its canvas.
- Initial WebGPU readiness: 1.134 s. Brief 180-sample rAF cadence: mean 16.67 ms, p95 18 ms; not an engine FPS or large-document benchmark.
- Native shell read a PSD, delivered bytes to the original editor, intercepted an encoded download and saved 92,971 bytes to disk. One measured save took 116 ms. Reopening that export produced the same PNG as native rendering of the same input revision.
- Preserved Santi's edits to docs/audit/evidence/prism-test.psd; it remains an unstaged user change. Tests use a frozen copy in .audit-runtime/spike/input.psd and never overwrite the source.
- Forced WebGL2 initialized backend Gl and imported the test PSD. Full visual/save behavior remains partial: canvas capture was black and repeated automated shortcuts did not confirm export. Do not claim a fully supported fallback.
- Native comparison: CLI PSD reencode 64–107 ms over three runs; a separate-session layer command plus inspection took about 125 ms. These are not apples-to-apples UI benchmarks.
- Added executable scripts/build-spike.command and scripts/run-spike.command, tested the full build script and packaged a debug macOS .app (~37.70 MiB).
- Tested the packaged app and opened the normal preview using the launcher. The bundle can find this checkout without a path environment variable, but must remain inside the project.
- Added docs/decisions/0001-architecture.md in Spanish with context, evidence, options, preliminary implementation estimates and proposed Tauri/WASM architecture.
- LICENSE, NOTICE and asset attribution copied into the preview resources. No permanent Studio UI, home, artboard storage or vendor patches were implemented.

## Phase 3 findings / limits

- Recommendation pending approval: Tauri + ENDO web + PRISM WASM, provisional egui UI, then progressive HTML panels starting with Layers.
- Original web loader only exports initialization; native TCP/MCP do not exist inside WASM. Shared-session HTML panels need a typed command/state bridge, not a disconnected CLI session.
- DOM/keyboard/file-picker interception is a spike adapter. The first real save passed, but repeated automated shortcuts are unreliable; reports distinguish readiness from exportConfirmed. A stable host bridge is required before production artboard claims.
- macOS window screencapture failed; evidence is the editor's own WebGPU canvas, not a composed or fabricated screenshot. GL canvas capture did not prove visual behavior.
- Native picker is wired but still needs Santi's manual trial. Preview file limit is 32 MiB; output is .audit-runtime/spike/exports. CSP is disabled for the local prototype.
- No broad memory/tablet/large-document/GPU-loss tests. No architecture approval inferred from completing the spike.
- rustfmt is not installed in the minimal Rust toolchain; no formatter check ran. Rust compilation, packaging, JS syntax and shell syntax checks passed.

## Phase 2 results

- Written docs/audit/endo.md and docs/audit/prism.md, with screenshots, test projects and JSON evidence in docs/audit/evidence.
- ENDO ran in an isolated Chrome profile. Painting, undo/redo, JSON project roundtrip, PNG/JPEG encoding and IndexedDB recovery passed. The roundtrip PNG stayed byte-identical; all 26 brush renderers produced pixels without uncaught exceptions in the tested scenario.
- ENDO has 16 visible library brushes plus Fusion, nine preserved legacy renderers, four shared graphic effects, and Canvas 2D material shading. No separate 3D mode found. Existing shortcuts and actual rail inventory documented.
- PhotoCraft native release and CLI built successfully in 254.40 seconds. App binary 59,935,872 bytes; CLI 39,028,784 bytes.
- Native PhotoCraft ran on Apple M2 Pro / Metal. 33 primary and 11 additional operations passed, exercising painting, layers, masks, selections, transformations, crop, adjustments, filters, basic text, groups and file I/O.
- PSD and native .pcraft test projects retained layers/masks/type/adjustments. PNG exports before and after both roundtrips were byte-identical. No external Photoshop validation was performed.
- Verified CLI info and 884 runtime engine commands, authenticated JSON control channel, MCP initialize/tools-list (25 tools), and the 18 proposed PRISM tool selectors.
- Rust wasm32 target installed. PhotoCraft web target passed cargo check in 294.32 seconds; browser/WASM artifact, WebView behavior and disk integration remain Phase 3 work.
- Added executable scripts/run-endo.command and scripts/run-prism.command. Ran both launchers: ENDO opens in the browser, PhotoCraft opens the test PSD natively using an isolated config folder.
- Both engine submodule worktrees remain unchanged. No other Studio was audited or built.

## Phase 2 limits and issues

- Upstream PhotoCraft remains alpha; complex PSD compatibility, typography and performance need further validation. Our small self-roundtrip does not prove Photoshop compatibility.
- External block crate emits a future-Rust compatibility warning; build succeeded.
- The initial audit harness used an incorrect export return shape and Levels parameters; corrected against the source/registry, then the final scenarios passed.
- Browser/native interfaces shown are the original engines; BASEMENT's supplied design has not yet been implemented.
- Automated tests do not cover every effect/tool, large projects, tablet hardware or native save-dialog interaction.
- Existing ENDO autosave is one pathname-keyed browser workspace, not .artboard disk storage.

## Phase 1 results

- Private repository: https://github.com/santiagobarbieri/basement.
- Created only the requested fork: https://github.com/santiagobarbieri/photocraft.
- ENDO full-history submodule: studios/endo, from santiagobarbieri/endo_testing.
- ENDO pinned commit: cf7f971a3eabce9013fa1c1082df2c32d4111b89. Source has one commit; no shallow clone was used.
- ENDO local integration branch: basement-integration. Original repository unchanged.
- PhotoCraft submodule: vendor/photocraft, commit 20cb95bc272feb9691537bccb46e84e583f5a04a (1,618 commits).
- PhotoCraft upstream: https://github.com/storytold/photocraft.git.
- PhotoCraft endo-integration branch pushed to fork; main and integration branch match upstream/main at setup time. No engine code changes.
- PhotoCraft licenses, NOTICE, and attribution files retained intact.
- Created shell, assets, documentation, and scripts structure; empty folders use .gitkeep.
- Preserved home and ENDO PNG references in assets/design.
- Added README, ignore rules, and scripts/setup-sources.sh to restore sources and integration branches.
- Initialized main; setup work on phase-1-setup. Set repository-local GitHub noreply email because global author email was invalid; global configuration unchanged.

## Validation

- Setup scripts pass zsh syntax checks; scripts/setup-sources.sh ran successfully.
- Both submodules have clean worktrees and full histories.
- Git diffs confirm ENDO matches original main and PhotoCraft matches upstream/main.
- GitHub confirms BASEMENT is private.
- GitHub confirms PhotoCraft is a fork of storytold/photocraft and ENDO's pinned commit matches the original repository.
- Engine compilation and launch are Phase 2 audit work, not performed in this source setup phase.

## Verified environment / Phase 0

- macOS 26.6.2; Xcode Command Line Tools installed.
- Git 2.39.5, Node 24.19.0, npm 11.17.0, Homebrew 7.0.9.
- GitHub CLI 2.102.0; authenticated as santiagobarbieri.
- Rust/Cargo 1.99.0, rustup 1.29.1, Tauri CLI 2.12.2.
- scripts/check-environment.sh passed Rust compilation/linking/execution, Node execution, and authenticated GitHub API checks.
- scripts/env.sh sets tool paths and GH_CONFIG_DIR to ~/Library/Application Support/BASEMENT/gh because ~/.config belongs to root. Credentials remain in macOS keyring.

## Pending / limitations

- BASEMENT home, final shared chrome and .artboard lifecycle are not implemented. Engine and Tauri previews are available.
- Exact wordmark, fonts, and SVG icons still needed for visual implementation.
- Do not audit or build QUILL, REEL, FOLIO, LUX, or MIRAGE.

## Next

1. Santi reviews the architecture preview and docs/decisions/0001-architecture.md, then approves or adjusts checkpoint 3.
2. After approval, Phase 4: shell/home and artboards, following the supplied references.
3. Exact wordmark and font files/names are still needed for visual fidelity; the existing Druk asset requires identification/license confirmation before reuse.
