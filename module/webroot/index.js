import { api, BUILTIN_PARTITIONS, DEFAULT_CONFIG, MODULE_META, PATHS, getRuntimeMode } from "./api.js";
import { enableEdgeToEdge, toast as nativeToast } from "./assets/kernelsu.js";
import { LANGUAGE_OPTIONS, getNavigatorLanguage, isRtlLanguage, translations } from "./i18n.js";

const TABS = [
  { id: "overview", key: "nav.status", icon: "overview" },
  { id: "config", key: "nav.config", icon: "config" },
  { id: "modules", key: "nav.modules", icon: "modules" },
  { id: "hymofs", key: "nav.hymofs", icon: "hymofs" },
  { id: "logs", key: "nav.logs", icon: "logs" },
  { id: "info", key: "nav.info", icon: "info" },
];

const QUICK_HIDE_PATHS = [
  "/dev/scene",
  "/dev/cpuset/scene-daemon",
  "/sdcard/Download/advanced",
  "/sdcard/MT2",
  "/data/adb/magisk",
];

const CONFIG_FIELD_NAMES = new Set([
  "moduledir",
  "tempdir",
  "mountsource",
  "fs_type",
  "debug",
  "verbose",
  "hymofs_enabled",
  "disable_umount",
  "enable_nuke",
  "ignore_protocol_mismatch",
  "enable_kernel_debug",
  "enable_stealth",
  "enable_hidexattr",
  "uname_release",
  "uname_version",
  "cmdline_value",
]);

const MODULE_EXPANDED_STORAGE_KEY = "hymo_module_expanded_v2";
const initialParams = new URLSearchParams(globalThis.location?.search || "");
const initialTab = TABS.some((tab) => tab.id === initialParams.get("tab")) ? initialParams.get("tab") : "overview";
const storedLanguage = localStorage.getItem("hymo_static_language");
const initialLanguage = LANGUAGE_OPTIONS.some((option) => option.value === storedLanguage) ? storedLanguage : getNavigatorLanguage();

try {
  localStorage.removeItem(MODULE_EXPANDED_STORAGE_KEY);
} catch (_error) {
  // ignore
}

const state = {
  runtimeMode: getRuntimeMode(),
  tab: initialTab,
  language: initialLanguage,
  theme: localStorage.getItem("hymo_static_theme") || "system",
  config: JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
  modules: [],
  storage: { size: "-", used: "-", avail: "-", percent: 0, mode: null },
  systemInfo: { kernel: "...", selinux: "...", mountBase: "/dev/hymo_mirror" },
  userHideRules: [],
  allRules: [],
  lkmStatus: { loaded: false, autoload: true, kmi_override: "" },
  conflicts: [],
  logs: "",
  logType: "system",
  logSearch: "",
  moduleSearch: "",
  moduleFilter: "all",
  moduleExpanded: {},
  loading: true,
  error: "",
  lastUpdated: "",
  warningAccepted: getRuntimeMode() === "mock" || localStorage.getItem("hymo_experimental_ack") === "true",
  warningCountdown: 5,
};

let warningTimer = null;
let configSaveQueue = Promise.resolve();
let lastSavedConfigSignature = "";
let moduleSaveQueue = Promise.resolve();
let lastSavedModulesSignature = "[]";
let pendingRenderMotion = null;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function getPersistedConfig(config) {
  return {
    moduledir: config.moduledir,
    tempdir: config.tempdir,
    mountsource: config.mountsource,
    debug: Boolean(config.debug),
    verbose: Boolean(config.verbose),
    fs_type: config.fs_type,
    disable_umount: Boolean(config.disable_umount),
    enable_nuke: Boolean(config.enable_nuke),
    ignore_protocol_mismatch: Boolean(config.ignore_protocol_mismatch),
    enable_kernel_debug: Boolean(config.enable_kernel_debug),
    enable_stealth: Boolean(config.enable_stealth),
    enable_hidexattr: Boolean(config.enable_hidexattr),
    hymofs_enabled: Boolean(config.hymofs_enabled),
    uname_release: config.uname_release || "",
    uname_version: config.uname_version || "",
    cmdline_value: config.cmdline_value || "",
    partitions: unique(config.partitions || []),
  };
}

function getConfigSignature(config) {
  return JSON.stringify(getPersistedConfig(config));
}

function getPersistedModules(modules) {
  return (Array.isArray(modules) ? modules : [])
    .filter((module) => module && typeof module.id === "string")
    .map((module) => ({
      id: module.id,
      mode: module.mode || "auto",
      rules: (Array.isArray(module.rules) ? module.rules : [])
        .map((rule) => ({
          path: String(rule?.path || "").trim(),
          mode: rule?.mode || "hymofs",
        }))
        .filter((rule) => rule.path),
    }));
}

function getModulesSignature(modules) {
  return JSON.stringify(getPersistedModules(modules));
}

lastSavedConfigSignature = getConfigSignature(state.config);
lastSavedModulesSignature = getModulesSignature(state.modules);

function queueRenderMotion(kind, selector = "") {
  pendingRenderMotion = { kind, selector };
}

function animateTargets(targets, { duration = 260, stagger = 28, distance = 12, scale = 0.992 } = {}) {
  targets.filter(Boolean).forEach((target, index) => {
    if (typeof target.animate !== "function") {
      return;
    }

    target.animate(
      [
        {
          opacity: 0,
          transform: `translate3d(0, ${distance}px, 0) scale(${scale})`,
        },
        {
          opacity: 1,
          transform: "translate3d(0, 0, 0) scale(1)",
        },
      ],
      {
        duration,
        delay: index * stagger,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "both",
      }
    );
  });
}

function applyPendingRenderMotion() {
  const motion = pendingRenderMotion;
  pendingRenderMotion = null;
  if (!motion || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
    return;
  }

  const activeScroll = document.querySelector(`.page-pane[data-page="${state.tab}"] .page-pane-scroll`);
  if (!activeScroll) {
    return;
  }

  if (motion.kind === "module") {
    const card = motion.selector ? activeScroll.querySelector(motion.selector) : null;
    animateTargets([card], { duration: 280, distance: 10, scale: 0.988 });
    const body = card?.querySelector(".module-card-body:not([hidden])");
    animateTargets([body], { duration: 220, distance: 8, scale: 1 });
    return;
  }

  if (motion.kind === "logs") {
    animateTargets(
      [activeScroll.querySelector(".log-toolbar-main"), activeScroll.querySelector(".log-search-box"), activeScroll.querySelector(".terminal")],
      { duration: 240, stagger: 36, distance: 10, scale: 0.995 }
    );
    return;
  }

  if (motion.kind === "page") {
    const grid = activeScroll.querySelector(".page-grid");
    const targets = grid ? [...grid.children].slice(0, 8) : [activeScroll];
    animateTargets(targets, { duration: 280, stagger: 34, distance: 14, scale: 0.992 });
  }
}

function resolveTranslation(language, path) {
  return path.split(".").reduce((current, key) => (current && typeof current === "object" ? current[key] : undefined), translations[language]);
}

function formatMessage(template, values = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_match, key) => String(values[key] ?? `{${key}}`));
}

function tr(path, fallback = "", values) {
  const current = resolveTranslation(state.language, path);
  if (typeof current === "string") {
    return formatMessage(current, values);
  }

  const english = resolveTranslation("en", path);
  if (typeof english === "string") {
    return formatMessage(english, values);
  }

  return formatMessage(fallback || path, values);
}

function getTabLabel(tabId) {
  const tab = TABS.find((item) => item.id === tabId);
  return tab ? tr(tab.key, tab.id) : tabId;
}

function getModeLabel(mode) {
  switch (mode) {
    case "auto":
      return tr("modules.modeAuto", "Auto");
    case "hymofs":
      return tr("modules.modeHymofs", "HymoFS");
    case "overlay":
      return tr("modules.modeOverlay", "OverlayFS");
    case "magic":
      return tr("modules.modeMagic", "Magic Mount");
    default:
      return mode || tr("staticUi.common.unknown", "Unknown");
  }
}

function getRuntimeBadgeLabel() {
  return state.runtimeMode === "mock" ? tr("staticUi.common.mock", "Mock") : tr("staticUi.common.live", "Live");
}

function formatUpdatedTime(date) {
  try {
    return new Intl.DateTimeFormat(state.language, { hour: "2-digit", minute: "2-digit" }).format(date);
  } catch (_error) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
}

function applyLanguage() {
  document.documentElement.lang = state.language;
  document.documentElement.dir = isRtlLanguage(state.language) ? "rtl" : "ltr";
  document.title = `${MODULE_META.name} · ${getTabLabel(state.tab)}`;
}

function setLanguage(language) {
  if (!LANGUAGE_OPTIONS.some((option) => option.value === language) || language === state.language) {
    return;
  }

  state.language = language;
  localStorage.setItem("hymo_static_language", language);
  applyLanguage();
  localizeBootShell();
  renderApp();
}

function localizeBootShell() {
  const app = document.getElementById("app");
  if (!app || !app.classList.contains("boot-shell")) {
    return;
  }

  const title = app.querySelector(".boot-panel h1");
  const body = app.querySelector(".boot-panel p");
  if (title) {
    title.textContent = tr("staticUi.boot.title", "Loading control surface…");
  }
  if (body) {
    body.textContent = tr("staticUi.boot.body", "Preparing the static WebUI.");
  }
}

