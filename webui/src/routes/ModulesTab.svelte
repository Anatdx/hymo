<script>
  import { store } from '../lib/store.svelte';
  import { API } from '../lib/api';
  import { ICONS } from '../lib/constants';
  import { onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import Skeleton from '../components/Skeleton.svelte';
  import './ModulesTab.css';

  let searchQuery = $state('');
  let filterType = $state('all');
  let expandedMap = $state({}); // Track expanded modules by ID

  onMount(() => {
    store.loadModules();
  });

  // Derived state: Filter modules based on search query and mode
  let filteredModules = $derived(store.modules.filter(m => {
    const q = searchQuery.toLowerCase();
    const matchSearch = m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q);
    const matchFilter = filterType === 'all' || m.mode === filterType;
    return matchSearch && matchFilter;
  }));

  function toggleExpand(id) {
    if (expandedMap[id]) {
      delete expandedMap[id];
    } else {
      expandedMap[id] = true;
    }
    // Re-assign to trigger reactivity
    expandedMap = { ...expandedMap };
  }

  function addRule(mod) {
    if (!mod.rules) mod.rules = [];
    mod.rules.push({ path: '', mode: 'hymofs' });
    // Trigger reactivity
    store.modules = [...store.modules];
  }

  function removeRule(mod, index) {
    mod.rules.splice(index, 1);
    store.modules = [...store.modules];
  }

  function handleKeydown(e, id) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleExpand(id);
    }
  }

  async function handleHotToggle(mod) {
    const isMounted = store.activeHymoModules.includes(mod.id);
    try {
        if (isMounted) {
            await API.hotUnmount(mod.id);
            store.showToast(`Hot Unmounted: ${mod.name}`);
        } else {
            await API.hotMount(mod.id);
            store.showToast(`Hot Mounted: ${mod.name}`);
        }
        // Refresh status and modules to update UI immediately
        await Promise.all([
            store.loadStatus(),
            store.loadModules()
        ]);
    } catch (e) {
        store.showToast('Operation failed', 'error');
    }
  }
</script>

<div class="md3-card desc-card">
  <p class="desc-text">
    {store.L.modules.desc}
  </p>
</div>

<div class="search-container">
  <svg class="search-icon" viewBox="0 0 24 24"><path d={ICONS.search} /></svg>
  <input 
    type="text" 
    class="search-input" 
    placeholder={store.L.modules.searchPlaceholder}
    bind:value={searchQuery}
  />
  <div class="filter-controls">
    <span class="filter-label-text">{store.L.modules.filterLabel}</span>
    <select class="filter-select" bind:value={filterType}>
      <option value="all">{store.L.modules.filterAll}</option>
      <option value="auto">{store.L.modules.modeAuto}</option>
      <option value="overlay">{store.L.modules.modeOverlay}</option>
      <option value="magic">{store.L.modules.modeMagic}</option>
      <option value="none">None</option>
    </select>
  </div>
</div>

