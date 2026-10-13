<script lang="ts">
  import { toast } from '../lib/toast.svelte';
</script>

{#if toast.message}
  {#key toast.id}
    <div class="toast" role="status">{toast.message}</div>
  {/key}
{/if}

<style>
  .toast {
    position: fixed;
    left: 50%;
    bottom: calc(var(--tabbar-h) + var(--safe-bottom) + 16px);
    z-index: 100;
    max-width: calc(100% - 32px);
    padding: 10px 16px;
    border-radius: 999px;
    background: var(--text);
    color: var(--bg);
    font-size: 0.9rem;
    font-weight: 600;
    box-shadow: var(--shadow-lg);
    transform: translateX(-50%);
    animation: pop 0.2s ease-out;
    pointer-events: none;
  }
  @keyframes pop {
    from {
      opacity: 0;
      transform: translate(-50%, 8px);
    }
  }
</style>