function showToast(message, tone = "success") {
  const stack = document.getElementById("toast-stack");
  if (!stack) {
    return;
  }

  nativeToast(message);

  const item = document.createElement("div");
  item.className = "toast";
  item.dataset.tone = tone;
  item.innerHTML = `<strong>${escapeHtml(
    tone === "danger" ? tr("common.error", "Error") : tone === "success" ? tr("common.success", "Success") : tr("staticUi.toast.info", "Info")
  )}</strong><div>${escapeHtml(message)}</div>`;
  stack.appendChild(item);
  setTimeout(() => {
    item.remove();
  }, 3200);
}

function applyTheme() {
  const root = document.documentElement;
  if (state.theme === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", state.theme);
  }
}

function cycleTheme() {
  state.theme = state.theme === "system" ? "dark" : state.theme === "dark" ? "light" : "system";
  localStorage.setItem("hymo_static_theme", state.theme);
  applyTheme();
  renderApp();
}

function percent(value) {
  return Number.isFinite(Number(value)) ? `${Math.round(Number(value))}%` : "0%";
}

function filteredModules() {
  return state.modules.filter((module) => {
    const query = state.moduleSearch.trim().toLowerCase();
    const matchesQuery =
      !query ||
      module.name.toLowerCase().includes(query) ||
      module.id.toLowerCase().includes(query) ||
      module.description.toLowerCase().includes(query);

    const matchesFilter =
      state.moduleFilter === "all" ||
      module.mode === state.moduleFilter ||
      (state.moduleFilter === "hymofs-active" && (state.systemInfo.hymofsModules || []).includes(module.id));

    return matchesQuery && matchesFilter;
  });
}

function filteredLogs() {
  const query = state.logSearch.trim().toLowerCase();
  return String(state.logs || "")
    .split("\n")
    .filter((line) => !query || line.toLowerCase().includes(query));
}

function renderBadges(items, tone = "primary") {
  if (!items || items.length === 0) {
    return `<div class="empty-state">${escapeHtml(tr("staticUi.common.noData", "No data"))}</div>`;
  }

  return `<div class="chip-row">${items
    .map((item) => `<span class="chip" data-tone="${tone}">${escapeHtml(item)}</span>`)
    .join("")}</div>`;
}

function renderModeOptions(selected, { includeAuto = true } = {}) {
  const values = includeAuto ? ["auto", "hymofs", "overlay", "magic"] : ["hymofs", "overlay", "magic"];
  return values
    .map((value) => `<option value="${value}" ${selected === value ? "selected" : ""}>${escapeHtml(getModeLabel(value))}</option>`)
    .join("");
}

function renderMaterialIcon(name, className = "") {
  const classes = ["material-symbols-rounded"];
  if (className) {
    classes.push(className);
  }
  return `<span class="${classes.map((item) => escapeHtml(item)).join(" ")}" aria-hidden="true">${escapeHtml(name)}</span>`;
}

function renderUtilityIcon(icon) {
  const icons = {
    theme: state.theme === "system" ? "brightness_auto" : state.theme === "dark" ? "dark_mode" : "light_mode",
    refresh: "refresh",
    chevron: "expand_more",
    close: "close",
    external: "open_in_new",
    copy: "content_paste",
    clear: "delete_sweep",
  };

  return renderMaterialIcon(icons[icon] || "close");
}

function isModuleExpanded(module) {
  return state.moduleExpanded[module.id] === true;
}

function renderOverviewPage() {
  const displayPartitions = unique([...(BUILTIN_PARTITIONS || []), ...(state.config.partitions || [])]);
  const mountStats = state.systemInfo.mountStats;
  const currentLanguage = LANGUAGE_OPTIONS.find((option) => option.value === state.language) || LANGUAGE_OPTIONS[0];

  return `
    <div class="page-grid">
      <section class="card home-console">
        <div class="home-console-head">
          <div class="brand">
            <div class="brand-icon"><img src="./icon.svg" alt="Hymo" width="24" height="24"></div>
            <div class="brand-copy">
              <h1>Hymo</h1>
            </div>
          </div>
          <div class="home-console-meta">
            <span class="badge home-console-runtime" data-tone="${state.runtimeMode === "mock" ? "primary" : "success"}">${escapeHtml(getRuntimeBadgeLabel())}</span>
            ${state.lastUpdated ? `<span class="badge home-console-updated">${escapeHtml(tr("staticUi.common.updated", "Updated"))} ${escapeHtml(state.lastUpdated)}</span>` : ""}
          </div>
          <div class="home-console-actions">
            <label class="language-picker" title="${escapeHtml(currentLanguage.label)}">
              <span class="visually-hidden">${escapeHtml(tr("staticUi.common.language", "Language"))}</span>
              <select data-role="language-select" aria-label="${escapeHtml(tr("staticUi.common.language", "Language"))}">
                ${LANGUAGE_OPTIONS.map(
                  (option) => `<option value="${option.value}" ${option.value === state.language ? "selected" : ""}>${escapeHtml(option.shortLabel)}</option>`
                ).join("")}
              </select>
            </label>
            <button class="icon-button topbar-icon" data-variant="ghost" data-action="cycle-theme" title="${escapeHtml(tr("staticUi.common.theme", "Theme"))}">
              ${renderUtilityIcon("theme")}
            </button>
            <button
              class="icon-button topbar-icon"
              data-action="refresh-all"
              title="${escapeHtml(state.loading ? tr("common.loading", "Loading...") : tr("common.refresh", "Refresh"))}"
              ${state.loading ? "disabled" : ""}
            >
              ${renderUtilityIcon("refresh")}
            </button>
          </div>
        </div>
      </section>

      <section class="metric-grid">
        <article class="metric-card">
          <div class="metric-label">${escapeHtml(tr("status.storage", "Storage"))}</div>
          <div class="metric-value">${percent(state.storage.percent)}</div>
          <div class="metric-foot">${escapeHtml(state.storage.used)} / ${escapeHtml(state.storage.size)} · ${escapeHtml(state.storage.mode || tr("staticUi.common.unknown", "Unknown"))}</div>
          <div class="progress"><span style="width:${Math.min(100, Number(state.storage.percent) || 0)}%"></span></div>
        </article>
        <article class="metric-card">
          <div class="metric-label">${escapeHtml(tr("staticUi.overview.totalModules", "Scanned modules"))}</div>
          <div class="metric-value">${state.modules.length}</div>
          <div class="metric-foot">${escapeHtml(tr("modules.title", "Modules"))}</div>
        </article>
        <article class="metric-card">
          <div class="metric-label">${escapeHtml(tr("staticUi.overview.hymofsActive", "HymoFS Active"))}</div>
          <div class="metric-value">${(state.systemInfo.hymofsModules || []).length}</div>
          <div class="metric-foot">${escapeHtml(tr("nav.hymofs", "HymoFS"))}</div>
        </article>
        <article class="metric-card">
          <div class="metric-label">${escapeHtml(tr("hideRules.totalActive", "Total Active"))}</div>
          <div class="metric-value">${state.allRules.length}</div>
          <div class="metric-foot">${escapeHtml(tr("staticUi.overview.userRulesFoot", "User rules {count}", { count: state.userHideRules.length }))}</div>
        </article>
      </section>

      ${
        state.systemInfo.hymofsMismatch
          ? `<section class="banner" data-tone="danger"><strong>${escapeHtml(tr("status.hymofsMismatch", "HymoFS Protocol Mismatch"))}</strong><div>${escapeHtml(
              state.systemInfo.mismatchMessage || tr("staticUi.errors.syncKernelUserspace", "Please sync kernel and userspace implementations.")
            )}</div></section>`
          : ""
      }

      <div class="grid-2">
        <section class="card">
          <div class="section-head">
            <div>
              <h3>${escapeHtml(tr("status.systemInfo", "System Information"))}</h3>
            </div>
          </div>
          <div class="info-list">
            <div class="info-item"><div class="label">${escapeHtml(tr("status.kernel", "Kernel"))}</div><div class="value mono">${escapeHtml(state.systemInfo.kernel || tr("staticUi.common.unknown", "Unknown"))}</div></div>
            <div class="info-item"><div class="label">${escapeHtml(tr("status.selinux", "SELinux"))}</div><div class="value">${escapeHtml(state.systemInfo.selinux || tr("staticUi.common.unknown", "Unknown"))}</div></div>
            <div class="info-item"><div class="label">${escapeHtml(tr("status.mountBase", "Mount Base"))}</div><div class="value mono">${escapeHtml(state.systemInfo.mountBase || "/dev/hymo_mirror")}</div></div>
            <div class="info-item"><div class="label">${escapeHtml(tr("staticUi.overview.updatedValue", "Updated"))}</div><div class="value">${escapeHtml(state.lastUpdated || "-")}</div></div>
          </div>
        </section>

        <section class="card">
          <div class="section-head">
            <div>
              <h3>${escapeHtml(tr("staticUi.overview.runtimeStatus", "Runtime Status"))}</h3>
            </div>
          </div>
          <div class="info-list">
            <div class="info-item"><div class="label">${escapeHtml(tr("staticUi.common.runtime", "Runtime"))}</div><div class="value">${escapeHtml(getRuntimeBadgeLabel())}</div></div>
            <div class="info-item"><div class="label">${escapeHtml(tr("staticUi.common.protocol", "Protocol"))}</div><div class="value">${escapeHtml(
              state.systemInfo.hymofsMismatch ? tr("status.hymofsMismatch", "Mismatch") : tr("staticUi.common.ok", "OK")
            )}</div></div>
            <div class="info-item"><div class="label">HymoFS</div><div class="value">${escapeHtml(
              state.systemInfo.hymofsAvailable ? tr("staticUi.common.available", "Available") : tr("staticUi.common.unavailable", "Unavailable")
            )}</div></div>
            <div class="info-item"><div class="label">LKM</div><div class="value">${escapeHtml(
              state.lkmStatus.loaded ? tr("hymofs.lkm.loaded", "Loaded") : tr("hymofs.lkm.notLoaded", "Not Loaded")
            )}</div></div>
          </div>
        </section>
      </div>

      <section class="card">
        <div class="section-head">
          <div>
            <h3>${escapeHtml(tr("status.partitions", "Active Partitions"))}</h3>
          </div>
        </div>
        <div class="chip-row">
          ${displayPartitions
            .map((partition) => {
              const info = (state.systemInfo.detectedPartitions || []).find((item) => item.name === partition);
              const details = info
                ? `${info.mount_point || "-"} · ${info.fs_type || "-"}${info.is_read_only ? " · ro" : ""}`
                : tr("staticUi.overview.noPartitionInfo", "Partition details unavailable");
              return `<span class="chip" data-tone="${info ? "primary" : "default"}" title="${escapeHtml(details)}">${escapeHtml(partition)}</span>`;
            })
            .join("")}
        </div>
      </section>

      ${
        mountStats
          ? `<section class="card">
              <div class="section-head">
                <div>
                  <h3>${escapeHtml(tr("status.mountStats", "Mount Statistics"))}</h3>
                </div>
              </div>
              <div class="grid-4">
                <div class="metric-card"><div class="metric-label">${escapeHtml(tr("status.totalMounts", "Total Mounts"))}</div><div class="metric-value">${mountStats.total_mounts}</div></div>
                <div class="metric-card"><div class="metric-label">${escapeHtml(tr("status.successfulMounts", "Successful"))}</div><div class="metric-value">${mountStats.successful_mounts}</div></div>
                <div class="metric-card"><div class="metric-label">${escapeHtml(tr("status.failedMounts", "Failed"))}</div><div class="metric-value">${mountStats.failed_mounts}</div></div>
                <div class="metric-card"><div class="metric-label">${escapeHtml(tr("status.successRate", "Success Rate"))}</div><div class="metric-value">${
                  mountStats.success_rate ? `${mountStats.success_rate.toFixed(1)}%` : "n/a"
                }</div></div>
              </div>
              <div class="badge-row" style="margin-top:14px;">
                <span class="badge">${escapeHtml(tr("status.filesMounted", "Files"))} ${mountStats.files_mounted}</span>
                <span class="badge">${escapeHtml(tr("status.dirsMounted", "Directories"))} ${mountStats.dirs_mounted}</span>
                <span class="badge">${escapeHtml(tr("status.symlinksCreated", "Symlinks"))} ${mountStats.symlinks_created}</span>
                <span class="badge">${escapeHtml(tr("status.overlayMounts", "Overlay"))} ${mountStats.overlayfs_mounts}</span>
              </div>
            </section>`
          : ""
      }
    </div>
  `;
}

