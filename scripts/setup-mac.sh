#!/bin/zsh
set -eu

# Run only after the system installation checkpoint is approved.
export HOMEBREW_NO_AUTO_UPDATE=1
export HOMEBREW_NO_INSTALL_CLEANUP=1
brew install gh rustup
source "${0:A:h}/env.sh"
rustup toolchain install stable --profile minimal
rustup default stable
if ! cargo tauri --version >/dev/null 2>&1; then
  cargo install tauri-cli --locked
fi

git --version
node --version
gh --version
rustc --version
cargo --version
cargo tauri --version
printf '\nNext: authenticate GitHub with gh auth login.\n'
