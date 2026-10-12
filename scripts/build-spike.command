#!/bin/zsh
set -eu
cd "${0:A:h:h}"
source scripts/env.sh
mkdir -p .audit-runtime/tools shell/spike/public/prism .audit-runtime/spike
if [[ ! -x .audit-runtime/tools/trunk ]]; then
  gh release download v0.21.14 --repo trunk-rs/trunk --pattern trunk-aarch64-apple-darwin.tar.gz --dir .audit-runtime/tools
  tar -xzf .audit-runtime/tools/trunk-aarch64-apple-darwin.tar.gz -C .audit-runtime/tools
fi
rustup target add wasm32-unknown-unknown
root_dir="$PWD"
(
  cd vendor/photocraft/apps/photocraft-web
  CARGO_TARGET_DIR="$root_dir/.audit-runtime/wasm-target" env -u NO_COLOR "$root_dir/.audit-runtime/tools/trunk" build --release --dist "$root_dir/shell/spike/public/prism" --public-url ./
)
python3 - <<'PY'
from pathlib import Path
p=Path('shell/spike/public/prism/index.html')
s=p.read_text()
if '../frame-probe.js' not in s:
    p.write_text(s.replace('<head>', '<head>\n<script src="../frame-probe.js"></script>', 1))
PY
mkdir -p shell/spike/public/licenses
cp vendor/photocraft/LICENSE-APACHE vendor/photocraft/LICENSE-MIT vendor/photocraft/NOTICE vendor/photocraft/ATTRIBUTION.md shell/spike/public/licenses/
(
  cd shell/spike
  cargo tauri build --debug --bundles app
)
