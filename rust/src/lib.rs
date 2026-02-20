//! hymo-minimal: HymoFS Rust static library for Android NDK
//!
//! Produces `libhymo_minimal.a` for linking in NDK/CMake builds.
//!
//! ## Build for Android
//! ```bash
//! cargo install cargo-ndk
//! rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android
//! cargo ndk -t arm64-v8a -t armeabi-v7a -t x86_64 build --release
//! ```
//!
//! Output: `target/<triple>/release/libhymo_minimal.a`

pub mod hymofs;
pub mod ioctl;

pub use hymofs::{HymoFS, HymoFSStatus};
pub use ioctl::HymoIoctl;

// Re-export protocol constants from hymo_magic.h
pub use ioctl::{
    HYMO_CMD_GET_FD, HYMO_MAGIC1, HYMO_MAGIC2, HYMO_MAX_LEN_PATHNAME, HYMO_PRCTL_GET_FD,
    HYMO_PROTOCOL_VERSION, HYMO_UNAME_LEN,
};