function renderConfigPage() {
  const config = state.config;
  const partitionChips = (config.partitions || [])
    .map(
      (partition) =>
        `<span class="chip"><span class="mono">${escapeHtml(partition)}</span><button class="icon-button" data-variant="ghost" data-remove-partition="${escapeHtml(
          partition
        )}" aria-label="${escapeHtml(tr("staticUi.common.remove", "Remove"))}" title="${escapeHtml(tr("staticUi.common.remove", "Remove"))}">${renderUtilityIcon(
          "close"
        )}</button></span>`
    )
    .join("");

  return `
    <div class="page-grid">
      <form id="config-form" class="page-grid">
        <section class="card">
          <div class="section-head">
            <div>
              <h3>${escapeHtml(tr("staticUi.config.core", "Core Config"))}</h3>
            </div>
            <div class="section-actions">
              <button type="button" class="button" data-variant="ghost" data-action="reload-config">${escapeHtml(tr("staticUi.common.reload", "Reload"))}</button>
            </div>
          </div>
          <div class="field-grid">
            <div class="field">
              <label for="cfg-moduledir">${escapeHtml(tr("config.moduleDir", "Module Directory"))}</label>
              <input id="cfg-moduledir" name="moduledir" value="${escapeHtml(config.moduledir)}">
            </div>
            <div class="field">
              <label for="cfg-tempdir">${escapeHtml(tr("config.tempDir", "Temporary Directory"))}</label>
              <input id="cfg-tempdir" name="tempdir" value="${escapeHtml(config.tempdir)}" placeholder="/data/adb/hymo/img_mnt">
            </div>
            <div class="field">
              <label for="cfg-mountsource">${escapeHtml(tr("config.mountSource", "Mount Source"))}</label>
              <select id="cfg-mountsource" name="mountsource">
                ${["KSU", "APatch", "Magisk"].map((value) => `<option value="${value}" ${config.mountsource === value ? "selected" : ""}>${value}</option>`).join("")}
              </select>
            </div>
            <div class="field">
              <label for="cfg-fstype">${escapeHtml(tr("config.fsType", "Filesystem Type"))}</label>
              <select id="cfg-fstype" name="fs_type">
                ${[
                  { value: "auto", label: tr("config.fsAuto", "Auto") },
                  { value: "tmpfs", label: tr("config.fsTmpfs", "tmpfs") },
                  { value: "erofs", label: tr("config.fsErofs", "erofs") },
                  { value: "ext4", label: tr("config.fsExt4", "ext4") },
                ]
                  .map((item) => `<option value="${item.value}" ${config.fs_type === item.value ? "selected" : ""}>${item.label}</option>`)
                  .join("")}
              </select>
              <small>${escapeHtml(tr("staticUi.config.tmpfsXattr", "tmpfs xattr"))}: ${escapeHtml(
                config.tmpfs_xattr_supported ? tr("staticUi.common.available", "Available") : tr("status.notSupported", "Not Supported")
              )}</small>
            </div>
            <div class="field">
              <label for="cfg-logfile">${escapeHtml(tr("staticUi.config.logFile", "Log File"))}</label>
              <input id="cfg-logfile" value="${escapeHtml(config.logfile || PATHS.DEFAULT_LOG)}" disabled>
            </div>
          </div>
        </section>

        <section class="card">
          <div class="section-head">
            <div>
              <h3>${escapeHtml(tr("staticUi.config.toggles", "Behavior"))}</h3>
            </div>
          </div>
          <div class="switch-grid">
            ${renderSwitchCard("debug", tr("config.debug", "Debug Logging"), "", config.debug)}
            ${renderSwitchCard("verbose", tr("config.verbose", "Verbose Logging"), "", config.verbose)}
            ${renderSwitchCard("hymofs_enabled", tr("config.enableHymoFS", "Enable HymoFS"), "", config.hymofs_enabled)}
            ${renderSwitchCard("disable_umount", tr("config.disableUmount", "Disable Unmount"), "", config.disable_umount)}
            ${renderSwitchCard("enable_nuke", tr("config.enableNuke", "Enable Nuke"), "", config.enable_nuke)}
            ${renderSwitchCard("ignore_protocol_mismatch", tr("config.ignoreProtocolMismatch", "Ignore HymoFS Protocol Mismatch"), "", config.ignore_protocol_mismatch)}
            ${renderSwitchCard("enable_kernel_debug", tr("config.enableKernelDebug", "Show Kernel Debug Logs"), "", config.enable_kernel_debug)}
            ${renderSwitchCard("enable_stealth", tr("config.enableStealth", "Enable Stealth"), "", config.enable_stealth)}
            ${renderSwitchCard("enable_hidexattr", tr("config.enableHideXattr", "Mount hide / Maps spoof / Statfs spoof"), tr("config.enableHideXattrDesc", ""), config.enable_hidexattr)}
          </div>
        </section>

        <section class="card">
          <div class="section-head">
            <div>
              <h3>${escapeHtml(tr("config.partitions", "Custom Partitions"))}</h3>
            </div>
            <div class="section-actions">
              <button type="button" class="button" data-variant="secondary" data-action="scan-partitions">${escapeHtml(tr("config.scanPartitions", "Auto Scan"))}</button>
            </div>
          </div>
          <div class="field-inline">
            <div class="field">
              <label for="partition-input">${escapeHtml(tr("config.addPartition", "Add Partition"))}</label>
              <input id="partition-input" placeholder="system_ext, vendor_dlkm">
            </div>
            <button type="button" class="button" data-action="add-partition">${escapeHtml(tr("hideRules.add", "Add"))}</button>
          </div>
          <div class="chip-row" style="margin-top:14px;">
            ${partitionChips || `<span class="muted">${escapeHtml(tr("staticUi.config.noCustomPartitions", "No custom partitions"))}</span>`}
          </div>
        </section>
      </form>
    </div>
  `;
}

function renderSwitchCard(name, title, description, checked) {
  return `
    <label class="switch-card" for="cfg-${name}">
      <div class="switch-copy">
        <strong>${escapeHtml(title)}</strong>
        ${description ? `<small>${escapeHtml(description)}</small>` : ""}
      </div>
      <span class="toggle">
        <input id="cfg-${name}" type="checkbox" name="${escapeHtml(name)}" ${checked ? "checked" : ""}>
        <span></span>
      </span>
    </label>
  `;
}

