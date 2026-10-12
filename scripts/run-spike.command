#!/bin/zsh
set -eu
cd "${0:A:h:h}"
source scripts/env.sh
app_path="$PWD/shell/spike/src-tauri/target/debug/bundle/macos/BASEMENT Architecture Preview.app"
if [[ ! -d "$app_path" ]] || [[ ! -f shell/spike/public/prism/index.html ]]; then
  zsh scripts/build-spike.command
fi
mkdir -p .audit-runtime/spike
if [[ ! -f .audit-runtime/spike/input.psd ]]; then
  cp docs/audit/evidence/prism-test.psd .audit-runtime/spike/input.psd
fi
export BASEMENT_SPIKE_WORKSPACE="$PWD"
open -n "$app_path"
