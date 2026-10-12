# BASEMENT status

Updated: 2026-10-12 (Buenos Aires).

## Current phase

Phases 0 and 1 approved by Santi. Phase 2 technical audit complete; awaiting
Santi's trial of both engines and approval of the v1 scope (checkpoint 2).
Phase 3 has not started. No BASEMENT shell exists yet.

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

- BASEMENT home, shared chrome and .artboard lifecycle are not yet implemented. Engine screenshots and runnable previews are available.
- Exact wordmark, fonts, and SVG icons still needed for visual implementation.
- Do not audit or build QUILL, REEL, FOLIO, LUX, or MIRAGE.

## Next

1. Santi opens both audit previews and reports what feels missing; confirm the proposed v1 scope in docs/audit/endo.md and docs/audit/prism.md.
2. Await checkpoint 2 approval under AGENTS.md sections 3.2 and 10.
3. After approval, Phase 3: architecture spike with Tauri/WASM, real file I/O, WebGPU/fallback behavior and comparison of native UI versus HTML panels. Document the recommendation before committing to an architecture.
