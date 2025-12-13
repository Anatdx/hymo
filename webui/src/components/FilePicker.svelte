<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { API } from '../lib/api';
  import { store } from '../lib/store.svelte';
  
  const dispatch = createEventDispatcher();
  
  let currentPath = $state('/sdcard');
  let files = $state([]);
  let loading = $state(false);
  let error = $state('');
  let previewData = $state(null);

  async function loadFiles(path) {
    loading = true;
    error = '';
    previewData = null;
    try {
      const list = await API.listFiles(path);
      // Sort: Directories first, then files
      files = list.sort((a, b) => {
        if (a.isDir && !b.isDir) return -1;
        if (!a.isDir && b.isDir) return 1;
        return a.name.localeCompare(b.name);
      });
      currentPath = path;
    } catch (e) {
      error = "Failed to list files";
    }
    loading = false;
  }

  function goUp() {
    const parent = currentPath.split('/').slice(0, -1).join('/') || '/';
    loadFiles(parent);
  }

  async function handleSelect(file) {
    if (file.isDir) {
      loadFiles(file.path);
      return;
    }
    
    // Check extension
    if (!file.name.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
      store.showToast("Not an image file", "error");
      return;
    }
    
    loading = true;
    const base64 = await API.readFileBase64(file.path);
    loading = false;
    
    if (base64) {
      const url = `data:image/${file.name.split('.').pop()};base64,${base64}`;
      previewData = { url, name: file.name };
    } else {
      store.showToast("Failed to read file", "error");
    }
  }

  function confirmPreview() {
    if (previewData) {
      dispatch('select', previewData.url);
    }
  }

  function cancelPreview() {
    previewData = null;
  }

  // Initial load
  onMount(() => {
    loadFiles(currentPath);
  });
</script>

<div class="file-picker-overlay" transition:fade={{ duration: 200 }}>
  <div class="file-picker-modal md3-card" transition:scale={{ duration: 250, start: 0.95, easing: cubicOut }}>
    <div class="header">
      <h3>Select Image</h3>
      <button class="btn-icon" onclick={() => dispatch('close')}>✕</button>
    </div>
    
    <div class="path-bar">
      <button class="btn-text" onclick={goUp} disabled={currentPath === '/'}>⬆️ ..</button>
      <span class="path">{currentPath}</span>
    </div>

    <div class="file-list">
      {#if loading}
        <div class="loading">Loading...</div>
      {:else if previewData}
        <div class="preview-container">
          <div class="preview-image-wrapper">
            <img src={previewData.url} alt="Preview" class="preview-image" />
          </div>
          <div class="preview-info">{previewData.name}</div>
          <div class="preview-actions">
            <button class="btn-tonal" onclick={cancelPreview}>Cancel</button>
            <button class="btn-filled" onclick={confirmPreview}>Use Image</button>
          </div>
        </div>
      {:else if error}
        <div class="error">{error}</div>
      {:else}
        {#each files as file}
          <button class="file-item" onclick={() => handleSelect(file)}>
            <span class="icon">{file.isDir ? '📁' : (file.name.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? '🖼️' : '📄')}</span>
            <span class="name">{file.name}</span>
          </button>
        {/each}
        {#if files.length === 0}
          <div class="empty">Empty directory</div>
        {/if}
      {/if}
    </div>
  </div>
</div>

<style>
  .file-picker-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }
  
  .file-picker-modal {
    width: 100%;
    max-width: 500px;
    height: 80vh;
    display: flex;
    flex-direction: column;
    background: var(--md-sys-color-surface-container-opaque, var(--md-sys-color-surface-container));
    color: var(--md-sys-color-on-surface);
    padding: 0;
    overflow: hidden;
  }
  
  .header {
    padding: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--md-sys-color-outline-variant);
  }
  
  .path-bar {
    padding: 8px 16px;
    background: var(--md-sys-color-surface-variant);
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: monospace;
    font-size: 0.9em;
  }
  
  .path {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .file-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }
  
  .file-item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px;
    border: none;
    background: none;
    color: inherit;
    text-align: left;
    cursor: pointer;
    border-radius: 8px;
  }
  
  .file-item:hover {
    background: var(--md-sys-color-surface-variant);
  }
  
  .loading, .empty, .error {
    padding: 20px;
    text-align: center;
    opacity: 0.7;
  }
  
  .error {
    color: var(--md-sys-color-error);
  }

  .preview-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
    padding: 16px;
    gap: 16px;
  }

  .preview-image-wrapper {
    flex: 1;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background: var(--md-sys-color-surface-variant);
    border-radius: 12px;
  }

  .preview-image {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  .preview-info {
    font-weight: 500;
  }

  .preview-actions {
    display: flex;
    gap: 16px;
    width: 100%;
    justify-content: center;
  }
</style>