<script>
  import { store } from '../lib/store.svelte';
  import { ICONS, DEFAULT_CONFIG } from '../lib/constants';
  import FilePicker from '../components/FilePicker.svelte';
  
  import './ConfigTab.css';
  let partitionInput = $state("");
  let showFilePicker = $state(false);

  // Validation Helpers
  const isValidPath = (p) => !p || (p.startsWith('/') && p.length > 1);
  
  let invalidModuleDir = $derived(!isValidPath(store.config.moduledir));
  let invalidTempDir = $derived(store.config.tempdir && !isValidPath(store.config.tempdir));
  
  function save() {
    if (invalidModuleDir || invalidTempDir) {
      store.showToast(store.L.config.invalidPath, "error");
      return;
    }
    if (partitionInput.trim()) {
       addPartition(partitionInput);
       partitionInput = "";
    }
    store.saveConfig();
  }

  function addPartition(name) {
    const parts = name.split(/[, ]+/).map(s => s.trim()).filter(Boolean);
    for (const p of parts) {
      if (!store.config.partitions.includes(p)) {
        store.config.partitions.push(p);
      }
    }
  }

  function removePartition(index) {
    store.config.partitions.splice(index, 1);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === ',') {
      e.preventDefault();
      addPartition(partitionInput);
      partitionInput = "";
    } else if (e.key === 'Backspace' && partitionInput === "" && store.config.partitions.length > 0) {
      removePartition(store.config.partitions.length - 1);
    }
  }
  
  function resetTempDir() {
    store.config.tempdir = "";
  }

  function handleFileSelect(dataUrl) {
    store.setBackgroundImage(dataUrl);
    showFilePicker = false;
  }
</script>

