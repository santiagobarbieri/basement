# BASEMENT status

Updated: 2026-10-12 (Buenos Aires).

## Current phase

Phase 0: technical checks complete. Awaiting user approval of checkpoint 0 before Phase 1.
No application implementation, repositories, or forks have been created.

## Completed

- Read AGENTS.md in full.
- Preserved supplied home and ENDO references in assets/design/home/reference.png and assets/design/endo/reference.png.
- User confirmed: reproduce the home reference, use ENDO as the shared visual reference for Studios, and fit additional AGENTS requirements into that design.
- Initial implementation scope remains ENDO and PRISM; remaining Studios are pending.
- User approved installation of GitHub CLI, Rust, and Tauri.
- Installed GitHub CLI, Rust, and Tauri CLI. Tauri compiled in 2m 28s.
- Added scripts/env.sh to expose project tools without modifying user shell configuration.
- GitHub device authorization completed; authenticated as santiagobarbieri using the macOS keyring.
- Ran scripts/check-environment.sh successfully: versions, Rust compilation/linking/execution, Node execution, GitHub authentication, and authenticated user API request.

## Verified environment

- macOS 26.6.2, build 25G83.
- Xcode Command Line Tools: /Library/Developer/CommandLineTools.
- Git 2.39.5 (Apple Git-154).
- Node v24.19.0, npm 11.17.0.
- Homebrew 7.0.9 (updated by Homebrew during installation).
- GitHub CLI 2.102.0.
- rustup 1.29.1, rustc 1.99.0, cargo 1.99.0 (using scripts/env.sh).
- Tauri CLI 2.12.2; verified using cargo tauri --version.
- Setup and environment scripts pass zsh syntax validation.
- No pre-existing STATUS.md was present.

## Pending / limitations

- No BASEMENT application build or launch yet: project contains instructions, scripts, and references only. Rust environment smoke test compiled and ran successfully.
- Installation completed, but the running setup script reported a trailing command error after version checks because it was edited while running. Subsequent standalone version and syntax checks confirm the tools and saved scripts; no application build has been attempted.
- System installations approved by user.
- Initial GitHub browser authorization succeeded, but saving failed: ~/.config belongs to root, so gh could not create its configuration directory.
- Resolved configuration permissions by setting GH_CONFIG_DIR to ~/Library/Application Support/BASEMENT/gh. GitHub credentials are in the macOS keyring, not project files.
- Restricted execution initially reported an invalid GitHub token; verification with network/keychain access passed. No further login required.
- Exact logo, fonts, and supplied SVG icons are not present; needed for the visual implementation phase.

## Next

1. Obtain user approval of checkpoint 0 under AGENTS.md section 3.2.
2. Phase 1: prepare private basement repository, preserve endo_testing history, and fork/integrate only photocraft.
