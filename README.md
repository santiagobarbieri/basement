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
zsh scripts/setup-sources.sh
```

ENDO retains its full history as a submodule at studios/endo. PhotoCraft lives at
vendor/photocraft, with BASEMENT integration work on endo-integration. Its main
branch remains aligned with upstream. Neither engine is modified during setup.

## Engine audit previews

Double-click `scripts/run-endo.command` for the original ENDO editor or
`scripts/run-prism.command` for native PhotoCraft with the layered audit PSD.
These are engine previews; the BASEMENT shell and supplied visual design have not
been implemented yet. See `docs/audit/endo.md` and `docs/audit/prism.md` for evidence
and known limitations.