function renderModulesPage() {
  const modules = filteredModules();

  return `
    <div class="page-grid">
      <section class="card">
        <div class="section-head">
          <div>
            <h3>${escapeHtml(tr("staticUi.modules.orchestration", "Module Orchestration"))}</h3>
          </div>
          <div class="section-actions">
            <button class="button" data-variant="ghost" data-action="check-conflicts">${escapeHtml(tr("modules.checkConflicts", "Check Conflicts"))}</button>
          </div>
        </div>
        <div class="toolbar">
          <div class="search-box">
            <input data-role="module-search" value="${escapeHtml(state.moduleSearch)}" placeholder="${escapeHtml(tr("modules.search", "Search modules..."))}">
          </div>
          <div class="search-box">
            <select data-role="module-filter">
              ${[
                { value: "all", label: tr("modules.filterAll", "All") },
                { value: "auto", label: tr("modules.filterAuto", "Auto") },
                { value: "hymofs", label: tr("modules.filterHymofs", "HymoFS") },
                { value: "overlay", label: tr("modules.filterOverlay", "OverlayFS") },
                { value: "magic", label: tr("modules.filterMagic", "Magic Mount") },
                { value: "hymofs-active", label: tr("staticUi.modules.hymofsActive", "HymoFS Active") },
              ]
                .map((item) => `<option value="${item.value}" ${state.moduleFilter === item.value ? "selected" : ""}>${item.label}</option>`)
                .join("")}
            </select>
          </div>
        </div>
      </section>

      ${
        state.conflicts.length > 0
          ? `<section class="notice" data-tone="danger"><strong>${escapeHtml(
              tr("staticUi.modules.conflictsDetected", "{count} conflicts detected", { count: state.conflicts.length })
            )}</strong><div>${state.conflicts
              .map((item) => escapeHtml(item.message || JSON.stringify(item)))
              .join("<br>")}</div></section>`
          : ""
      }

      <section class="module-list">
        ${
          modules.length === 0
            ? `<div class="empty-state">${escapeHtml(tr("modules.noModules", "No modules found"))}</div>`
            : modules.map((module) => renderModuleCard(module)).join("")
        }
      </section>
    </div>
  `;
}

function renderModuleCard(module) {
  const active = (state.systemInfo.hymofsModules || []).includes(module.id);
  const rules = Array.isArray(module.rules) ? module.rules : [];
  const expanded = isModuleExpanded(module);
  const toggleLabel = expanded ? tr("staticUi.modules.collapse", "Collapse") : tr("staticUi.modules.expand", "Expand");

  return `
    <article class="module-card ${expanded ? "is-expanded" : "is-collapsed"}" data-module-id="${escapeHtml(module.id)}">
      <header>
        <div>
          <h4>${escapeHtml(module.name)}</h4>
          <p>${escapeHtml(module.description || tr("staticUi.modules.noDescription", "No description"))}</p>
          <div class="module-meta">
            <span class="badge">${escapeHtml(module.version || tr("staticUi.modules.unknownVersion", "unknown version"))}</span>
            <span class="badge">${escapeHtml(module.author || tr("staticUi.modules.unknownAuthor", "unknown author"))}</span>
            <span class="badge" data-tone="${active ? "success" : "primary"}">${escapeHtml(active ? tr("modules.mountSuccess", "Mounted") : tr("staticUi.modules.idle", "Idle"))}</span>
            ${rules.length > 0 ? `<span class="badge">${escapeHtml(tr("staticUi.modules.rulesCount", "{count} rules", { count: rules.length }))}</span>` : ""}
          </div>
          <div class="muted mono" style="margin-top:8px;">${escapeHtml(module.id)}</div>
        </div>
      </header>

      <div class="module-summary">
        <label class="module-mode-picker">
          <span class="visually-hidden">${escapeHtml(tr("modules.mode", "Mode"))}</span>
          <select
            name="module-mode"
            data-module-mode="${escapeHtml(module.id)}"
            aria-label="${escapeHtml(tr("modules.mode", "Mode"))}"
            title="${escapeHtml(tr("modules.mode", "Mode"))}"
          >
            ${renderModeOptions(module.mode)}
          </select>
        </label>
        <button
          class="icon-button module-toggle"
          data-variant="ghost"
          data-action="toggle-module-expanded"
          data-module-id="${escapeHtml(module.id)}"
          aria-expanded="${expanded ? "true" : "false"}"
          aria-label="${escapeHtml(toggleLabel)}"
          title="${escapeHtml(toggleLabel)}"
        >
          ${renderUtilityIcon("chevron")}
        </button>
      </div>

      <div class="module-card-body" ${expanded ? "" : "hidden"}>
        <div class="module-runtime-actions">
          <button class="button" data-variant="ghost" data-action="${active ? "hot-unmount" : "hot-mount"}" data-module-id="${escapeHtml(module.id)}">${escapeHtml(
            active ? tr("modules.hotUnmount", "Hot Unmount") : tr("modules.hotMount", "Hot Mount")
          )}</button>
        </div>

        <div class="rule-editor">
          <div class="section-head" style="margin-bottom:4px;">
            <div>
              <h4>${escapeHtml(tr("modules.rules", "Rules"))}</h4>
            </div>
            <div class="section-actions">
              <button class="button" data-variant="secondary" data-action="add-module-rule" data-module-id="${escapeHtml(module.id)}">${escapeHtml(
                tr("modules.addRule", "Add Rule")
              )}</button>
            </div>
          </div>
          ${
            rules.length === 0
              ? `<div class="empty-state">${escapeHtml(tr("staticUi.modules.noRules", "No custom rules yet"))}</div>`
              : rules
                  .map(
                    (rule, index) => `
                    <div class="rule-row" data-rule-index="${index}">
                    <input data-rule-path value="${escapeHtml(rule.path || "")}" placeholder="${escapeHtml(tr("modules.path", "Path"))}">
                    <div class="rule-controls">
                      <select data-rule-mode>
                        ${renderModeOptions(rule.mode, { includeAuto: false })}
                      </select>
                      <button
                        class="icon-button"
                        data-variant="ghost"
                        data-action="remove-module-rule"
                        data-module-id="${escapeHtml(module.id)}"
                        data-rule-index="${index}"
                        aria-label="${escapeHtml(tr("staticUi.common.remove", "Remove"))}"
                        title="${escapeHtml(tr("staticUi.common.remove", "Remove"))}"
                      >
                        ${renderUtilityIcon("close")}
                      </button>
                    </div>
                  </div>`
                )
                .join("")
          }
        </div>
      </div>
    </article>
  `;
}

