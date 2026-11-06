<script lang="ts">
  import { hideToast, toast } from '../lib/toast.svelte';

  function runAction() {
    const action = toast.action;
    hideToast();
    action?.run();
  }
</script>

{#if toast.message}
  {#key toast.id}
    <div class="toast" class:with-action={!!toast.action} role="status">
      <span>{toast.message}</span>
      {#if toast.action}
        <button type="button" onclick={runAction}>{toast.action.label}</button>
      {/if}
    </div>
  {/key}
{/if}

<style>
  .toast {
    position: fixed;
    left: 50%;
    bottom: calc(var(--tabbar-h) + var(--safe-bottom) + 16px);
    z-index: 100;
    display: flex;
    align-items: center;
    gap: 12px;
    /* Centred with left: 50%, so without this it shrinks to half the screen and wraps short messages. */
    width: max-content;
    max-width: calc(100% - 32px);
    padding: 10px 16px;
    border-radius: 999px;
    background: var(--primary);
    color: var(--on-primary);
    font-size: 0.9rem;
    font-weight: 600;
    box-shadow: var(--shadow-lg);
    transform: translateX(-50%);
    animation: pop 0.2s ease-out;
    pointer-events: none;
  }
  .toast.with-action {
    padding: 4px 4px 4px 16px;
    pointer-events: auto;
  }
  button {
    min-height: 40px;
    padding: 0 14px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: inherit;
    font-weight: 800;
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
  }
  button:active {
    background: color-mix(in srgb, var(--on-primary) 18%, transparent);
  }
  @keyframes pop {
    from {
      opacity: 0;
      transform: translate(-50%, 8px);
    }
  }
</style>