{#if store.loading.modules}
  <div class="rules-list">
    {#each Array(5) as _}
      <div class="rule-card">
        <div class="rule-info">
          <div class="skeleton-group">
            <Skeleton width="60%" height="20px" />
            <Skeleton width="40%" height="14px" />
          </div>
        </div>
        <Skeleton width="120px" height="40px" borderRadius="4px" />
      </div>
    {/each}
  </div>
{:else if filteredModules.length === 0}
  <div class="empty-state">
    {store.modules.length === 0 ? store.L.modules.empty : "No matching modules"}
  </div>
{:else}
  <div class="rules-list">
    {#each filteredModules as mod (mod.id)}
      <div 
        class="rule-card" 
        class:expanded={expandedMap[mod.id]} 
        onclick={() => toggleExpand(mod.id)}
        onkeydown={(e) => handleKeydown(e, mod.id)}
        role="button"
        tabindex="0"
      >
        <div class="rule-main">
          <div class="rule-info">
            <div class="info-col">
              <span class="module-name">{mod.name}</span>
              <span class="module-id">{mod.id} <span class="version-tag">{mod.version}</span></span>
            </div>
          </div>
          
          <div class="mode-badge {mod.mode === 'magic' ? 'badge-magic' : (mod.mode === 'overlay' ? 'badge-overlay' : (mod.mode === 'none' ? 'badge-none' : 'badge-auto'))}">
            {mod.mode === 'magic' ? store.L.modules.modeMagic : (mod.mode === 'overlay' ? store.L.modules.modeOverlay : (mod.mode === 'none' ? 'None' : store.L.modules.modeAuto))}
          </div>
        </div>
        
        {#if expandedMap[mod.id]}
          <div class="rule-details" transition:slide={{ duration: 200 }}>
            <p class="module-desc">{mod.description || 'No description'}</p>
            <p class="module-meta">Author: {mod.author || 'Unknown'}</p>
            
            <div class="config-section">
              <div class="config-row">
                <span class="config-label">{store.L.config.title}:</span>
                <div class="text-field compact-select">
                  <select 
                    bind:value={mod.mode}
                    onclick={(e) => e.stopPropagation()}
                    onkeydown={(e) => e.stopPropagation()}
                  >
                    <option value="auto">{store.L.modules.modeAuto}</option>
                    <option value="overlay">{store.L.modules.modeOverlay}</option>
                    <option value="magic">{store.L.modules.modeMagic}</option>
                    <option value="none">None</option>
                  </select>
                </div>
              </div>

              <!-- Custom Rules Section -->
              <div class="rules-section">
                <div class="rules-header">
                  <span class="config-label">{store.L.modules.customRules}</span>
                  <button class="btn-icon small" onclick={(e) => { e.stopPropagation(); addRule(mod); }} title={store.L.modules.addRule}>
                    <svg viewBox="0 0 24 24" width="18" height="18"><path d={ICONS.add} fill="currentColor"/></svg>
                  </button>
                </div>
                
                {#if mod.rules && mod.rules.length > 0}
                  <div class="rules-list-container">
                    {#each mod.rules as rule, i}
                      <div class="rule-item">
                        <input 
                            type="text" 
                            class="rule-path" 
                            bind:value={rule.path} 
                            placeholder="/system/..." 
                            onclick={(e) => e.stopPropagation()} 
                            onkeydown={(e) => e.stopPropagation()}
                        />
                        <select 
                            class="rule-mode" 
                            bind:value={rule.mode} 
                            onclick={(e) => e.stopPropagation()}
                            onkeydown={(e) => e.stopPropagation()}
                        >
                          <option value="hymofs">HymoFS</option>
                          <option value="overlay">Overlay</option>
                          <option value="magic">Magic</option>
                          <option value="none">None</option>
                        </select>
                        <button class="btn-icon small delete" onclick={(e) => { e.stopPropagation(); removeRule(mod, i); }} title={store.L.modules.removeRule}>
                          <svg viewBox="0 0 24 24" width="16" height="16"><path d={ICONS.delete} fill="currentColor"/></svg>
                        </button>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>

              {#if mod.strategy === 'hymofs' || (mod.mode === 'auto' && store.activeHymoModules.length > 0)}
                 <div class="config-row" style="margin-top: 12px;">
                    <button class="btn-tonal full-width" onclick={(e) => { e.stopPropagation(); handleHotToggle(mod); }}>
                        {store.activeHymoModules.includes(mod.id) ? store.L.modules.hotUnmount : store.L.modules.hotMount}
                    </button>
                 </div>
              {/if}
            </div>

          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<div class="bottom-actions">
  <button class="btn-tonal" onclick={() => store.loadModules()} disabled={store.loading.modules} title={store.L.modules.reload}>
    <svg viewBox="0 0 24 24" width="20" height="20"><path d={ICONS.refresh} fill="currentColor"/></svg>
  </button>
  <button class="btn-filled" onclick={() => store.saveModules()} disabled={store.saving.modules}>
    <svg viewBox="0 0 24 24" width="18" height="18"><path d={ICONS.save} fill="currentColor"/></svg>
    {store.saving.modules ? store.L.common.saving : store.L.modules.save}
  </button>
</div>