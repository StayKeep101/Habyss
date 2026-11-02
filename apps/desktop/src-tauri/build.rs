use std::{env, path::PathBuf, process::Command};
fn main() {
    if env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
        let out = PathBuf::from(env::var("OUT_DIR").unwrap());
        let architecture = if env::var("CARGO_CFG_TARGET_ARCH").as_deref() == Ok("x86_64") { "x86_64-apple-macosx14.0" } else { "arm64-apple-macosx14.0" };
        let status = Command::new("swiftc").args(["-parse-as-library", "-emit-library", "-static", "-module-name", "HabyssNative", "-target", architecture, "-module-cache-path"]).arg(out.join("swift-cache")).arg("native/Collector.swift").arg("-o").arg(out.join("libHabyssNative.a")).status().expect("Swift compiler required");
        assert!(status.success(), "Swift native bridge failed to compile");
        println!("cargo:rustc-link-search=native={}", out.display());
        println!("cargo:rustc-link-lib=static=HabyssNative");
        println!("cargo:rustc-link-search=native=/usr/lib/swift");
        println!("cargo:rustc-link-arg=-Wl,-rpath,/usr/lib/swift");
        for framework in ["AppKit", "ApplicationServices", "CoreGraphics", "Foundation", "WidgetKit"] { println!("cargo:rustc-link-lib=framework={framework}"); }
        println!("cargo:rerun-if-changed=native/Collector.swift");
    }
    tauri_build::build();
}
