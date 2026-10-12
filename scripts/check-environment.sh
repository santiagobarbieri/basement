#!/bin/zsh
set -eu
source "${0:A:h}/env.sh"

git --version
node --version
npm --version
brew --version
rustc --version
cargo --version
cargo tauri --version
xcode-select -p

# Compile and run a dependency-free Rust program to check the compiler and linker.
check_dir=$(mktemp -d "${TMPDIR:-/tmp}/basement-env.XXXXXX")
trap 'rm -f "$check_dir/check.rs" "$check_dir/check"; rmdir "$check_dir"' EXIT
printf '%s\n' 'fn main() { println!("Rust compile and run: OK"); }' > "$check_dir/check.rs"
rustc "$check_dir/check.rs" -o "$check_dir/check"
"$check_dir/check"
node -e 'console.log("Node execution: OK")'

# Authentication verification requires network and macOS keychain access.
gh auth status
gh api user --jq .login
