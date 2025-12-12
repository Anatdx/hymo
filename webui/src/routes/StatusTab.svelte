<script>
  import { onMount } from 'svelte';
  import { store } from '../lib/store.svelte';
  import { ICONS } from '../lib/constants';
  import { BUILTIN_PARTITIONS } from '../lib/constants_gen';
  import './StatusTab.css';

  onMount(() => {
    store.loadStatus();
  });

  // Combine built-in partitions with user configured ones
  let displayPartitions = $derived([...new Set([...BUILTIN_PARTITIONS, ...store.config.partitions])]);
  let storageLabel = $derived((store.storage.type === 'tmpfs' || store.storage.type === 'hymofs') ? store.systemInfo.mountBase : store.L.status.storageDesc);
  
  // Check if HymoFS is supported (based on systemInfo or other indicators)
  // We use store.config.hymofs_available which comes from 'show-config' (HymoFS::is_available())
  // If supported, we show the count (defaulting to 0 if not yet loaded).
  // If not supported, we show the "Not Supported" indicator (❌).
  let hymoFsCount = $derived(store.config.hymofs_available ? (store.systemInfo.hymofsModules?.length ?? 0) : store.L.status.notSupported);

  $effect(() => {
    if (store.systemInfo.hymofsMismatch) {
      const msg = store.systemInfo.mismatchMessage || "⚠️ HymoFS Protocol Mismatch! Please update kernel/module.";
      store.showToast(msg, "error");
    }
  });
</script>

<div class="dashboard-grid">
  <div class="storage-card">
    <div class="storage-header">
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="storage-title">{store.L.status.storageTitle}</span>
        
        {#if store.storage.type && store.storage.type !== 'unknown'}
          <span class="storage-type-badge {store.storage.type === 'tmpfs' ? 'type-tmpfs' : 'type-ext4'}">
            {store.storage.type.toUpperCase()}
          </span>
        {/if}
      </div>
      
      <div class="storage-value">
        {store.storage.percent}
      </div>
    </div>
    
    <div class="progress-track">
      <div class="progress-fill" style="width: {store.storage.percent}"></div>
    </div>

    <div class="storage-details">
      <span>{storageLabel}</span>
      <span>{store.storage.used} / {store.storage.size}</span>
    </div>
  </div>

  <div class="stats-row">
    <div class="stat-card">
      <div class="stat-value">{store.modules.length}</div>
      <div class="stat-label">{store.L.status.moduleActive}</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">{hymoFsCount}</div>
      <div class="stat-label">HymoFS</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">{store.config.mountsource}</div>
      <div class="stat-label">{store.L.config.mountSource}</div>
    </div>
  </div>

  <div class="mode-card">
    <div class="storage-title" style="margin-bottom: 12px;">{store.L.status.activePartitions}</div>
    <div class="partition-grid">
      {#each displayPartitions as part}
        <div class="part-chip {store.activePartitions.includes(part) ? 'active' : 'inactive'}">
          {part}
        </div>
      {/each}
    </div>
  </div>

  <div class="mode-card">
    <div class="storage-title" style="margin-bottom: 12px;">{store.L.status.sysInfoTitle}</div>
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">{store.L.status.kernel}</span>
        <span class="info-val">{store.systemInfo.kernel}</span>
      </div>
      <div class="info-item">
        <span class="info-label">{store.L.status.selinux}</span>
        <span class="info-val">{store.systemInfo.selinux}</span>
      </div>
      <div class="info-item full-width">
        <span class="info-label">{store.L.status.mountBase}</span>
        <span class="info-val mono">{store.systemInfo.mountBase}</span>
      </div>
    </div>
  </div>

  <div class="mode-card">
    <div class="storage-title" style="margin-bottom: 8px;">{store.L.status.modeStats}</div>
    
    <div class="mode-row">
      <div class="mode-name">
        <div class="dot" style="background-color: var(--md-sys-color-outline)"></div>
        {store.L.status.modeAuto}
      </div>
      <span class="mode-count">{store.modeStats.auto}</span>
    </div>

    <div style="height: 1px; background-color: var(--md-sys-color-outline-variant); opacity: 0.5;"></div>

    <div class="mode-row">
      <div class="mode-name">
        <div class="dot" style="background-color: var(--md-sys-color-primary)"></div>
        {store.L.status.modeOverlay}
      </div>
      <span class="mode-count">{store.modeStats.overlay}</span>
    </div>

    <div style="height: 1px; background-color: var(--md-sys-color-outline-variant); opacity: 0.5;"></div>

    <div class="mode-row">
      <div class="mode-name">
        <div class="dot" style="background-color: var(--md-sys-color-tertiary)"></div>
        {store.L.status.modeMagic}
      </div>
      <span class="mode-count">{store.modeStats.magic}</span>
    </div>
  </div>
</div>

<div class="bottom-actions">
  <div style="flex:1"></div>
  <button 
    class="btn-tonal" 
    onclick={() => store.loadStatus()} 
    disabled={store.loading.status}
    title={store.L.logs.refresh}
  >
    <svg viewBox="0 0 24 24" width="20" height="20"><path d={ICONS.refresh} fill="currentColor"/></svg>
  </button>
</div>