function renderHymoFSPage() {
  const features = state.systemInfo.features?.names || [];

  return `
    <div class="page-grid">
      <div class="grid-2">
        <section class="card">
          <div class="section-head">
            <div>
              <h3>${escapeHtml(tr("hymofs.lkm.title", "HymoFS Kernel Module (LKM)"))}</h3>
            </div>
            <div class="badge-row">
              ${
                state.lkmStatus.loaded
                  ? `<span class="badge" data-tone="success">${escapeHtml(tr("hymofs.lkm.loaded", "Loaded"))}</span>`
                  : `<span class="badge">${escapeHtml(tr("hymofs.lkm.notLoaded", "Not Loaded"))}</span>`
              }
              ${
                state.lkmStatus.autoload
                  ? `<span class="badge" data-tone="primary">${escapeHtml(tr("hymofs.lkm.autoload", "Autoload"))}</span>`
                  : `<span class="badge">${escapeHtml(tr("staticUi.common.manual", "Manual"))}</span>`
              }
            </div>
          </div>
          <div class="switch-card" style="margin-bottom:14px;">
            <div class="switch-copy">
              <strong>${escapeHtml(tr("hymofs.lkm.autoload", "Autoload at boot"))}</strong>
              <small><span class="mono">hymod lkm set-autoload</span></small>
            </div>
            <span class="toggle">
              <input type="checkbox" data-action="toggle-autoload" ${state.lkmStatus.autoload ? "checked" : ""}>
              <span></span>
            </span>
          </div>
          <div class="field-inline">
            <button class="button" data-action="lkm-load">${escapeHtml(tr("hymofs.lkm.load", "Load"))}</button>
            <button class="button" data-variant="ghost" data-action="lkm-unload">${escapeHtml(tr("hymofs.lkm.unload", "Unload"))}</button>
          </div>
          <div class="field-inline" style="margin-top:14px;">
            <div class="field">
              <label for="kmi-input">${escapeHtml(tr("hymofs.lkm.kmiOverride", "KMI Override"))}</label>
              <input id="kmi-input" value="${escapeHtml(state.lkmStatus.kmi_override || "")}" placeholder="android14-6.1">
            </div>
            <button class="button" data-variant="secondary" data-action="set-kmi">${escapeHtml(tr("hymofs.lkm.setKmi", "Set"))}</button>
            <button class="button" data-variant="ghost" data-action="clear-kmi">${escapeHtml(tr("hymofs.lkm.clearKmi", "Clear"))}</button>
          </div>
        </section>

        <section class="card">
          <div class="section-head">
            <div>
              <h3>${escapeHtml(tr("staticUi.config.spoof", "Kernel Spoofing"))}</h3>
            </div>
          </div>
          <div class="field-grid">
            <div class="field">
              <label for="hymofs-uname-release">${escapeHtml(tr("config.unameRelease", "Kernel Release"))}</label>
              <input
                id="hymofs-uname-release"
                name="uname_release"
                value="${escapeHtml(state.config.uname_release)}"
                placeholder="${escapeHtml(tr("config.useSystemValue", "Use System Value"))}"
              >
            </div>
            <div class="field">
              <label for="hymofs-uname-version">${escapeHtml(tr("config.unameVersion", "Kernel Version"))}</label>
              <input
                id="hymofs-uname-version"
                name="uname_version"
                value="${escapeHtml(state.config.uname_version)}"
                placeholder="${escapeHtml(tr("config.useSystemValue", "Use System Value"))}"
              >
            </div>
            <div class="field" style="grid-column: 1 / -1;">
              <label for="hymofs-cmdline">${escapeHtml(tr("staticUi.config.cmdline", "Kernel Cmdline"))}</label>
              <textarea
                id="hymofs-cmdline"
                name="cmdline_value"
                placeholder="androidboot.verifiedbootstate=green"
              >${escapeHtml(state.config.cmdline_value)}</textarea>
            </div>
          </div>
        </section>
      </div>

      <div class="grid-2">
        <section class="card">
          <div class="section-head">
            <div>
              <h3>${escapeHtml(tr("staticUi.hymofs.featureFlags", "Feature Flags"))}</h3>
            </div>
          </div>
          ${renderBadges(features, "primary")}
        </section>

        <section class="card">
          <div class="section-head">
            <div>
              <h3>${escapeHtml(tr("hymofs.hooks.title", "Kernel Hooks"))}</h3>
            </div>
          </div>
          <div class="mono-block">${escapeHtml(state.systemInfo.hooks || tr("staticUi.hymofs.noHookData", "No hook data"))}</div>
        </section>
      </div>

      <section class="card">
        <div class="section-head">
          <div>
            <h3>${escapeHtml(tr("hideRules.userRules", "User Rules"))}</h3>
          </div>
          <div class="badge-row">
            <span class="badge" data-tone="primary">${escapeHtml(tr("staticUi.hymofs.userRulesCount", "{count} user rules", { count: state.userHideRules.length }))}</span>
            <span class="badge">${escapeHtml(tr("staticUi.hymofs.totalRulesCount", "{count} total rules", { count: state.allRules.length }))}</span>
          </div>
        </div>
        <div class="field-inline">
          <div class="field">
            <label for="hide-rule-input">${escapeHtml(tr("hideRules.addTitle", "Add Hide Rule"))}</label>
            <input id="hide-rule-input" placeholder="${escapeHtml(tr("hideRules.placeholder", "/path/to/hide"))}">
          </div>
          <button class="button" data-action="add-hide-rule">${escapeHtml(tr("hideRules.add", "Add"))}</button>
        </div>
        <p class="muted" style="margin:14px 0 0;">${escapeHtml(tr("hideRules.quickAdd", "Quick Add Common Paths:"))}</p>
        <div class="chip-row" style="margin-top:14px;">
          ${QUICK_HIDE_PATHS.map((path) => `<button class="chip" data-action="quick-hide" data-path="${escapeHtml(path)}">${escapeHtml(path)}</button>`).join("")}
        </div>
        <div class="rule-list" style="margin-top:14px;">
          ${
            state.userHideRules.length === 0
              ? `<div class="empty-state">${escapeHtml(tr("hideRules.noUserRules", "No user-defined hide rules yet"))}</div>`
              : state.userHideRules
                  .map(
                    (path) => `
                      <div class="switch-card">
                      <div class="switch-copy">
                        <strong class="mono">${escapeHtml(path)}</strong>
                          <small>${escapeHtml(tr("hideRules.user", "User"))}</small>
                      </div>
                        <button
                          class="icon-button"
                          data-variant="ghost"
                          data-action="remove-hide-rule"
                          data-path="${escapeHtml(path)}"
                          aria-label="${escapeHtml(tr("staticUi.common.remove", "Remove"))}"
                          title="${escapeHtml(tr("staticUi.common.remove", "Remove"))}"
                        >
                          ${renderUtilityIcon("close")}
                        </button>
                      </div>
                    `
                  )
                  .join("")
          }
        </div>
      </section>

      <section class="card">
        <div class="section-head">
          <div>
            <h3>${escapeHtml(tr("staticUi.hymofs.allEffectiveRules", "All Effective Rules"))}</h3>
            <p>${escapeHtml(tr("hideRules.allRulesHint", ""))}</p>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>${escapeHtml(tr("staticUi.hymofs.type", "Type"))}</th>
                <th>${escapeHtml(tr("modules.path", "Path"))}</th>
                <th>${escapeHtml(tr("staticUi.hymofs.target", "Target"))}</th>
                <th>${escapeHtml(tr("staticUi.hymofs.source", "Source"))}</th>
                <th>${escapeHtml(tr("staticUi.hymofs.origin", "Origin"))}</th>
              </tr>
            </thead>
            <tbody>
              ${state.allRules
                .map(
                  (rule) => `
                    <tr>
                      <td data-label="${escapeHtml(tr("staticUi.hymofs.type", "Type"))}">${escapeHtml(rule.type || tr("staticUi.common.unknown", "Unknown"))}</td>
                      <td class="mono" data-label="${escapeHtml(tr("modules.path", "Path"))}">${escapeHtml(rule.path || "-")}</td>
                      <td class="mono" data-label="${escapeHtml(tr("staticUi.hymofs.target", "Target"))}">${escapeHtml(rule.target || "-")}</td>
                      <td class="mono" data-label="${escapeHtml(tr("staticUi.hymofs.source", "Source"))}">${escapeHtml(rule.source || "-")}</td>
                      <td data-label="${escapeHtml(tr("staticUi.hymofs.origin", "Origin"))}">${escapeHtml(
                        rule.isUserDefined ? tr("staticUi.hymofs.userDefined", "user") : tr("staticUi.hymofs.moduleKernel", "module/kernel")
                      )}</td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;
}

function renderLogsPage() {
  const lines = filteredLogs();
  return `
    <div class="page-grid">
      <section class="card">
        <div class="section-head">
          <div>
            <h3>${escapeHtml(tr("staticUi.logs.viewer", "Log Viewer"))}</h3>
          </div>
        </div>
        <div class="logs-toolbar">
          <div class="log-toolbar-main">
            <div class="log-type-toggle" role="tablist" aria-label="${escapeHtml(tr("staticUi.logs.viewer", "Log Viewer"))}">
              <button
                class="log-type-button ${state.logType === "system" ? "is-active" : ""}"
                data-action="set-log-type"
                data-log-type="system"
                aria-pressed="${state.logType === "system" ? "true" : "false"}"
              >${escapeHtml(tr("logs.systemShort", "System"))}</button>
              <button
                class="log-type-button ${state.logType === "kernel" ? "is-active" : ""}"
                data-action="set-log-type"
                data-log-type="kernel"
                aria-pressed="${state.logType === "kernel" ? "true" : "false"}"
              >${escapeHtml(tr("logs.kernelShort", "Kernel"))}</button>
            </div>
            <div class="log-actions">
              <button
                class="icon-button"
                data-variant="ghost"
                data-action="copy-logs"
                aria-label="${escapeHtml(tr("staticUi.common.copy", "Copy"))}"
                title="${escapeHtml(tr("staticUi.common.copy", "Copy"))}"
              >
                ${renderUtilityIcon("copy")}
              </button>
              <button
                class="icon-button"
                data-variant="danger"
                data-action="clear-logs"
                aria-label="${escapeHtml(tr("logs.clear", "Clear"))}"
                title="${escapeHtml(tr("logs.clear", "Clear"))}"
                ${state.logType !== "system" ? "disabled" : ""}
              >
                ${renderUtilityIcon("clear")}
              </button>
              <button
                class="icon-button"
                data-variant="ghost"
                data-action="refresh-logs"
                aria-label="${escapeHtml(tr("logs.refresh", "Refresh"))}"
                title="${escapeHtml(tr("logs.refresh", "Refresh"))}"
              >
                ${renderUtilityIcon("refresh")}
              </button>
            </div>
          </div>
          <div class="search-box log-search-box">
            <input data-role="log-search" value="${escapeHtml(state.logSearch)}" placeholder="${escapeHtml(tr("staticUi.logs.search", "Search logs"))}">
          </div>
        </div>
      </section>

      <section class="card">
        <div class="terminal">
          ${
            lines.length === 0 || (lines.length === 1 && lines[0] === "")
              ? `<div class="empty-state">${escapeHtml(tr("logs.noLogs", "No logs available"))}</div>`
              : lines.map((line) => renderLogLine(line)).join("")
          }
        </div>
      </section>
    </div>
  `;
}

function renderLogLine(line) {
  const lower = line.toLowerCase();
  let tone = "";
  if (lower.includes("[error]")) {
    tone = "error";
  } else if (lower.includes("[warn]")) {
    tone = "warn";
  } else if (lower.includes("[info]")) {
    tone = "info";
  } else if (lower.includes("[debug]") || lower.includes("[verbose]")) {
    tone = "debug";
  }
  return `<div class="log-line ${tone}">${escapeHtml(line)}</div>`;
}

