<script lang="ts">
  import type { Snippet } from 'svelte';
  import { t } from '../lib/i18n/index.svelte';
  import Icon from './Icon.svelte';

  let { title, back, actions }: { title: string; back?: string; actions?: Snippet } = $props();
</script>

<header class="topbar">
  <div class="inner">
    {#if back}
      <a class="icon-tile" href={back} aria-label={t('common.back')}><Icon name="back" size={20} /></a>
    {/if}
    <h1 class:with-back={!!back}>{title}</h1>
    <div class="actions">{@render actions?.()}</div>
  </div>
</header>

<style>
  .topbar {
    position: sticky;
    top: 0;
    z-index: 10;
    padding-top: var(--safe-top);
    background: var(--bg);
  }
  .inner {
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: 720px;
    min-height: 64px;
    margin: 0 auto;
    padding: 4px 16px 0;
  }
  h1 {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    font-family: var(--font-head);
    font-size: 1.9rem;
    font-weight: 900;
    letter-spacing: -0.02em;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  h1.with-back {
    font-size: 1.35rem;
  }
  .actions {
    display: flex;
    gap: 8px;
  }
  .actions :global(.icon-btn) {
    width: 40px;
    height: 40px;
    margin-bottom: 3px;
    border-radius: 13px;
    background: var(--surface);
    box-shadow: 0 3px 0 var(--surface-edge);
  }
  .actions :global(.icon-btn:active) {
    transform: translateY(2px);
    box-shadow: 0 1px 0 var(--surface-edge);
  }
</style>
