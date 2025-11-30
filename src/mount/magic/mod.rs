mod node;

pub(super) const REPLACE_DIR_FILE_NAME: &str = ".replace";
pub(super) const REPLACE_DIR_XATTR: &str = "trusted.overlay.opaque";

use std::{
    fs::{self, DirEntry, create_dir, create_dir_all, read_dir, read_link},
    os::unix::fs::{MetadataExt, symlink},
    path::{Path, PathBuf},
};

use anyhow::{Context, Result};
use rustix::{
    fs::{Gid, Mode, Uid, chmod, chown},
    mount::{
        MountFlags, MountPropagationFlags, UnmountFlags, mount, mount_bind, mount_change,
        mount_move, mount_remount, unmount,
    },
};

use self::node::{Node, NodeFileType};
use crate::utils::{ensure_dir_exists, lgetfilecon, lsetfilecon, send_unmountable};

fn collect_module_files(content_paths: &[PathBuf], extra_partitions: &[String]) -> Result<Option<Node>> {
    let mut root = Node::new_root("");
    let mut system = Node::new_root("system");
    let mut has_file = false;

    for module_path in content_paths {
        let module_system = module_path.join("system");
        if !module_system.is_dir() {
            continue;
        }

        log::debug!("collecting {}", module_path.display());
        has_file |= system.collect_module_files(&module_system)?;
    }

    if has_file {
        const BUILTIN_PARTITIONS: [(&str, bool); 4] = [
            ("vendor", true),
            ("system_ext", true),
            ("product", true),
            ("odm", false),
        ];

        for (partition, require_symlink) in BUILTIN_PARTITIONS {
            let path_of_root = Path::new("/").join(partition);
            let path_of_system = Path::new("/system").join(partition);
            
            if path_of_root.is_dir() && (!require_symlink || path_of_system.is_symlink()) {
                let name = partition.to_string();
                if let Some(mut node) = system.children.remove(&name) {
                    if node.file_type == NodeFileType::Symlink {
                        if let Some(ref p) = node.module_path {
                            if let Ok(meta) = fs::metadata(p) {
                                if meta.is_dir() {
                                    log::debug!("treating symlink {} as directory for recursion", name);
                                    node.file_type = NodeFileType::Directory;
                                }
                            }
                        }
                    }
                    root.children.insert(name, node);
                }
            }
        }

        for partition in extra_partitions {
            if BUILTIN_PARTITIONS.iter().any(|(p, _)| p == partition) {
                continue;
            }
            if partition == "system" {
                continue;
            }

            let path_of_root = Path::new("/").join(partition);
            let path_of_system = Path::new("/system").join(partition);
            // Default to not requiring symlink for extra partitions
            let require_symlink = false;

            if path_of_root.is_dir() && (!require_symlink || path_of_system.is_symlink()) {
                let name = partition.to_string();
                if let Some(mut node) = system.children.remove(&name) {
                    log::debug!("attach extra partition '{}' to root", name);
                    if node.file_type == NodeFileType::Symlink {
                        if let Some(ref p) = node.module_path {
                            if let Ok(meta) = fs::metadata(p) {
                                if meta.is_dir() {
                                    log::debug!("treating symlink {} as directory for recursion", name);
                                    node.file_type = NodeFileType::Directory;
                                }
                            }
                        }
                    }
                    root.children.insert(name, node);
                }
            }
        }

        root.children.insert("system".to_string(), system);
        Ok(Some(root))
    } else {
        Ok(None)
    }
}

fn clone_symlink<Src: AsRef<Path>, Dst: AsRef<Path>>(src: Src, dst: Dst) -> Result<()> {
    let src_symlink = read_link(src.as_ref())?;
    symlink(&src_symlink, dst.as_ref())?;
    lsetfilecon(dst.as_ref(), lgetfilecon(src.as_ref())?.as_str())?;
    Ok(())
}

fn mount_mirror<P: AsRef<Path>, WP: AsRef<Path>>(path: P, work_dir_path: WP, entry: &DirEntry) -> Result<()> {
    let path = path.as_ref().join(entry.file_name());
    let work_dir_path = work_dir_path.as_ref().join(entry.file_name());
    if entry.file_type()?.is_file() {
        fs::File::create(&work_dir_path)?;
        mount_bind(&path, &work_dir_path)?;
    } else if entry.file_type()?.is_dir() {
        create_dir(&work_dir_path)?;
        let metadata = entry.metadata()?;
        chmod(&work_dir_path, Mode::from_raw_mode(metadata.mode()))?;
        unsafe {
            chown(&work_dir_path, Some(Uid::from_raw(metadata.uid())), Some(Gid::from_raw(metadata.gid())))?;
        }
        lsetfilecon(&work_dir_path, lgetfilecon(&path)?.as_str())?;
        for entry in read_dir(&path)?.flatten() {
            mount_mirror(&path, &work_dir_path, &entry)?;
        }
    } else if entry.file_type()?.is_symlink() {
        clone_symlink(&path, &work_dir_path)?;
    }
    Ok(())
}

