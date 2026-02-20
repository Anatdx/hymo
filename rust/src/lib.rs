//! hymo-minimal: HymoFS Rust library for Android NDK
//!
//! ## API layers
//!
//! - **Raw**: `HymoIoctl`, `raw::cmd`, `raw_ioctl()`, `as_raw_fd()` - direct ioctl, full control
//! - **High**: `HymoFS` - convenient methods (clear_rules, add_rule, hide_path, etc.)
//!
//! ## Build for Android
//! ```bash
//! cargo install cargo-ndk
//! rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android
//! cargo ndk -t arm64-v8a -t armeabi-v7a -t x86_64 build --release
//! ```

pub mod hymofs;
pub mod ioctl;

// === High-level API ===
pub use hymofs::{HymoFS, HymoFSStatus};

// === Raw API ===
pub use ioctl::HymoIoctl;
pub use ioctl::cmd as raw_cmd;

// Protocol structs for raw ioctl (from hymo_magic.h)
pub use ioctl::{hymo_syscall_arg, hymo_syscall_list_arg, hymo_spoof_uname};

// Protocol constants
pub use ioctl::{
    HYMO_CMD_GET_FD, HYMO_MAGIC1, HYMO_MAGIC2, HYMO_MAX_LEN_PATHNAME, HYMO_PRCTL_GET_FD,
    HYMO_PROTOCOL_VERSION, HYMO_UNAME_LEN,
};
