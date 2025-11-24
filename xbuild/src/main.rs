mod zip_ext;

use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
};

use anyhow::Result;
use fs_extra::{dir, file};
use zip::{CompressionMethod, write::FileOptions};

use crate::zip_ext::zip_create_from_directory_with_options;

fn main() -> Result<()> {
    // 1. Define build output directory (CI will upload this directly)
    let build_dir = Path::new("output").join("module_files");

    // Clean and create output directory
    if build_dir.exists() {
        fs::remove_dir_all(&build_dir)?;
    }
    fs::create_dir_all(&build_dir)?;

    // 2. [CRITICAL] Build WebUI FIRST, so module/webroot is populated before copy
    build_webui()?;

    // 3. Compile Rust Binary (meta-hybrid) for Android
    // Note: cargo-ndk is called here internally
    let mut cargo = cargo_ndk();
    let args = vec![
        "build",
        "--target",
        "aarch64-linux-android",
        "-Z",
        "build-std",
        "-Z",
        "trim-paths",
        "--release",
    ];
    cargo.args(args);

    let status = cargo.spawn()?.wait()?;
    if !status.success() {
        anyhow::bail!("Cargo build failed");
    }

    // 4. Copy module directory to output
    // Now includes the freshly built webroot
    let module_dir = module_dir();
    dir::copy(
        &module_dir,
        &build_dir,
        &dir::CopyOptions::new().overwrite(true).content_only(true),
    )?;
    
    // Cleanup
    if build_dir.join(".gitignore").exists() {
        fs::remove_file(build_dir.join(".gitignore"))?;
    }

    // 5. Inject Dynamic Version (v0.x.x-gXXXXXX)
    // And write version to output/version for GitHub Actions
    let version = inject_version(&build_dir).unwrap_or_else(|e| {
        println!("Warning: Failed to inject version: {}", e);
        "unknown".to_string()
    });
    fs::write(Path::new("output").join("version"), &version)?;

    // 6. Copy compiled binary
    file::copy(
        bin_path(),
        build_dir.join("meta-hybrid"),
        &file::CopyOptions::new().overwrite(true),
    )?;

    // 7. Create Zip (Local Backup / Verification)
    // CI will upload the folder structure directly
    let options = FileOptions::<()>::default()
        .compression_method(CompressionMethod::Deflated)
        .compression_level(Some(9));
        
    let zip_name = format!("meta-hybrid-{}.zip", version);
    let output_zip = Path::new("output").join(zip_name);
    
    zip_create_from_directory_with_options(
        &output_zip,
        &build_dir,
        |_| options,
    )?;

    println!("Build success: {}", output_zip.display());
    println!("Module directory prepared at: {}", build_dir.display());
    
    Ok(())
}

fn inject_version(target_dir: &Path) -> Result<String> {
    // Get git short hash
    let output = Command::new("git")
        .args(["rev-parse", "--short", "HEAD"])
        .output()?;
    
    if !output.status.success() {
        return Ok("v0.0.0".to_string());
    }
    
    let hash = String::from_utf8(output.stdout)?.trim().to_string();
    let prop_path = target_dir.join("module.prop");
    let mut full_version = format!("v0.0.0-g{}", hash);

    if prop_path.exists() {
        let content = fs::read_to_string(&prop_path)?;
        let mut new_lines = Vec::new();
        
        for line in content.lines() {
            if line.starts_with("version=") {
                // Append hash to version: version=v0.3.0-g1a2b3c
                let base = line.trim().strip_prefix("version=").unwrap_or("");
                full_version = format!("{}-g{}", base, hash);
                new_lines.push(format!("version={}", full_version));
            } else {
                new_lines.push(line.to_string());
            }
        }
        
        fs::write(prop_path, new_lines.join("\n"))?;
        println!("Injected version: {}", full_version);
    }
    
    Ok(full_version)
}

fn module_dir() -> PathBuf {
    Path::new("module").to_path_buf()
}

fn bin_path() -> PathBuf {
    Path::new("target")
        .join("aarch64-linux-android")
        .join("release")
        .join("meta-hybrid")
}

fn cargo_ndk() -> Command {
    let mut command = Command::new("cargo");
    // Inner cargo-ndk call handles the cross-compilation
    command
        .args(["ndk", "--platform", "30", "-t", "arm64-v8a"])
        .env("RUSTFLAGS", "-C default-linker-libraries")
        .env("CARGO_CFG_BPF_TARGET_ARCH", "aarch64");
    command
}

fn build_webui() -> Result<()> {
    println!("Building WebUI...");
    let npm = || {
        let mut command = if cfg!(windows) {
            let mut c = Command::new("cmd");
            c.args(["/C", "npm"]);
            c
        } else {
            Command::new("npm")
        };
        command.current_dir("webui");
        command
    };

    let status = npm().arg("install").spawn()?.wait()?;
    if !status.success() { anyhow::bail!("npm install failed"); }
    
    let status = npm().args(["run", "build"]).spawn()?.wait()?;
    if !status.success() { anyhow::bail!("npm run build failed"); }

    Ok(())
}