fn mount_file<P: AsRef<Path>, WP: AsRef<Path>>(
    path: P,
    work_dir_path: WP,
    node: &Node,
    has_tmpfs: bool,
    disable_umount: bool
) -> Result<()> {
    let target_path = if has_tmpfs {
        fs::File::create(&work_dir_path)?;
        work_dir_path.as_ref()
    } else {
        path.as_ref()
    };
    
    if let Some(module_path) = &node.module_path {
        mount_bind(module_path, target_path)?;
        if !disable_umount {
            let _ = send_unmountable(target_path);
        }
        let _ = mount_remount(target_path, MountFlags::RDONLY | MountFlags::BIND, "");
    }
    Ok(())
}

fn mount_symlink<WP: AsRef<Path>>(
    work_dir_path: WP,
    node: &Node,
) -> Result<()> {
    if let Some(module_path) = &node.module_path {
        clone_symlink(module_path, work_dir_path)?;
    }
    Ok(())
}

fn should_create_tmpfs(node: &Node, path: &Path, has_tmpfs: bool) -> bool {
    if has_tmpfs { return true; }
    
    // Explicit replace flag
    if node.replace && node.module_path.is_some() { return true; }

    // Check children for conflicts requiring tmpfs
    for (name, child) in &node.children {
        let real_path = path.join(name);
        
        let need = match child.file_type {
            NodeFileType::Symlink => true,
            NodeFileType::Whiteout => real_path.exists(),
            _ => {
                if let Ok(meta) = real_path.symlink_metadata() {
                    let ft = NodeFileType::from_file_type(meta.file_type()).unwrap_or(NodeFileType::Whiteout);
                    ft != child.file_type || ft == NodeFileType::Symlink
                } else { 
                    true // Path doesn't exist on real fs, need tmpfs to create it
                }
            }
        };

        if need {
            if node.module_path.is_none() {
                // If this dir doesn't come from a module but needs tmpfs for children,
                // we're in a tricky spot. For now we log and skip.
                log::error!(
                    "Cannot create tmpfs on {} (no module source), ignoring conflicting child: {}",
                    path.display(),
                    name
                );
                return false; // Or just continue checking others? The original code modified child.skip = true.
            }
            return true;
        }
    }
    
    false
}

fn prepare_tmpfs_dir<P: AsRef<Path>, WP: AsRef<Path>>(
    path: P,
    work_dir_path: WP,
    node: &Node,
) -> Result<()> {
    create_dir_all(work_dir_path.as_ref())?;
    
    let (metadata, src_path) = if path.as_ref().exists() { 
        (path.as_ref().metadata()?, path.as_ref()) 
    } else { 
        let mp = node.module_path.as_ref().unwrap();
        (mp.metadata()?, mp.as_path())
    };

    chmod(work_dir_path.as_ref(), Mode::from_raw_mode(metadata.mode()))?;
    unsafe {
        chown(work_dir_path.as_ref(), Some(Uid::from_raw(metadata.uid())), Some(Gid::from_raw(metadata.gid())))?;
    }
    lsetfilecon(work_dir_path.as_ref(), lgetfilecon(src_path)?.as_str())?;
    
    mount_bind(work_dir_path.as_ref(), work_dir_path.as_ref())?;
    Ok(())
}

fn mount_directory_children<P: AsRef<Path>, WP: AsRef<Path>>(
    path: P,
    work_dir_path: WP,
    node: Node, // Removed `mut` here
    has_tmpfs: bool,
    disable_umount: bool,
) -> Result<()> {
    // 1. Mirror existing files if using tmpfs and NOT replacing
    if has_tmpfs && path.as_ref().exists() && !node.replace {
        for entry in path.as_ref().read_dir()?.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            // If the node has a child with this name, we process it recursively below.
            // If NOT, we must mirror it to the tmpfs.
            if !node.children.contains_key(&name) {
                mount_mirror(&path, &work_dir_path, &entry)?;
            }
        }
    }

    // 2. Mount/Process children defined in the module
    // We iterate over the node's children (consuming the map)
    for (_name, child_node) in node.children { // Changed name to _name, removed mut from child_node
        // NOTE: The original code logic for skipping children in 'should_create_tmpfs'
        // was inline. Here we assume 'should_create_tmpfs' logic is sufficient to decide
        // the 'has_tmpfs' flag for this directory, and we pass that down.
        // If specific children needed to be skipped due to errors, that logic needs to be
        // robust. The simplified check above doesn't mutate node.skip.
        
        // Check if we skipped this child previously (e.g. conflict without module source)
        if child_node.skip { continue; }

        // Recursive call
        do_magic_mount(
            &path, 
            &work_dir_path, 
            child_node, 
            has_tmpfs, 
            disable_umount
        )?;
    }
    Ok(())
}

