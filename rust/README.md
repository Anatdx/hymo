# hymo-minimal (Rust)

HymoFS 的 Rust 静态库，供 Android NDK 构建引入。

## 构建

```bash
# 安装 cargo-ndk
cargo install cargo-ndk

# 添加 Android target
rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android

# 构建
./build-ndk.sh
# 或
cargo ndk -t arm64-v8a -t armeabi-v7a -t x86_64 build --release
```

输出：`target/<triple>/release/libhymo_minimal.a`

## NDK/CMake 集成

1. 将 `libhymo_minimal.a` 复制到 `jniLibs/<abi>/` 或通过 CMake 指定路径
2. 链接：`target_link_libraries(your_target hymo_minimal)`
3. 头文件：`include/hymo_minimal.h`

### CMake 示例

```cmake
add_library(hymo_minimal STATIC IMPORTED)
set_target_properties(hymo_minimal PROPERTIES
    IMPORTED_LOCATION ${CMAKE_SOURCE_DIR}/path/to/libhymo_minimal.a)
target_link_libraries(your_app hymo_minimal)
```

## C API

```c
int hymo_check_status(void);   // 0=Available, 1=NotPresent, 2=KernelTooOld, 3=ModuleTooOld
int hymo_clear_rules(void);    // 清空所有规则
int hymo_fix_mounts(void);     // 修复 mount namespace
int hymo_set_enabled(int);     // 启用/禁用 HymoFS
```

## Rust API

### 高层接口 (High-level)

```rust
use hymo_minimal::{HymoFS, HymoFSStatus};

if HymoFS::is_available() {
    HymoFS::clear_rules()?;
    HymoFS::add_rule("/system/app/foo", "/data/adb/modules/bar/system/app/foo", 8)?;
    HymoFS::set_enabled(true)?;
}
```

### 底层接口 (Raw)

直接 ioctl，适合需要完全控制的场景：

```rust
use hymo_minimal::{HymoIoctl, raw_cmd, hymo_syscall_arg};
use std::ffi::CString;

let io = HymoIoctl::get_fd()?;

// 方式 1：使用封装方法
io.add_rule("/path/target", "/path/source", 8)?;

// 方式 2：raw_ioctl + 内核结构体
let src = CString::new("/path/source")?;
let target = CString::new("/path/target")?;
let arg = hymo_syscall_arg {
    src: src.as_ptr(),
    target: target.as_ptr(),
    type_: 8,
};
io.raw_ioctl(raw_cmd::ADD_RULE, &arg as *const _ as *mut _)?;

// 获取原始 fd（poll/select 等）
let fd = io.as_raw_fd();
```
