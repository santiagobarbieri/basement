#!/bin/zsh
set -eu
cd "${0:A:h:h}"
source scripts/env.sh
if [[ ! -x vendor/photocraft/target/release/photocraft ]]; then
  cargo build --locked --release --manifest-path vendor/photocraft/Cargo.toml -p photocraft
fi
mkdir -p .audit-runtime/photocraft-config
export PHOTOCRAFT_CONFIG_DIR="$PWD/.audit-runtime/photocraft-config"
exec vendor/photocraft/target/release/photocraft "$PWD/docs/audit/evidence/prism-test.psd"
