//! Generate Rust bindings from hymo_magic.h (single source of truth)
//!
//! Structs and protocol constants are bound from the C header.
//! Ioctl numbers use Linux _IOW/_IOR/_IO formula (matches kernel).

use std::env;
use std::path::PathBuf;

fn main() {
    println!("cargo:rerun-if-changed=../src/mount/hymo_magic.h");

    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let hymo_magic_h = manifest_dir.join("..").join("src").join("mount").join("hymo_magic.h");

    if !hymo_magic_h.exists() {
        panic!(
            "hymo_magic.h not found at {:?}. Build must run from hymo repo.",
            hymo_magic_h
        );
    }

    let bindings = bindgen::Builder::default()
        .header(hymo_magic_h.to_string_lossy())
        .parse_callbacks(Box::new(bindgen::CargoCallbacks::new()))
        .allowlist_type("hymo_.*")
        .allowlist_var("HYMO_MAGIC1")
        .allowlist_var("HYMO_MAGIC2")
        .allowlist_var("HYMO_PROTOCOL_VERSION")
        .allowlist_var("HYMO_CMD_GET_FD")
        .allowlist_var("HYMO_PRCTL_GET_FD")
        .allowlist_var("HYMO_MAX_LEN_PATHNAME")
        .allowlist_var("HYMO_UNAME_LEN")
        // Block HYMO_IOC_* - we compute from struct sizes using Linux formula
        .generate()
        .expect("Unable to generate bindings");

    let out_path = PathBuf::from(env::var("OUT_DIR").unwrap());
    bindings
        .write_to_file(out_path.join("hymo_magic.rs"))
        .expect("Couldn't write bindings");
}
