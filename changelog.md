## v0.3.0

Initial release.
* ci: fully disable zakosign (clone, build, sign steps)
* fix: clone zakosign in CI before building
* 初次提交
* [skip ci] Update KernelSU json and changelog for v0.2.8-r8
* docs: split README into English and Chinese versions
* fix(log): enforce newlines and standard format
* [skip ci] Update KernelSU json and changelog for v0.2.8-r7
* fix(utils): resolve compilation error in log formatter
* fix(build): resolve rustc errors in utils and main
* style(log): unify log format to [LEVEL] and remove timestamp
* feat(core): implement smart sync to improve boot performance
* fix(planner): resolve symlink partitions instead of skipping them
* [skip ci] Update KernelSU json and changelog for v0.2.8-r5
* fix(mount): remove unused bail import and umount_dir function
* feat(overlayfs): port robust mounting logic and child restoration from meta-overlayfs
* fix(core): remove unused constants and utilities after nuke refactor
* refactor(nuke): remove nuke module and lkm binaries, integrate stealth logic into main
* feat(log): upgrade to tracing with panic hooks and file logging
* fix(core): resolve unused variable warnings in inventory and planner
* 	modified:   src/core/mod.rs
* Reapply "chore(deps): enable `no_thp`, `override` for mimalloc"
* refactor(core): remove legacy sync logic from modules.rs
* ix(executor): adapt to new planner and finalize main integration
* feat(planner): implement classification pipeline and conflict detection
* refactor(core): decouple storage and split modules.rs into inventory/sync
* Revert "chore(deps): enable `no_thp`, `override` for mimalloc"
* fix(utils): ensure copy_path_context is exported to fix build error
* refactor: overhaul mount logic (skip empty, wipe sync, relocate mount point)
* [skip ci] Update KernelSU json and changelog for v0.2.8-r4
* feat(planner): skip mounting modules or partitions that contain only empty directories
* [skip ci] Update KernelSU json and changelog for v0.2.8-r3
* Revert "feat(selinux): implement intelligent context mirroring"
* Revert "feat(mount): optimize overlayfs with `override_creds=off`"
* Revert "feat(core): implement deterministic module ordering (Z-A) and file conflict detection"
* Revert "feat(webui): display file conflict warnings in status tab"
* feat(mount): optimize overlayfs with `override_creds=off`
* feat(selinux): implement intelligent context mirroring
* Revert "feat(module): add Disclaimer for customize.sh"
* [skip ci] Update KernelSU json and changelog for v0.2.8-r1
* bump to v0.2.8
* fix(utils): remove unused `PermissionsExt` import
* 	modified:   Cargo.toml
* refactor: merge magic mount implementation into single file
* fix: resolve dependency downgrades and compiler warnings
* perf: optimize binary size and implement native directory sync
* refactor: unify partitions list and clean up magic mount logic
* fix(utils): move magic mount workspace to module run directory
* build(xtask): implement SSOT for shared constants
* [skip ci] Update KernelSU json and changelog for v0.2.7-r2
* feat(webui): implement system-following auto theme mode with 3-state toggle
* chore(deps): enable `no_thp`, `override` for mimalloc
* [skip ci] Update KernelSU json and changelog for v0.2.7-r1
* bump version to 0.2.7
* fix(core): import serde Serialize and Deserialize traits in planner.rs
* feat(webui): display file conflict warnings in status tab
* feat(core): implement deterministic module ordering (Z-A) and file conflict detection
* [skip ci] Update KernelSU json and changelog for v0.2.6-@44b3998
* fix(core): import Path struct in main.rs to resolve compilation errors
* fix(core): import PathBuf in modules.rs and clean up main imports
* refactor: reorganize source code into conf, core, and mount modules
* Merge branch 'refactor/mount-planner'
* fix(core): remove unused imports in main and executor to resolve build warnings
* fix(core): implement overlay fallback mechanism and return execution stats
* refactor(core): decouple logic with Mount Planner and Executor
* [skip ci] Update KernelSU json and changelog for v0.2.6-@060b70d
* fix(core): resolve build error in utils and unused import in storage
* 	modified:   Cargo.toml
* refactor(core): implement centralized JSON state management and update consumers
* fix(core): remove unused dynamic mount point functions to resolve build warnings
* feat(installer): disable ext4 journal on image creation to prevent jbd2 detection
* perf: replace system allocator with mimalloc for improved performance
* fix(core): prune stale or disabled modules from storage during sync to prevent zombie mounts
* fix(core): disable dynamic decoy mount point and enforce static path at /data/adb/meta-hybrid/mnt
* [skip ci] Update KernelSU json and changelog for v0.2.6-@3f15668
* bump to v0.2.6
* fix: remove dead rust code
* Add co-authors
* feat(webui): add active partition indicators to status tab
* fix(webui): stack system info items vertically to prevent overflow
* feat(webui): add real-time system info card to status tab
* [skip ci] Update KernelSU json and changelog for v0.2.5-@3d6acf9
* fix(webui): use dynamic monet colors for storage status badges to improve visibility
* [skip ci] Update KernelSU json and changelog for v0.2.5-@d4e5604
* Bump version to 0.2.5
* feat: add disable_umount config to skip namespace detaching
* [skip ci] Update KernelSU json and changelog for v0.2.5-@4f89dd4
* style: rename 'Nuke' to 'Paw Pad/肉垫' across UI and logs
* fix(core): ignore lost+found directory in module scan to correct overlay count
* [skip ci] Update KernelSU json and changelog for v0.2.5-@05321aa
* fix: add missing rustix::path::Arg import to resolve compilation error
* feat(webui): move module mode selector to details panel for better layout
* feat: implement SukiSU nuke_ext4_sysfs via ioctl with LKM fallback
* fix(nuke): silence expected insmod errors and optimize stealth logic
* [skip ci] Update KernelSU json and changelog for v0.2.5-@a155c7f
* fix: resolve unused import and dead code warnings
* [skip ci] Update KernelSU json and changelog for v0.2.5-@39238d1
* Merge branch 'refactor/modular-architecture'
* feat: implement process masquerading and randomized decoy mount points
* refactor: decompose main.rs into cli, storage, nuke, and modules
* [skip ci] Update KernelSU json and changelog for v0.2.4-@9760bd5
* bump version to v0.2.4
* 	modified:   module/customize.sh
* feat(core): move try_umount to utils and apply to overlay mounts
* 	modified:   src/magic_mount/mod.rs
* chore: make clippy happy
* [skip ci] Update KernelSU json and changelog for v0.2.2-@5b5065
* feat(core+webui): use state file for reliable storage mode reporting
* 	modified:   module/module.prop
* [skip ci] Update KernelSU json and changelog for v0.2.2-33339ae
* fix(core): resolve symlinks before checking mount type to fix unknown status
* fix(webui): resolve svelte 5 state issues, a11y warnings and vite import conflicts
* [skip ci] Update KernelSU json and changelog for v0.2.2-b5e59ea
* feat(webui): auto-detect languages and display names from locale files
* feat: rename ZHS and ZHT
* feat(webui): add Spanish and Traditional Chinese support
* chore(webui): remove deprecated locate.json and add missing translation keys
* refactor(webui): extract styles and unify refresh button appearance
* refactor(webui): centralize hardcoded paths and improve api robustness
* feat(webui): auto-close language menu on outside click
* feat(ux): expose storage filesystem type in status tab
* Merge branch 'refactor/config-sync-json'
* feat(webui): optimize log viewer with tail read and auto-refresh
* refactor(core): switch config synchronization to JSON based communication
* [skip ci] Update KernelSU json and changelog for v0.2.2-stable
* Merge branch 'refactor/webui-i18n-split'
* feat(webui): update NavBar to support dynamic locale list
* refactor(webui): update store to load locales dynamically
* refactor(webui): split locate.json into separate locale files
* Merge remote-tracking branch 'origin/master'
* [skip ci] Update KernelSU json and changelog for v0.2.2-@7f7ef55
* fix(ci): reset working directory before switching to master in release workflow
* Merge branch 'feat/catgirl-status'
* add a space
* fix(core): resolve build errors (borrow of moved value) and unused variables
* feat(ui): implement dynamic catgirl-style module.prop description updates
* Merge pull request #9 from YuzakiKokuban/feat/stealth-infrastructure
* fix(core): resolve storage reporting, fix nuke lkm address visibility, and enhance logging
* 	modified:   README.md
* fix A11y warning
* feat(core): implement smart storage, true hybrid mount, and nuke logic
* feat: implement stealth config, webui settings, and core utils
* hore(legal): setup GPLv2 compliance structure and import nuke LKM resources
* [skip ci] Update KernelSU json and changelog for v0.2.2-@e8fa7c0
* Merge pull request #8 from YuzakiKokuban/feat/true-hybrid-mode
* fix(webui): unify typography in Status dashboard stats cards
* Merge pull request #7 from YuzakiKokuban/webui-navbar-scroll
* fix(webui): ensure active tab is always visible in NavBar
* feat(core): enable mixed mount mode allowing OverlayFS and Magic Mount coexistence per partition
* [skip ci]Update README.md
* Merge pull request #6 from YuzakiKokuban/feature/backend-module-scanning
* fix(webui): resolve a11y warnings in ModulesTab
* fix(core): add missing serde_json dependency
* feat(webui): update ModulesTab to display rich module details
* feat(webui): switch module scanning to backend binary
* feat(core): implement 'modules' command for detailed inspection
* feat(webui): apply Skeleton loading to Modules and Logs tabs
* feat(webui): add Skeleton and Toast UI components
* feat(webui): update storage API to use meta-hybrid binary
* feat(core): implement 'storage' command for JSON output
* fix(webui): remove unstable share/export button from LogsTab
* feat(webui): implement status dashboard UI components
* feat(webui): add infrastructure for status dashboard
* feat(webui): implement logs copy and export functionality
* feat(webui): add localization for logs export actions
* feat(webui): add copy and share icons to constants
* feat(webui): implement log filtering, search, and auto-scroll
* style(webui): add styles for logs control bar
* feat(webui): add localization for log filtering and search
* Merge pull request #5 from YuzakiKokuban/feature/webui-modules-search
* fix(webui): remove syntax error (typo) in constants.js
* feat(webui): implement search and filter logic in ModulesTab
* style(webui): add styles for module search bar and filter controls
* feat(webui): add search icon to constants
* feat(webui): add localization strings for module search and filter
* [skip ci] Update KernelSU json and changelog for v0.2.2-@15a6f69
* Merge pull request #4 from YuzakiKokuban/style/improve-log-readability
* Merge pull request #3 from YuzakiKokuban/feature/smart-tmpfs-fallback
* style: improve magic mount node tree logging readability
* refactor: improve temp dir selection and error logging mechanism
* feat: SELinux fix
* fix: remove unused constant MODULE_METADATA_DIR
* feat: implement smart tmpfs storage and boot-time sync
* feat: implement smart tmpfs storage with image fallback
* Revert "feat:Add SuSFS support"
* fix(core): treat symlink nodes as directories if they point to directories to allow magic mount recursion on root partitions
* Revert "feat(ci): integrate zakosign for module signing"
* Revert "fix(xtask): correct zakosign cli arguments"
* Revert "chore: add zakosign binaries for CI signing"
* style(core): remove unused 'bail' import to clean up compiler warnings
* fix(core): prevent creating tmpfs on root nodes without module source to avoid disk exhaustion
* fix(xtask): correct zakosign cli arguments
* feat(ci): integrate zakosign for module signing
* chore: add zakosign binaries for CI signing
* fix(core): ignore PermissionDenied in lsetfilecon to prevent magic mount failure on tmpfs
* remove zakosign
* [skip ci] Update KernelSU json and changelog for v0.2.2-@c3d0af0
* Merge pull request #2 from YuzakiKokuban/feature/xtask-build
* 	deleted:    src/engine.rs 	deleted:    src/logger.rs 	modified:   src/main.rs 	deleted:    src/scanner.rs 	modified:   src/utils.rs
*     modified:   src/engine.rs 	modified:   src/logger.rs 	modified:   src/main.rs 	modified:   src/scanner.rs
* fix(xtask): clean up unused imports
* fix(xtask): correct module file copy destination
* 	modified:   xtask/src/main.rs
* build: temporarily disable zakosign integration
* fix(xtask): disable unnecessary android builds for zakosign
* ci: optimize workflows and fix xtask invocation
* 	modified:   xtask/src/main.rs
* fix(xtask): resolve duplicate code and compilation errors
* fix(xtask): correct zakosign build dependency order
* 	modified:   xtask/src/main.rs
* Merge pull request #1 from YuzakiKokuban/feature/WebUI
* feat: add zakosign
* 	modified:   src/logger.rs
* 	modified:   xtask/src/main.rs
* 	modified:   xtask/src/main.rs 	modified:   xtask/src/zip_ext.rs
* 	modified:   .github/workflows/build.yml 	modified:   .github/workflows/release.yml 	modified:   Cargo.toml
* 	modified:   .github/workflows/build.yml
* build: migrate to cargo-xtask and integrate zakosign
* refactor(core): migrate logging system to tracing
* refactor(core): modularize main logic into scanner and engine
* 	modified:   .github/workflows/build.yml
* style(webui): decouple styles into separate css files and fix file naming
* 	modified:   .github/workflows/build.yml
* [skip ci] Update KernelSU json and changelog for v0.2.2-@2a2b1c2a22b3831e5ad8e56e17ad0fc79f7e3925
* feat:improve modules tab
* feat: monet color
* [skip ci]Update README.md
* feat: try to add monet color pick
* 	modified:   webui/src/App.svelte 	modified:   webui/src/app.css
* 	modified:   webui/src/app.css
* 	modified:   src/config.rs 	modified:   src/main.rs 	modified:   src/utils.rs
* feat: fix logger
* workflow: add rust cache
* Merge remote-tracking branch 'origin/master'
* [skip ci] Update KernelSU json and changelog for v0.2.2-Hybrid-uifix
* Merge remote-tracking branch 'origin/master'
* feat:add japanese and russian support
* [skip ci]Update README.md
* feat:fix webui
* [skip ci] Update README.md
* [skip ci] Update KernelSU json and changelog for v0.2.2-Hybrid
* 	modified:   src/magic_mount/try_umount.rs
* 	modified:   module/module.prop
* [skip ci] Edit release.yml
* feat:Add SuSFS support
* 	modified:   module/metamount.sh 	modified:   webui/src/App.svelte 	modified:   webui/src/app.css
* [skip ci] Update KernelSU json and changelog for v0.2.2-Hybrid
* 	modified:   webui/src/App.svelte
* 	modified:   src/main.rs
* 	new file:   .github/workflows/release.yml 	modified:   src/utils.rs
* 	modified:   webui/src/App.svelte 	modified:   webui/src/app.css
*     modified:   .github/workflows/build.yml 	modified:   xbuild/src/main.rs
* 	modified:   .github/workflows/build.yml 	modified:   xbuild/src/main.rs
* 	modified:   src/defs.rs 	modified:   src/magic_mount/mod.rs 	modified:   src/main.rs 	modified:   src/overlay_mount.rs 	modified:   xbuild/src/main.rs
*     modified:   src/defs.rs 	modified:   src/magic_mount/mod.rs 	modified:   src/magic_mount/node.rs 	modified:   src/overlay_mount.rs
* 	modified:   Cargo.toml
* 	modified:   .github/workflows/build.yml
* 	modified:   xbuild/src/main.rs
* 	modified:   webui/src/app.css
* 	new file:   .github/workflows/build.yml 	deleted:    .github/workflows/ci.yml
* 	modified:   Cargo.toml 	modified:   module/metauninstall.sh 	modified:   module/uninstall.sh
* 	modified:   Cargo.toml 	modified:   module/customize.sh 	modified:   module/metainstall.sh 	modified:   module/metamount.sh 	modified:   src/config.rs 	new file:   src/defs.rs 	modified:   src/magic_mount/mod.rs 	modified:   src/main.rs 	new file:   src/overlay_mount.rs 	modified:   webui/src/App.svelte 	modified:   webui/src/locate.json 	modified:   xbuild/src/main.rs
* 	modified:   module/module.prop
* feat: add magic mount
* docs: update
* refactor: Use a file-splitting structure -  This converts magic_mount from a single file into multiple files, making it easier to modify and read.
* fix: fix complete && feat: add fmt::Display for Node && NodeFileType
* fix: collect extra partitions: `<module>/<part>/` instead of `<module>/system/<part>/`
* bump to 0.2.2
* fix: add fallback support for .replace marker file
* feat: use cache to save fd To avoid the kernel being unable to add more due to the anon inode limit.
* dependabot: add xbuild && webui
* chore: remove unused code
* fix: webui modules bugs
* fix(xbuild): fix no release build
* [test] test ci
* fix(xbuild): fix no build magic_mount_rs
* refactor(ci): add `xbuild` workspace * ci use cargo xbuild
* feat: use config::CONFIG_FILE_DEFAULT for main
* chore: update module name to `Magic Mount - Rust`
* fix: fix no mount
* chore: update module.prop
* fix: fix log file is empty
* bump to v0.2.1
* fix(ci): fix build steps failed
* ci: add build webui steps
* fix: fix webui can't use
* feat: use `env_logger` android_logger's output to write in logcat, but it's buf will refresh
* chore: add webroot for gitignore
* fix(webui): fix output path is /template/webroot
* add .gitignore && Cargo.lock
* Revert "remove webui"
* add ci && dependabot
* bump to v0.2
* fix: fix ioctl error
* module: remove logfile for config
* opt: Optimize error handling for add_try_umount
* fix: fix log no with tag
* feat(module): drop multi-architecture
* opt: Optimize logger if system is android, it will write logcat, other no write
* chore: Optimize import package style && Optimize use NodeFileType
* drop public for send_unmountable
* magic_mount: tell ksu about our mounts
* remove webui
* fix: #6 REPLACE and REMOVE
* feat: migrate UI and add modules manager
* sync with upstream's webui
* add package-lock.json for webui
* add webroot (completed )
* chore: remove unused unsafe block
* chore(deps): bump deps && fix: fix complete on rustix(v1.1)
* feat: move src/* to / && remove build.sh
* chore: make cargo clippy happy
* feat: add `lto`, `opt-level`...
* scripts/metainstall: handle symlinks
* scripts/metamount: tell ksud about it
* Merge pull request #3 from lamprose/fix-webui-conflict-statusbar
* fix: webui's topbar conflicts with statusbar in some scenarios
* webui: Fix safe area
* Add: Webui Support
* Revert 5b41d03592ce3daeb1e326d8b39f5143cfe88187
* template: fix metamodule install
* scripts/metainstall: no-op handle_partition instead
* build.sh: add tempdir
* refactor: rewrite in C
* Add LICENSE
* scripts/metainstall: call install_module
* Initial commit