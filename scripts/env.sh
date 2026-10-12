#!/bin/zsh

# Keep project tool paths local to the current shell; do not edit user dotfiles.
export PATH="/opt/homebrew/opt/rustup/bin:$HOME/.cargo/bin:$PATH"
export GH_CONFIG_DIR="$HOME/Library/Application Support/BASEMENT/gh"
