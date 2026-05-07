#!/bin/bash
export PATH="/usr/local/bin:/opt/homebrew/bin:$HOME/.cargo/bin:$PATH"
cd "$(dirname "$0")"
cargo tauri dev
