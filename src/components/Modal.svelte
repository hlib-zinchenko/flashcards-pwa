<script lang="ts">
  import type { Snippet } from 'svelte';
  import { t } from '../lib/i18n/index.svelte';
  import Icon from './Icon.svelte';

  let {
    open = $bindable(false),
    title,
    children,
    footer,
    onclose,
  }: { open?: boolean; title: string; children: Snippet; footer?: Snippet; onclose?: () => void } = $props();

  let dialog: HTMLDialogElement;

  $effect(() => {
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  });

  function handleClose() {
    open = false;
    onclose?.();
  }
</script>

<dialog
  bind:this={dialog}
  onclose={handleClose}
  onclick={(e) => {
    if (e.target === dialog) open = false;
  }}
>
  {#if open}
    <div class="sheet">
      <header>
        <h2>{title}</h2>
        <button class="icon-btn" type="button" onclick={() => (open = false)} aria-label={t('common.close')}>
          <Icon name="close" />
        </button>
      </header>
      <div class="body">{@render children()}</div>
      {#if footer}<footer>{@render footer()}</footer>{/if}
    </div>
  {/if}
</dialog>

<style>
  dialog {
    width: calc(100% - 24px);
    max-width: 560px;
    max-height: calc(100dvh - var(--safe-top) - 24px);
    margin: calc(var(--safe-top) + 12px) auto auto;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 18px;
    background: var(--surface);
    color: var(--text);
    box-shadow: var(--shadow-lg);
  }
  @media (min-width: 720px) {
    dialog {
      margin-top: 10vh;
    }
  }
  dialog::backdrop {
    background: rgb(0 0 0 / 0.4);
  }
  .sheet {
    display: flex;
    max-height: inherit;
    flex-direction: column;
  }
  header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 8px 0 18px;
  }
  h2 {
    flex: 1;
    font-size: 1.1rem;
  }
  .body {
    overflow-y: auto;
    padding: 8px 18px 18px;
    overscroll-behavior: contain;
  }
  footer {
    display: flex;
    gap: 8px;
    padding: 12px 18px 18px;
    border-top: 1px solid var(--border);
  }
  footer :global(.btn) {
    flex: 1;
  }
  :global(html:has(dialog[open])) {
    overflow: hidden;
  }
</style>
