#!/bin/zsh
set -eu
cd "${0:A:h:h}"
app_path="$PWD/shell/spike/src-tauri/target/debug/bundle/macos/BASEMENT.app"
if [[ ! -d "$app_path" ]]; then zsh scripts/build-basement.command; fi
open "$app_path"
