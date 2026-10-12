# BASEMENT

Personal macOS design suite. Initial scope: ENDO (painting) and PRISM (image editing).

Read AGENTS.md for the project plan and STATUS.md for the current checkpoint.

## Environment

```sh
zsh scripts/check-environment.sh
```

Project scripts load Rust and GitHub CLI configuration from scripts/env.sh.
GitHub credentials stay in the macOS keychain, outside this repository.

## Source checkouts

```sh
git submodule update --init --recursive
```

ENDO retains its full history as a submodule at studios/endo. PhotoCraft lives at
vendor/photocraft, with BASEMENT integration work on endo-integration. Its main
branch remains aligned with upstream. Neither engine is modified during setup.

No BASEMENT application exists yet. Builds and launch instructions will be added
after the engine audits and architecture checkpoint.
