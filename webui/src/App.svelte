<script>
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { cubicOut, cubicIn } from 'svelte/easing';
  import { store } from './lib/store.svelte';
  import NavBar from './components/NavBar.svelte';
  import Toast from './components/Toast.svelte';
  import StatusTab from './routes/StatusTab.svelte';
  import ConfigTab from './routes/ConfigTab.svelte';
  import ModulesTab from './routes/ModulesTab.svelte';
  import LogsTab from './routes/LogsTab.svelte';
  import InfoTab from './routes/InfoTab.svelte';
  import './app.css';
  import './layout.css';
  
  // Default tab is 'status'
  let activeTab = $state('status');
  let transitionDirection = $state(1);
  let touchStartX = 0;
  let touchStartY = 0;
  let touchEndX = 0;
  let touchEndY = 0;

  const TABS = ['status', 'config', 'modules', 'logs', 'info'];
  function switchTab(id) {
    const currentIndex = TABS.indexOf(activeTab);
    const newIndex = TABS.indexOf(id);
    if (currentIndex === newIndex) return;
    transitionDirection = newIndex > currentIndex ? 1 : -1;
    activeTab = id;
  }

  function handleTouchStart(e) {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  }

  function handleTouchEnd(e) {
    touchEndX = e.changedTouches[0].screenX;
    touchEndY = e.changedTouches[0].screenY;
    
    const threshold = 50;
    const diffX = touchStartX - touchEndX;
    const diffY = touchStartY - touchEndY;
    
    // 如果垂直滑动距离大于水平滑动距离,则不翻页(用户是在滚动内容)
    if (Math.abs(diffY) > Math.abs(diffX)) return;
    
    // 水平滑动距离太小也不翻页
    if (Math.abs(diffX) < threshold) return;
    
    const currentIndex = TABS.indexOf(activeTab);
    
    if (diffX > 0 && currentIndex < TABS.length - 1) {
      switchTab(TABS[currentIndex + 1]);
    } else if (diffX < 0 && currentIndex > 0) {
      switchTab(TABS[currentIndex - 1]);
    }
  }

  onMount(() => {
    store.init();
  });
</script>

<div class="app-root" 
     style:background-image={store.backgroundImage ? `url('${store.backgroundImage}')` : 'none'} 
     style:background-size="cover" 
     style:background-position="center"
     style:background-attachment="fixed">
  <NavBar {activeTab} onTabChange={switchTab} />

  <main class="main-content" ontouchstart={handleTouchStart} ontouchend={handleTouchEnd}>
    {#key activeTab}
      <div class="tab-pane" 
           in:fly={{ x: 30 * transitionDirection, duration: 250, delay: 90, easing: cubicOut }} 
           out:fly={{ x: -30 * transitionDirection, duration: 150, easing: cubicIn }}>
        
        {#if activeTab === 'status'}
          <StatusTab />
        {:else if activeTab === 'config'}
          <ConfigTab />
        {:else if activeTab === 'modules'}
          <ModulesTab />
        {:else if activeTab === 'logs'}
          <LogsTab />
        {:else if activeTab === 'info'}
          <InfoTab />
        {/if}
      </div>
    {/key}
  </main>

  <Toast />
</div>