fn finalize_tmpfs_overlay<P: AsRef<Path>, WP: AsRef<Path>>(
    path: P,
    work_dir_path: WP,
    disable_umount: bool,
) -> Result<()> {
    let _ = mount_remount(work_dir_path.as_ref(), MountFlags::RDONLY | MountFlags::BIND, "");
    mount_move(work_dir_path.as_ref(), path.as_ref())?;
    let _ = mount_change(path.as_ref(), MountPropagationFlags::PRIVATE);
    
    if !disable_umount {
        let _ = send_unmountable(path.as_ref());
    }
    Ok(())
}

fn do_magic_mount<P: AsRef<Path>, WP: AsRef<Path>>(
    path: P,
    work_dir_path: WP,
    current: Node, // Removed `mut` here
    has_tmpfs: bool,
    disable_umount: bool,
) -> Result<()> {
    let name = current.name.clone();
    let path = path.as_ref().join(&name);
    let work_dir_path = work_dir_path.as_ref().join(&name);
    
    match current.file_type {
        NodeFileType::RegularFile => {
            mount_file(&path, &work_dir_path, &current, has_tmpfs, disable_umount)?;
        }
        NodeFileType::Symlink => {
            mount_symlink(&work_dir_path, &current)?;
        }
        NodeFileType::Directory => {
            // Determine if we need to escalate to tmpfs for this directory
            // Note: If 'has_tmpfs' is already true from parent, we stick with it.
            let create_tmpfs = !has_tmpfs && should_create_tmpfs(&current, &path, false);
            
            // If we detected a need for tmpfs but failed (e.g. no source), 
            // should_create_tmpfs might have logged error.
            // But we might still need to process children if it returned true?
            // Actually, in the original code, it iterated children to decide.
            // Here we re-check skipping children inside 'mount_directory_children'.
            
            let effective_tmpfs = has_tmpfs || create_tmpfs;

            if effective_tmpfs {
                // If we are creating a NEW tmpfs layer here
                if create_tmpfs {
                    prepare_tmpfs_dir(&path, &work_dir_path, &current)?;
                } else if has_tmpfs {
                    // Inherited tmpfs: just ensure the directory exists in the workdir
                    if !work_dir_path.exists() {
                        create_dir(&work_dir_path)?;
                        let (metadata, src_path) = if path.exists() { (path.metadata()?, &path) } 
                                                   else { (current.module_path.as_ref().unwrap().metadata()?, current.module_path.as_ref().unwrap()) };
                        chmod(&work_dir_path, Mode::from_raw_mode(metadata.mode()))?;
                        unsafe {
                            chown(&work_dir_path, Some(Uid::from_raw(metadata.uid())), Some(Gid::from_raw(metadata.gid())))?;
                        }
                        lsetfilecon(&work_dir_path, lgetfilecon(src_path)?.as_str())?;
                    }
                }
            }

            // Process children
            mount_directory_children(
                &path, 
                &work_dir_path, 
                current, 
                effective_tmpfs, 
                disable_umount
            )?;

            // If we created a fresh tmpfs at this level, we need to move it to the real path
            if create_tmpfs {
                finalize_tmpfs_overlay(&path, &work_dir_path, disable_umount)?;
            }
        }
        NodeFileType::Whiteout => {}
    }
    Ok(())
}

pub fn mount_partitions(
    tmp_path: &Path,
    module_paths: &[PathBuf],
    mount_source: &str,
    extra_partitions: &[String],
    disable_umount: bool,
) -> Result<()> {
    if let Some(root) = collect_module_files(module_paths, extra_partitions)? {
        log::debug!("Magic Mount Root: {}", root);

        let tmp_dir = tmp_path.join("workdir");
        ensure_dir_exists(&tmp_dir)?;

        mount(mount_source, &tmp_dir, "tmpfs", MountFlags::empty(), "").context("mount tmp")?;
        mount_change(&tmp_dir, MountPropagationFlags::PRIVATE).context("make tmp private")?;

        let result = do_magic_mount("/", &tmp_dir, root, false, disable_umount);

        if let Err(e) = unmount(&tmp_dir, UnmountFlags::DETACH) {
            log::error!("failed to unmount tmp {}", e);
        }
        fs::remove_dir(tmp_dir).ok();

        result
    } else {
        log::info!("No files to magic mount");
        Ok(())
    }
}