{#if showFilePicker}
  <FilePicker on:select={(e) => handleFileSelect(e.detail)} on:close={() => showFilePicker = false} />
{/if}

<div class="md3-card">
  <div class="switch-row">
    <span>{store.L.config.showAdvanced}</span>
    <label class="md3-switch">
      <input type="checkbox" checked={store.showAdvanced} onchange={(e) => store.setShowAdvanced(e.target.checked)}>
      <span class="track"><span class="thumb"></span></span>
    </label>
  </div>

  <div class="switch-row">
    <span>{store.L.config.verboseLabel}</span>
    <label class="md3-switch">
      <input type="checkbox" bind:checked={store.config.verbose}>
      <span class="track"><span class="thumb"></span></span>
    </label>
  </div>
  
  <div class="switch-row">
    <span>{store.L.config.forceExt4}</span>
    <label class="md3-switch">
      <input type="checkbox" bind:checked={store.config.force_ext4}>
      <span class="track"><span class="thumb"></span></span>
    </label>
  </div>

  <div class="switch-row">
    <span>{store.L.config.enableNuke}</span>
    <label class="md3-switch">
      <input type="checkbox" bind:checked={store.config.enable_nuke}>
      <span class="track"><span class="thumb"></span></span>
    </label>
  </div>

  <div class="switch-row">
    <span>{store.L.config.enableStealth}</span>
    <label class="md3-switch">
      <input type="checkbox" bind:checked={store.config.enable_stealth}>
      <span class="track"><span class="thumb"></span></span>
    </label>
  </div>

  {#if store.showAdvanced}
  <div class="switch-row">
    <span>{store.L.config.disableUmount}</span>
    <label class="md3-switch">
      <input type="checkbox" bind:checked={store.config.disable_umount}>
      <span class="track"><span class="thumb"></span></span>
    </label>
  </div>

  <div class="switch-row">
    <span>{store.L.config.enableKernelDebug}</span>
    <label class="md3-switch">
      <input type="checkbox" bind:checked={store.config.enable_kernel_debug}>
      <span class="track"><span class="thumb"></span></span>
    </label>
  </div>
  {/if}

  {#if store.showAdvanced && store.config.hymofs_status !== 1}
  <div class="switch-row">
    <span>{store.L.config.ignoreProtocolMismatch}</span>
    <label class="md3-switch">
      <input type="checkbox" bind:checked={store.config.ignore_protocol_mismatch}>
      <span class="track"><span class="thumb"></span></span>
    </label>
  </div>
  {/if}
</div>

<div class="md3-card">
  <div class="text-field filled" class:error={invalidModuleDir}>
    <input type="text" id="c-moduledir" bind:value={store.config.moduledir} placeholder={DEFAULT_CONFIG.moduledir} />
    <label for="c-moduledir">{store.L.config.moduleDir}</label>
  </div>
  
  <div class="text-field filled" class:error={invalidTempDir} style="display:flex; align-items:center;">
    <input type="text" id="c-tempdir" bind:value={store.config.tempdir} placeholder={store.L.config.autoPlaceholder} />
    <label for="c-tempdir">{store.L.config.tempDir}</label>
    
    {#if store.config.tempdir}
      <button class="icon-reset" onclick={resetTempDir} title={store.L.config.reset}>
        ✕
      </button>
    {/if}
  </div>
  
  <div class="text-field filled">
    <input type="text" id="c-mountsource" bind:value={store.config.mountsource} placeholder={DEFAULT_CONFIG.mountsource} />
    <label for="c-mountsource">{store.L.config.mountSource}</label>
  </div>
  
  <!-- Chip Input for Partitions -->
  <div 
    class="text-field filled chip-input-container" 
    onclick={() => document.getElementById('c-partitions').focus()}
    role="button"
    tabindex="0"
    onkeydown={(e) => e.key === 'Enter' && document.getElementById('c-partitions').focus()}
  >
    <div class="chip-wrapper">
      {#each store.config.partitions as part, i}
        <span class="chip">
          {part}
          <button class="chip-remove" onclick={(e) => { e.stopPropagation(); removePartition(i); }}>×</button>
        </span>
      {/each}
      <input 
        type="text" 
        id="c-partitions" 
        bind:value={partitionInput} 
        onkeydown={handleKeyDown} 
        placeholder={store.config.partitions.length === 0 ? "mi_ext, my_stock" : ""} 
        autocomplete="off"
      />
    </div>
    <label for="c-partitions">{store.L.config.partitions}</label>
    <button class="icon-scan" onclick={(e) => { e.stopPropagation(); store.syncPartitions(); }} title={store.L.config.syncPartitions || "Scan"}>
      <svg viewBox="0 0 24 24" width="18" height="18"><path d={ICONS.refresh} fill="currentColor"/></svg>
    </button>
  </div>
</div>

<div class="md3-card">
  {#if store.backgroundImage}
  <div class="switch-row">
    <span>{store.L.config.uiOpacity || "UI Opacity"} ({Math.round(store.uiOpacity * 100)}%)</span>
    <input 
      type="range" 
      min="0.1" 
      max="1.0" 
      step="0.01" 
      value={store.uiOpacity} 
      oninput={(e) => store.setUiOpacity(parseFloat(e.target.value))}
      style="width: 150px; --progress: {((store.uiOpacity - 0.1) / 0.9) * 100}%"
    />
  </div>
  {/if}

  <div class="switch-row">
    <span>{store.L.config.backgroundImage}</span>
    <div style="display: flex; gap: 8px; align-items: center;">
       <button class="btn-tonal" style="box-shadow: var(--md-sys-elevation-1);" onclick={() => showFilePicker = true}>
         {store.L.config.selectImage || "Select Image"}
       </button>
       {#if store.backgroundImage}
         <button class="btn-text" onclick={() => store.setBackgroundImage('')}>
           {store.L.config.clearImage || "Clear"}
         </button>
       {/if}
    </div>
  </div>
</div>

<div class="bottom-actions">
  <button 
    class="btn-tonal" 
    onclick={() => store.loadConfig()} 
    disabled={store.loading.config}
    title={store.L.config.reload}
  >
    <svg viewBox="0 0 24 24" width="20" height="20"><path d={ICONS.refresh} fill="currentColor"/></svg>
  </button>
  <button class="btn-filled" onclick={save} disabled={store.saving.config}>
    <svg viewBox="0 0 24 24" width="18" height="18"><path d={ICONS.save} fill="currentColor"/></svg>
    {store.saving.config ? store.L.common.saving : store.L.config.save}
  </button>
</div>

<style>
  .chip-input-container {
    height: auto;
    min-height: 56px;
    display: flex;
    flex-direction: column;
    cursor: text;
    padding: 0 !important; /* Override default padding */
  }

  .chip-wrapper {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 24px 48px 8px 16px;
    width: 100%;
  }

  .chip-wrapper input {
    flex: 1;
    min-width: 80px;
    background: transparent !important;
    border: none !important;
    padding: 0 !important;
    height: 24px !important;
    font-size: 16px;
    outline: none;
    margin: 0;
    border-radius: 0 !important;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    background: var(--md-sys-color-secondary-container);
    color: var(--md-sys-color-on-secondary-container);
    border-radius: 8px;
    padding: 0 8px;
    height: 24px;
    font-size: 14px;
    gap: 4px;
    user-select: none;
  }

  .chip-remove {
    background: none;
    border: none;
    padding: 0;
    color: inherit;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    display: flex;
    align-items: center;
    opacity: 0.6;
    width: 16px;
    height: 16px;
    justify-content: center;
    border-radius: 50%;
  }
  
  .chip-remove:hover {
    opacity: 1;
    background-color: rgba(0,0,0,0.1);
  }

  /* Override label position */
  :global(.text-field.filled.chip-input-container label) {
    top: 8px;
    left: 16px;
    font-size: 12px;
    color: var(--md-sys-color-primary);
    pointer-events: none;
  }

  .icon-scan {
    position: absolute;
    right: 12px;
    top: 12px;
    background: none;
    border: none;
    color: var(--md-sys-color-primary);
    cursor: pointer;
    padding: 8px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .icon-scan:hover {
    background-color: rgba(128,128,128, 0.1);
  }
</style>