function renderInfoPage() {
  const currentLanguage = LANGUAGE_OPTIONS.find((option) => option.value === state.language) || LANGUAGE_OPTIONS[0];

  return `
    <div class="page-grid">
      <section class="card accent">
        <div class="section-head">
          <div>
            <p class="eyebrow">${escapeHtml(tr("info.title", "About"))}</p>
            <h3>${escapeHtml(MODULE_META.name)}</h3>
            <p>${escapeHtml(tr("info.description", "A simple hybrid mounting meta-module."))}</p>
          </div>
          <div class="badge-row">
            <span class="badge" data-tone="primary">${escapeHtml(tr("info.version", "Version"))} ${escapeHtml(MODULE_META.version)}</span>
            <span class="badge">${escapeHtml(MODULE_META.author)}</span>
            <span class="badge">${escapeHtml(currentLanguage.label)}</span>
          </div>
        </div>
        <div class="notice" data-tone="danger">
          <strong>${escapeHtml(tr("common.warning", "Warning"))}</strong>
          <div>${escapeHtml(tr("staticUi.warning.body", "Incorrect kernel implementations, config drift, or incomplete hooks can still hurt performance and stability."))}</div>
        </div>
      </section>

      <section class="card">
        <div class="section-head">
          <div>
            <h3>${escapeHtml(tr("staticUi.info.projectLinks", "Project Links"))}</h3>
          </div>
        </div>
        <div class="link-list">
          ${[
            [tr("info.github", "GitHub Repository"), "https://github.com/Anatdx/hymo"],
            [tr("info.gitlab", "GitLab Repository"), "https://gitlab.com/Anatdx/hymo"],
            [tr("info.selfhosted", "Anatdx Self-hosted Repository"), "https://git.anatdx.com/Anatdx/hymo"],
            ["HymoFS", "https://github.com/Anatdx/HymoFS"],
            ["YukiSU", "https://github.com/Anatdx/YukiSU"],
          ]
            .map(
              ([label, href]) => `
                <a class="link-tile" href="${href}" target="_blank" rel="noreferrer">
                  <span>${escapeHtml(label)}</span>
                  <span class="link-tile-icon">${renderUtilityIcon("external")}</span>
                </a>
              `
            )
            .join("")}
        </div>
      </section>

      <section class="card">
        <div class="section-head">
          <div>
            <h3>${escapeHtml(tr("info.acknowledgments", "Acknowledgments"))}</h3>
          </div>
        </div>
        ${renderBadges(
          [
            "KernelSU",
            "WebUI X",
            "HymoFS",
            "YukiSU",
            "Magisk",
            "KernelPatch",
            "susfs4ksu",
            "meta-hybrid_mount",
            "meta-magic_mount",
          ],
          "primary"
        )}
      </section>
    </div>
  `;
}

function renderTabIcon(icon) {
  const icons = {
    overview: "monitoring",
    config: "tune",
    modules: "inventory_2",
    hymofs: "build",
    logs: "article",
    info: "info",
  };

  return `<span class="bottom-nav-icon" aria-hidden="true">${renderMaterialIcon(icons[icon] || "info")}</span>`;
}

function renderShell() {
  return `
    <div class="app-shell">
      <div class="app-frame">
        ${
          state.error
            ? `<section class="notice" data-tone="danger" style="margin-bottom:18px;"><strong>${escapeHtml(
                tr("staticUi.errors.loadFailed", "Failed to load")
              )}</strong><div>${escapeHtml(state.error)}</div></section>`
            : ""
        }

        <main class="page-shell">
          <div class="page-carousel is-pending" id="page-carousel">
            <section class="page-pane" data-page="overview"><div class="page-pane-scroll">${renderOverviewPage()}</div></section>
            <section class="page-pane" data-page="config"><div class="page-pane-scroll">${renderConfigPage()}</div></section>
            <section class="page-pane" data-page="modules"><div class="page-pane-scroll">${renderModulesPage()}</div></section>
            <section class="page-pane" data-page="hymofs"><div class="page-pane-scroll">${renderHymoFSPage()}</div></section>
            <section class="page-pane" data-page="logs"><div class="page-pane-scroll">${renderLogsPage()}</div></section>
            <section class="page-pane" data-page="info"><div class="page-pane-scroll">${renderInfoPage()}</div></section>
          </div>
        </main>

        <nav class="bottom-nav" aria-label="${escapeHtml(tr("staticUi.common.navigation", "Navigation"))}">
          <div class="bottom-nav-list">
            ${TABS.map(
              (tab) => `
                <button
                  class="bottom-nav-item ${state.tab === tab.id ? "is-active" : ""}"
                  data-tab="${tab.id}"
                  aria-label="${escapeHtml(getTabLabel(tab.id))}"
                  title="${escapeHtml(getTabLabel(tab.id))}"
                >
                  ${renderTabIcon(tab.icon)}
                  <span class="visually-hidden">${escapeHtml(getTabLabel(tab.id))}</span>
                </button>
              `
            ).join("")}
          </div>
        </nav>
      </div>
      ${renderWarningModal()}
    </div>
  `;
}

function renderWarningModal() {
  if (state.warningAccepted) {
    return "";
  }

  return `
    <div class="overlay">
      <div class="modal">
        <p class="eyebrow">${escapeHtml(tr("staticUi.warning.title", "Experimental Notice"))}</p>
        <h2>${escapeHtml(tr("staticUi.warning.headline", "HymoFS is still experimental"))}</h2>
        <p>${escapeHtml(tr("staticUi.warning.body", "Incorrect kernel implementations, config drift, or incomplete hooks can still hurt performance and stability."))}</p>
        <button class="button" data-action="accept-warning" ${state.warningCountdown > 0 ? "disabled" : ""}>
          ${escapeHtml(
            state.warningCountdown > 0
              ? tr("staticUi.warning.wait", "Wait {seconds}s", { seconds: state.warningCountdown })
              : tr("staticUi.warning.ack", "I understand")
          )}
        </button>
      </div>
    </div>
  `;
}

function renderApp() {
  const app = document.getElementById("app");
  if (!app) {
    return;
  }
  app.classList.remove("boot-shell");
  app.classList.add("app-root");
  app.innerHTML = renderShell();
  bindCarousel();
  updateTabUi({ syncCarousel: true, behavior: "auto" });
  requestAnimationFrame(() => {
    applyPendingRenderMotion();
  });
}

function getTabIndex(tab) {
  const index = TABS.findIndex((item) => item.id === tab);
  return index >= 0 ? index : 0;
}

function syncTabUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set("tab", state.tab);
  window.history.replaceState({}, "", url);
}

function syncCarouselHeight() {
  const carousel = document.getElementById("page-carousel");
  if (!carousel) {
    return;
  }

  const activePane = carousel.querySelector(`.page-pane[data-page="${state.tab}"] .page-pane-scroll`);
  if (!activePane) {
    carousel.style.removeProperty("height");
    return;
  }

  const nextHeight = Math.ceil(activePane.scrollHeight);
  if (nextHeight > 0) {
    carousel.style.height = `${nextHeight}px`;
  }
}

function getCarouselTargetLeft(carousel, tab) {
  const pane = carousel.querySelector(`.page-pane[data-page="${tab}"]`);
  if (pane) {
    return pane.offsetLeft;
  }

  return getTabIndex(tab) * carousel.clientWidth;
}

function getClosestTabFromScroll(carousel) {
  const panes = [...carousel.querySelectorAll(".page-pane")];
  if (panes.length === 0) {
    return state.tab;
  }

  const currentLeft = carousel.scrollLeft;
  let closestPane = panes[0];
  let closestDistance = Math.abs(panes[0].offsetLeft - currentLeft);

  panes.slice(1).forEach((pane) => {
    const distance = Math.abs(pane.offsetLeft - currentLeft);
    if (distance < closestDistance) {
      closestPane = pane;
      closestDistance = distance;
    }
  });

  return closestPane.getAttribute("data-page") || state.tab;
}

function updateTabUi({ syncCarousel = false, behavior = "smooth" } = {}) {
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.getAttribute("data-tab") === state.tab);
  });

  const carousel = document.getElementById("page-carousel");
  if (syncCarousel && carousel) {
    const left = getCarouselTargetLeft(carousel, state.tab);
    if (behavior === "auto") {
      carousel.style.scrollBehavior = "auto";
      carousel.scrollLeft = left;
    } else {
      carousel.scrollTo({ left, behavior });
    }
    requestAnimationFrame(() => {
      if (behavior === "auto") {
        carousel.style.scrollBehavior = "auto";
        carousel.scrollLeft = getCarouselTargetLeft(carousel, state.tab);
        carousel.style.removeProperty("scroll-behavior");
      }
      syncCarouselHeight();
      carousel.classList.remove("is-pending");
    });
  } else {
    requestAnimationFrame(() => {
      syncCarouselHeight();
      carousel?.classList.remove("is-pending");
    });
  }

  syncTabUrl();
  applyLanguage();
}

async function activateTab(tab, { syncCarousel = true, behavior = "smooth" } = {}) {
  if (!TABS.some((item) => item.id === tab)) {
    return;
  }

  state.tab = tab;
  updateTabUi({ syncCarousel, behavior });

  if (tab === "logs" && !state.logs) {
    await refreshLogs();
    queueRenderMotion("logs");
    renderApp();
  }
}

let carouselScrollTimer = null;

function bindCarousel() {
  const carousel = document.getElementById("page-carousel");
  if (!carousel || carousel.dataset.bound === "1") {
    return;
  }

  carousel.dataset.bound = "1";
  carousel.addEventListener("scroll", () => {
    if (carouselScrollTimer) {
      clearTimeout(carouselScrollTimer);
    }

    carouselScrollTimer = setTimeout(async () => {
      const nextTab = getClosestTabFromScroll(carousel);
      if (!nextTab || nextTab === state.tab) {
        syncCarouselHeight();
        return;
      }

      state.tab = nextTab;
      updateTabUi({ syncCarousel: false });

      if (nextTab === "logs" && !state.logs) {
        await refreshLogs();
        renderApp();
      }
    }, 80);
  });
}

async function refreshLogs() {
  try {
    state.logs = await api.readLogs(state.logType, 1000);
  } catch (error) {
    state.logs = "";
    showToast(error.message || tr("logs.loadFailed", "Failed to load logs"), "danger");
  }
}

