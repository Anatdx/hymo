<script>
  import { store } from '../lib/store.svelte';
  import { ICONS, DEFAULT_CONFIG } from '../lib/constants';
  import FilePicker from '../components/FilePicker.svelte';
  
  import './ConfigTab.css';
  let partitionInput = $state(store.config.partitions.join(', '));
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
    store.config.partitions = partitionInput.split(',').map(s => s.trim()).filter(Boolean);
    store.saveConfig();
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
  <div class="text-field filled">
    <input type="text" id="c-partitions" bind:value={partitionInput} placeholder="mi_ext, my_stock" />
    <label for="c-partitions">{store.L.config.partitions}</label>
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