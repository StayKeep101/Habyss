#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
. scripts/env.sh
bun run check
bun run test
cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path apps/desktop/src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
bun run --cwd apps/desktop build
sh scripts/build-widgets.sh
