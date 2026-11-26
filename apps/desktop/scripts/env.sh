#!/bin/sh
# Use the installed toolchain directly, avoiding rustup update checks during builds.
HABYSS_RUST_TOOLCHAIN="${HOME}/.rustup/toolchains/stable-$(uname -m)-apple-darwin"
if [ -x "$HABYSS_RUST_TOOLCHAIN/bin/rustc" ]; then
  export PATH="$HABYSS_RUST_TOOLCHAIN/bin:${HOME}/.cargo/bin:$PATH"
  # Some local Rust installs have an incomplete objcopy rpath. Scope its fallback to this toolchain.
  export DYLD_FALLBACK_LIBRARY_PATH="$HABYSS_RUST_TOOLCHAIN/lib${DYLD_FALLBACK_LIBRARY_PATH:+:$DYLD_FALLBACK_LIBRARY_PATH}"
fi
export CARGO_HOME="${CARGO_HOME:-${HOME}/.cargo}"
export MACOSX_DEPLOYMENT_TARGET=14.0
