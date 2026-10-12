#!/bin/zsh
set -eu
cd "${0:A:h:h}"
source scripts/env.sh
mkdir -p shell/app/public/brand shell/app/public/icons
cp -R assets/brand/. shell/app/public/brand/
cp -R assets/icons/. shell/app/public/icons/
cd shell/app
# Reuse the existing local build cache; no PhotoCraft engine dependency in this phase.
export CARGO_TARGET_DIR="$PWD/../spike/src-tauri/target"
cargo tauri build --debug --bundles app