async function refreshAll() {
  state.loading = true;
  state.error = "";
  renderApp();

  try {
    const [config, modules, storage, systemInfo, userHideRules, allRules, lkmStatus] = await Promise.all([
      api.loadConfig(),
      api.scanModules(),
      api.getStorageUsage(),
      api.getSystemInfo(),
      api.getUserHideRules(),
      api.getAllRules(),
      api.getLkmStatus(),
    ]);

    state.config = { ...clone(DEFAULT_CONFIG), ...config };
    lastSavedConfigSignature = getConfigSignature(state.config);
    state.modules = modules;
    lastSavedModulesSignature = getModulesSignature(state.modules);
    state.storage = storage;
    state.systemInfo = systemInfo;
    state.userHideRules = userHideRules;
    state.allRules = allRules;
    state.lkmStatus = lkmStatus;
    state.lastUpdated = formatUpdatedTime(new Date());

    if (state.tab === "logs") {
      await refreshLogs();
    }
  } catch (error) {
    state.error = error.message || String(error);
  } finally {
    state.loading = false;
    queueRenderMotion("page");
    renderApp();
  }
}

function collectConfigFromDom() {
  if (!document.getElementById("app")) {
    return clone(state.config);
  }

  const get = (name) => document.querySelector(`[name="${name}"]`);
  return {
    ...clone(state.config),
    moduledir: get("moduledir")?.value?.trim() || state.config.moduledir,
    tempdir: get("tempdir")?.value?.trim() || "",
    mountsource: get("mountsource")?.value || state.config.mountsource,
    fs_type: get("fs_type")?.value || state.config.fs_type,
    debug: Boolean(get("debug")?.checked),
    verbose: Boolean(get("verbose")?.checked),
    disable_umount: Boolean(get("disable_umount")?.checked),
    enable_nuke: Boolean(get("enable_nuke")?.checked),
    ignore_protocol_mismatch: Boolean(get("ignore_protocol_mismatch")?.checked),
    enable_kernel_debug: Boolean(get("enable_kernel_debug")?.checked),
    enable_stealth: Boolean(get("enable_stealth")?.checked),
    enable_hidexattr: Boolean(get("enable_hidexattr")?.checked),
    hymofs_enabled: Boolean(get("hymofs_enabled")?.checked),
    uname_release: get("uname_release")?.value || "",
    uname_version: get("uname_version")?.value || "",
    cmdline_value: get("cmdline_value")?.value || "",
    partitions: unique(state.config.partitions || []),
  };
}

function collectModulesFromDom() {
  const containers = [...document.querySelectorAll(".module-card[data-module-id]")];
  if (containers.length === 0) {
    return clone(state.modules);
  }

  const nextModules = clone(state.modules);
  containers.forEach((container) => {
    const moduleId = container.getAttribute("data-module-id");
    const target = nextModules.find((item) => item.id === moduleId);
    if (!target) {
      return;
    }

    const modeSelect = container.querySelector("[data-module-mode]");
    target.mode = modeSelect?.value || target.mode;

    const rules = [...container.querySelectorAll(".rule-row")]
      .map((row) => ({
        path: row.querySelector("[data-rule-path]")?.value?.trim() || "",
        mode: row.querySelector("[data-rule-mode]")?.value || "hymofs",
      }))
      .filter((rule) => rule.path);

    target.rules = rules;
  });

  return nextModules;
}

async function persistModules(nextModules, { silent = true } = {}) {
  const normalizedModules = clone(nextModules);
  const nextSignature = getModulesSignature(normalizedModules);
  state.modules = normalizedModules;

  if (nextSignature === lastSavedModulesSignature) {
    return true;
  }

  const saveTask = async () => {
    if (nextSignature !== lastSavedModulesSignature) {
      await api.saveModules(normalizedModules);
      await api.saveRules(normalizedModules);
      lastSavedModulesSignature = nextSignature;
      state.lastUpdated = formatUpdatedTime(new Date());
    }

    if (!silent) {
      showToast(tr("staticUi.actions.modulesSaved", "Module modes and rules saved"));
    }

    return true;
  };

  moduleSaveQueue = moduleSaveQueue.catch(() => undefined).then(saveTask);

  try {
    return await moduleSaveQueue;
  } catch (error) {
    showToast(error.message || tr("staticUi.errors.saveModulesFailed", "Failed to save modules"), "danger");
    return false;
  }
}

async function persistConfig(nextConfig, { silent = true, refresh = false } = {}) {
  const normalizedConfig = { ...clone(DEFAULT_CONFIG), ...clone(state.config), ...clone(nextConfig) };
  const nextSignature = getConfigSignature(normalizedConfig);
  state.config = normalizedConfig;

  if (nextSignature === lastSavedConfigSignature && !refresh) {
    return true;
  }

  const saveTask = async () => {
    const shouldSave = nextSignature !== lastSavedConfigSignature;
    if (shouldSave) {
      await api.saveConfig(normalizedConfig);
      lastSavedConfigSignature = nextSignature;
      state.lastUpdated = formatUpdatedTime(new Date());
    }

    if (!silent) {
      showToast(tr("config.saved", "Configuration saved"));
    }

    if (refresh) {
      await refreshAll();
    } else {
      renderApp();
    }

    return true;
  };

  configSaveQueue = configSaveQueue.catch(() => undefined).then(saveTask);

  try {
    return await configSaveQueue;
  } catch (error) {
    showToast(error.message || tr("config.saveFailed", "Failed to save configuration"), "danger");
    return false;
  }
}

function isConfigAutoSaveField(target) {
  return (
    target instanceof Element &&
    target.matches("input[name], select[name], textarea[name]") &&
    CONFIG_FIELD_NAMES.has(target.getAttribute("name") || "") &&
    !target.disabled
  );
}

async function handleCheckConflicts() {
  try {
    state.modules = collectModulesFromDom();
    state.conflicts = await api.checkConflicts();
    queueRenderMotion("page");
    renderApp();
    showToast(
      state.conflicts.length === 0
        ? tr("modules.noConflicts", "No conflicts detected")
        : tr("staticUi.modules.conflictsDetected", "{count} conflicts detected", { count: state.conflicts.length }),
      state.conflicts.length === 0 ? "success" : "danger"
    );
  } catch (error) {
    showToast(error.message || tr("modules.checkConflictsFailed", "Failed to check conflicts"), "danger");
  }
}

async function handleAddHideRule(path) {
  const input = document.getElementById("hide-rule-input");
  const value = (path || input?.value || "").trim();
  if (!value || !value.startsWith("/")) {
    showToast(tr("hideRules.absolutePath", "Path must be absolute (start with /)"), "danger");
    return;
  }
  try {
    await api.addUserHideRule(value);
    await loadHideRules();
    if (input) {
      input.value = "";
    }
    queueRenderMotion("page");
    renderApp();
    showToast(tr("staticUi.actions.hideRuleAdded", "Hide rule added: {path}", { path: value }));
  } catch (error) {
    showToast(error.message || tr("hideRules.failedAdd", "Failed to add hide rule"), "danger");
  }
}

async function loadHideRules() {
  const [userHideRules, allRules] = await Promise.all([api.getUserHideRules(), api.getAllRules()]);
  state.userHideRules = userHideRules;
  state.allRules = allRules;
}

async function handleRemoveHideRule(path) {
  try {
    await api.removeUserHideRule(path);
    await loadHideRules();
    queueRenderMotion("page");
    renderApp();
    showToast(tr("staticUi.actions.hideRuleRemoved", "Hide rule removed: {path}", { path }));
  } catch (error) {
    showToast(error.message || tr("hideRules.failedRemove", "Failed to remove hide rule"), "danger");
  }
}

async function handleLkmAction(action) {
  try {
    if (action === "load") {
      await api.lkmLoad();
      showToast(tr("hymofs.lkm.loadSuccess", "LKM loaded"));
    } else if (action === "unload") {
      await api.lkmUnload();
      showToast(tr("hymofs.lkm.unloadSuccess", "LKM unloaded"));
    }
    state.lkmStatus = await api.getLkmStatus();
    queueRenderMotion("page");
    renderApp();
  } catch (error) {
    showToast(
      error.message ||
        (action === "load" ? tr("hymofs.lkm.loadFailed", "Failed to load LKM") : tr("hymofs.lkm.unloadFailed", "Failed to unload LKM")),
      "danger"
    );
  }
}

async function handleSetKmi(clear = false) {
  try {
    const value = clear ? "" : document.getElementById("kmi-input")?.value?.trim() || "";
    if (!clear && !value) {
      showToast(tr("staticUi.errors.kmiRequired", "Please enter a KMI override"), "danger");
      return;
    }
    if (clear) {
      await api.lkmClearKmi();
      showToast(tr("hymofs.lkm.kmiClearSuccess", "KMI override cleared"));
    } else {
      await api.lkmSetKmi(value);
      showToast(tr("hymofs.lkm.kmiSetSuccess", "KMI override set"));
    }
    state.lkmStatus = await api.getLkmStatus();
    queueRenderMotion("page");
    renderApp();
  } catch (error) {
    showToast(
      error.message ||
        (clear ? tr("hymofs.lkm.kmiClearFailed", "Failed to clear KMI override") : tr("hymofs.lkm.kmiSetFailed", "Failed to set KMI override")),
      "danger"
    );
  }
}

