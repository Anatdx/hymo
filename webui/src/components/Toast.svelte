<script>
  import { store } from '../lib/store.svelte';
  import { fade, fly } from 'svelte/transition';
  
  // Icon logic or simply text for now
</script>

{#if store.toast.visible}
  <div 
    class="toast toast-{store.toast.type}" 
    in:fly={{ y: 20, duration: 300 }} 
    out:fade={{ duration: 200 }}
  >
    <span>{store.toast.text}</span>
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 24px;
    border-radius: 28px;
    font-size: 14px;
    font-weight: 500;
    z-index: 200;
    box-shadow: var(--md-sys-elevation-2);
    display: flex;
    align-items: center;
    gap: 8px;
    text-align: center;
    white-space: nowrap;
  }
  
  /* Info (Default) */
  .toast-info {
    background: #ffffff;
    color: #1c1b1f;
  }
  
  /* Error */
  .toast-error {
    background: #ffffff;
    color: #ba1a1a;
  }
  
  /* Success */
  .toast-success {
    background: #ffffff;
    color: #006c4c;
  }
</style>