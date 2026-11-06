<script lang="ts">
  import { levelLabel } from '../lib/i18n/index.svelte';
  import { LEVELS } from '../lib/types';

  let { counts }: { counts: number[] } = $props();
  const total = $derived(counts.reduce((a, b) => a + b, 0));
  const title = $derived(LEVELS.filter((l) => counts[l]).map((l) => `${levelLabel(l)}: ${counts[l]}`).join(' · '));
</script>

<!-- The segments sit in a paper track, so on the lavender ground they never touch a colour like their own. -->
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
    height: 10px;
    padding: 2px;
    overflow: hidden;
    border-radius: 999px;
    background: var(--surface);
    box-shadow: inset 0 0 0 1px var(--border);
  }
  span {
    flex-basis: 0;
    min-width: 3px;
    border-radius: 999px;
  }
</style>
