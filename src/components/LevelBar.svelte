<script lang="ts">
  import { levelLabel } from '../lib/i18n/index.svelte';
  import { LEVELS } from '../lib/types';

  let { counts }: { counts: number[] } = $props();
  const total = $derived(counts.reduce((a, b) => a + b, 0));
  const title = $derived(LEVELS.filter((l) => counts[l]).map((l) => `${levelLabel(l)}: ${counts[l]}`).join(' · '));
</script>

<div class="bar" {title} role="img" aria-label={title}>
  {#if total > 0}
    {#each LEVELS as level (level)}
      {#if counts[level]}
        <span style:flex-grow={counts[level]} style:background="var(--lv{level})"></span>
      {/if}
    {/each}
  {/if}
</div>

<style>
  .bar {
    display: flex;
    gap: 2px;
    height: 6px;
    overflow: hidden;
    border-radius: 999px;
    background: var(--surface-2);
  }
  span {
    flex-basis: 0;
    min-width: 3px;
  }
</style>
