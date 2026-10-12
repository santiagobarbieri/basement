# BASEMENT status

Updated: 2026-10-12 (Buenos Aires).

## Current phase

Phase 0 approved. Phase 1 complete; awaiting user approval of checkpoint 1.
Phase 2 has not started. No BASEMENT application exists yet.

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

- No BASEMENT application or running Studio screenshots yet.
- Exact wordmark, fonts, and SVG icons still needed for visual implementation.
- Do not audit or build QUILL, REEL, FOLIO, LUX, or MIRAGE.

## Next

1. Await approval of checkpoint 1 under AGENTS.md section 3.2.
2. After approval: Phase 2 audits for ENDO and PRISM, compile/run engines, document capabilities and integration risks.