async function handleToggleAutoload(target) {
  try {
    await api.lkmSetAutoload(Boolean(target.checked));
    state.lkmStatus.autoload = Boolean(target.checked);
    queueRenderMotion("page");
    renderApp();
    showToast(tr("hymofs.lkm.autoloadSuccess", "Autoload updated"));
  } catch (error) {
    target.checked = !target.checked;
    showToast(error.message || tr("hymofs.lkm.autoloadFailed", "Failed to set autoload"), "danger");
  }
}

async function handleHotToggle(moduleId, mounted) {
  try {
    if (mounted) {
      await api.hotUnmount(moduleId);
      showToast(tr("staticUi.actions.hotUnmounted", "Hot unmounted {id}", { id: moduleId }));
    } else {
      await api.hotMount(moduleId);
      showToast(tr("staticUi.actions.hotMounted", "Hot mounted {id}", { id: moduleId }));
    }
    state.systemInfo = await api.getSystemInfo();
    queueRenderMotion("module", `.module-card[data-module-id="${moduleId}"]`);
    renderApp();
  } catch (error) {
    showToast(
      error.message || (mounted ? tr("modules.hotUnmountFailed", "Hot Unmount Failed") : tr("modules.hotMountFailed", "Hot Mount Failed")),
      "danger"
    );
  }
}

async function handlePartitionScan() {
  try {
    const additions = await api.scanPartitionsFromModules(state.config.moduledir);
    state.config.partitions = unique([...(state.config.partitions || []), ...additions]);
    renderApp();
    await persistConfig(state.config, { silent: true });
    showToast(
      additions.length > 0
        ? tr("staticUi.actions.partitionsAdded", "{count} candidate partitions added", { count: additions.length })
        : tr("config.noNewPartitions", "No new partitions found")
    );
  } catch (error) {
    showToast(error.message || tr("config.scanPartitionsFailed", "Failed to scan partitions"), "danger");
  }
}

async function handleAddPartition() {
  const input = document.getElementById("partition-input");
  const parts = String(input?.value || "")
    .split(/[, ]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  state.config.partitions = unique([...(state.config.partitions || []), ...parts]);
  if (input) {
    input.value = "";
  }
  renderApp();
  await persistConfig(state.config, { silent: true });
}

async function handleRemovePartition(partition) {
  state.config.partitions = (state.config.partitions || []).filter((item) => item !== partition);
  renderApp();
  await persistConfig(state.config, { silent: true });
}

function handleAddModuleRule(moduleId) {
  state.modules = collectModulesFromDom();
  const target = state.modules.find((item) => item.id === moduleId);
  if (!target) {
    return;
  }
  target.rules = [...(target.rules || []), { path: "", mode: "hymofs" }];
  queueRenderMotion("module", `.module-card[data-module-id="${moduleId}"]`);
  renderApp();
}

async function handleRemoveModuleRule(moduleId, index) {
  state.modules = collectModulesFromDom();
  const target = state.modules.find((item) => item.id === moduleId);
  if (!target) {
    return;
  }
  target.rules = (target.rules || []).filter((_item, ruleIndex) => ruleIndex !== index);
  queueRenderMotion("module", `.module-card[data-module-id="${moduleId}"]`);
  renderApp();
  await persistModules(state.modules, { silent: true });
}

function handleToggleModuleExpanded(moduleId) {
  state.modules = collectModulesFromDom();
  const target = state.modules.find((item) => item.id === moduleId);
  if (!target) {
    return;
  }

  const nextExpanded = !isModuleExpanded(target);
  if (nextExpanded) {
    state.moduleExpanded[moduleId] = true;
  } else {
    delete state.moduleExpanded[moduleId];
  }
  queueRenderMotion("module", `.module-card[data-module-id="${moduleId}"]`);
  renderApp();
}

async function handleRefreshLogs() {
  await refreshLogs();
  queueRenderMotion("logs");
  renderApp();
}

async function handleClearLogs() {
  try {
    await api.clearLogs();
    await refreshLogs();
    queueRenderMotion("logs");
    renderApp();
    showToast(tr("logs.cleared", "Logs cleared successfully"));
  } catch (error) {
    showToast(error.message || tr("logs.clearFailed", "Failed to clear logs"), "danger");
  }
}

async function handleCopyLogs() {
  try {
    await navigator.clipboard.writeText(state.logs || "");
    showToast(tr("logs.copied", "Copied to clipboard"));
  } catch (_error) {
    showToast(tr("staticUi.logs.copyFailed", "Failed to copy logs"), "danger");
  }
}

function beginWarningCountdown() {
  if (state.warningAccepted || warningTimer) {
    return;
  }

  warningTimer = setInterval(() => {
    state.warningCountdown -= 1;
    if (state.warningCountdown <= 0) {
      clearInterval(warningTimer);
      warningTimer = null;
      state.warningCountdown = 0;
    }
    renderApp();
  }, 1000);
}

function acceptWarning() {
  if (state.warningCountdown > 0) {
    return;
  }
  state.warningAccepted = true;
  localStorage.setItem("hymo_experimental_ack", "true");
  renderApp();
}

document.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-tab], [data-action], [data-remove-partition]");
  if (!target) {
    return;
  }

  if (target.hasAttribute("data-tab")) {
    await activateTab(target.getAttribute("data-tab"));
    return;
  }

  if (target.hasAttribute("data-remove-partition")) {
    await handleRemovePartition(target.getAttribute("data-remove-partition"));
    return;
  }

  const action = target.getAttribute("data-action");
  if (!action) {
    return;
  }

  switch (action) {
    case "cycle-theme":
      cycleTheme();
      break;
    case "refresh-all":
      await refreshAll();
      break;
    case "accept-warning":
      acceptWarning();
      break;
    case "reload-config":
      state.config = { ...clone(DEFAULT_CONFIG), ...(await api.loadConfig()) };
      lastSavedConfigSignature = getConfigSignature(state.config);
      queueRenderMotion("page");
      renderApp();
      break;
    case "scan-partitions":
      await handlePartitionScan();
      break;
    case "add-partition":
      await handleAddPartition();
      break;
    case "check-conflicts":
      await handleCheckConflicts();
      break;
    case "add-module-rule":
      handleAddModuleRule(target.getAttribute("data-module-id"));
      break;
    case "remove-module-rule":
      await handleRemoveModuleRule(target.getAttribute("data-module-id"), Number(target.getAttribute("data-rule-index")));
      break;
    case "toggle-module-expanded":
      handleToggleModuleExpanded(target.getAttribute("data-module-id"));
      break;
    case "hot-mount":
      await handleHotToggle(target.getAttribute("data-module-id"), false);
      break;
    case "hot-unmount":
      await handleHotToggle(target.getAttribute("data-module-id"), true);
      break;
    case "add-hide-rule":
      await handleAddHideRule();
      break;
    case "quick-hide":
      await handleAddHideRule(target.getAttribute("data-path"));
      break;
    case "remove-hide-rule":
      await handleRemoveHideRule(target.getAttribute("data-path"));
      break;
    case "lkm-load":
      await handleLkmAction("load");
      break;
    case "lkm-unload":
      await handleLkmAction("unload");
      break;
    case "set-kmi":
      await handleSetKmi(false);
      break;
    case "clear-kmi":
      await handleSetKmi(true);
      break;
    case "set-log-type":
      state.logType = target.getAttribute("data-log-type") || "system";
      await refreshLogs();
      queueRenderMotion("logs");
      renderApp();
      break;
    case "refresh-logs":
      await handleRefreshLogs();
      break;
    case "clear-logs":
      await handleClearLogs();
      break;
    case "copy-logs":
      await handleCopyLogs();
      break;
    default:
      break;
  }
});

document.addEventListener("input", (event) => {
  const target = event.target;
  if (target.matches("[data-role='module-search']")) {
    state.moduleSearch = target.value;
    renderApp();
    return;
  }

  if (target.matches("[data-role='log-search']")) {
    state.logSearch = target.value;
    renderApp();
  }
});

document.addEventListener("focusout", async (event) => {
  const target = event.target;
  if (!isConfigAutoSaveField(target)) {
    if (target.matches("[data-rule-path]")) {
      await persistModules(collectModulesFromDom(), { silent: true });
    }
    return;
  }

  if (target.matches("select, input[type='checkbox']")) {
    return;
  }

  await persistConfig(collectConfigFromDom(), { silent: true });
});

document.addEventListener("change", async (event) => {
  const target = event.target;
  if (target.matches("[data-role='language-select']")) {
    setLanguage(target.value);
    return;
  }

  if (target.matches("[data-role='module-filter']")) {
    state.moduleFilter = target.value;
    renderApp();
    return;
  }

  if (isConfigAutoSaveField(target)) {
    await persistConfig(collectConfigFromDom(), { silent: true });
    return;
  }

  if (target.matches("[data-module-mode], [data-rule-mode]")) {
    await persistModules(collectModulesFromDom(), { silent: true });
    return;
  }

  if (target.matches("[data-action='toggle-autoload']")) {
    handleToggleAutoload(target);
  }
});

async function bootstrap() {
  applyTheme();
  applyLanguage();
  localizeBootShell();
  try {
    await enableEdgeToEdge(true);
  } catch (_error) {
    // ignore
  }

  beginWarningCountdown();
  await refreshAll();
}

bootstrap();

let resizeSyncTimer = null;
window.addEventListener("resize", () => {
  if (resizeSyncTimer) {
    clearTimeout(resizeSyncTimer);
  }

  resizeSyncTimer = setTimeout(() => {
    updateTabUi({ syncCarousel: true, behavior: "auto" });
  }, 90);
});
