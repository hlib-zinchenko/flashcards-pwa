<script lang="ts">
  import { sortTags, t, tagLabel } from '../lib/i18n/index.svelte';
  import { createTag } from '../lib/repo/tags';
  import type { Tag } from '../lib/types';
  import Icon from './Icon.svelte';

  let { selected = $bindable([]), tags }: { selected: string[]; tags: Tag[] } = $props();

  const sorted = $derived(sortTags(tags));
  let adding = $state(false);
  let name = $state('');
  let input: HTMLInputElement | undefined = $state();

  function toggle(id: string) {
    selected = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
  }

  async function add() {
    const value = name.trim();
    if (value) {
      const tag = await createTag(value);
      if (!selected.includes(tag.id)) selected = [...selected, tag.id];
    }
    name = '';
    adding = false;
  }

  function startAdding() {
    adding = true;
    queueMicrotask(() => input?.focus());
  }
</script>

<div class="chips">
  {#each sorted as tag (tag.id)}
    <button type="button" class="chip" aria-pressed={selected.includes(tag.id)} onclick={() => toggle(tag.id)}>
      {tagLabel(tag)}
    </button>
  {/each}
  {#if adding}
    <input
      class="input new-tag"
      bind:this={input}
      bind:value={name}
      placeholder={t('tags.newPlaceholder')}
      maxlength="40"
      enterkeyhint="done"
      onkeydown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          add();
        } else if (e.key === 'Escape') {
          e.stopPropagation();
          adding = false;
        }
      }}
      onblur={add}
    />
  {:else}
    <button type="button" class="chip add" onclick={startAdding}>
      <Icon name="plus" size={16} />
      {t('tags.new')}
    </button>
  {/if}
</div>

<style>
  .add {
    border-style: dashed;
    color: var(--muted);
  }
  .new-tag {
    width: 150px;
    min-height: 36px;
    padding: 4px 12px;
    border-radius: 999px;
  }
</style>
