<script lang="ts">
  import type { Snippet } from 'svelte';
  import { t } from '../lib/i18n/index.svelte';
  import Icon from './Icon.svelte';

  let { title, back, actions }: { title: string; back?: string; actions?: Snippet } = $props();
</script>

<header class="topbar">
  <div class="inner">
    {#if back}
      <a class="icon-btn" href={back} aria-label={t('common.back')}><Icon name="back" /></a>
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
    background: color-mix(in srgb, var(--bg) 88%, transparent);
    backdrop-filter: saturate(1.6) blur(14px);
    -webkit-backdrop-filter: saturate(1.6) blur(14px);
  }
  .inner {
    display: flex;
    align-items: center;
    gap: 4px;
    max-width: 720px;
    min-height: 56px;
    margin: 0 auto;
    padding: 0 8px 0 16px;
  }
  .inner:has(> a) {
    padding-left: 4px;
  }
  h1 {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    font-size: 1.6rem;
    font-weight: 800;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  h1.with-back {
    font-size: 1.2rem;
    font-weight: 700;
  }
  .actions {
    display: flex;
    gap: 2px;
  }
  .icon-btn {
    color: var(--accent);
  }
</style>
