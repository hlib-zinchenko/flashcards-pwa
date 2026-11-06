<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import TopBar from '../components/TopBar.svelte';
  import { levelLabel, sortTags, t, tagLabel } from '../lib/i18n/index.svelte';
  import { allCards, allCollections, allDecks, allTags } from '../lib/live';
  import { navigate } from '../lib/router.svelte';
  import { matchesTags, poolSize, type Direction, type Mode, type SortMode } from '../lib/session';
  import { saveTestConfig, startSession, testState } from '../lib/testState.svelte';
  import { LEVELS, type Level } from '../lib/types';

  const cfg = testState.config;
  const QUICK_LIMITS = [10, 20, 50];

  const decks = $derived($allDecks ?? []);
  /** Decks under their collection, in collection order; empty collections are left out. */
  const groups = $derived(
    ($allCollections ?? [])
      .map((collection) => ({ collection, decks: decks.filter((d) => d.collectionId === collection.id) }))
      .filter((g) => g.decks.length > 0),
  );
  const cards = $derived($allCards ?? []);
  const tags = $derived(sortTags($allTags ?? []));

  // Persist the configuration whenever it changes.
  $effect(() => {
    $state.snapshot(cfg);
    saveTestConfig();
  });

  // Drop deleted decks/tags; on first use select every deck.
  let initialized = false;
  $effect(() => {
    if (!$allDecks || !$allTags) return;
    const deckIds = new Set($allDecks.map((d) => d.id));
    const tagIds = new Set($allTags.map((tag) => tag.id));
    const keptDecks = cfg.deckIds.filter((id) => deckIds.has(id));
    if (keptDecks.length !== cfg.deckIds.length) cfg.deckIds = keptDecks;
    const keptTags = cfg.tagIds.filter((id) => tagIds.has(id));
    if (keptTags.length !== cfg.tagIds.length) cfg.tagIds = keptTags;
    if (!initialized) {
      initialized = true;
      if (cfg.deckIds.length === 0) cfg.deckIds = $allDecks.map((d) => d.id);
    }
  });

  const deckCount = $derived.by(() => {
    const m = new Map<string, number>();
    for (const c of cards) m.set(c.deckId, (m.get(c.deckId) ?? 0) + 1);
    return m;
  });

  const inDecks = $derived(cards.filter((c) => cfg.deckIds.includes(c.deckId)));

  const levelCounts = $derived.by(() => {
    const counts = [0, 0, 0, 0, 0, 0];
    for (const c of inDecks) if (matchesTags(c, cfg)) counts[c.level]++;
    return counts;
  });

  const tagCounts = $derived.by(() => {
    const m = new Map<string, number>();
    let untagged = 0;
    for (const c of inDecks) {
      if (!cfg.levels.includes(c.level)) continue;
      if (c.tags.length === 0) untagged++;
      for (const id of c.tags) m.set(id, (m.get(id) ?? 0) + 1);
    }
    return { m, untagged };
  });
  const visibleTags = $derived(tags.filter((tag) => tagCounts.m.get(tag.id) || cfg.tagIds.includes(tag.id)));
  const showUntagged = $derived(tagCounts.untagged > 0 || cfg.includeUntagged);
  const anyTag = $derived(cfg.tagIds.length === 0 && !cfg.includeUntagged);

  const total = $derived(poolSize(cards, cfg));

  // "Other" is remembered as chosen rather than worked out from the number, so typing 10, 20 or 50
  // (or passing through them, as in 100) keeps the field open instead of jumping to that segment.
  const savedCustom = cfg.limit !== null && !QUICK_LIMITS.includes(cfg.limit);
  let customLimit = $state(savedCustom ? cfg.limit : 30);
  let customChosen = $state(savedCustom);
  const limitMode = $derived(customChosen ? 'custom' : cfg.limit === null ? 'all' : String(cfg.limit));

  function setLimit(limit: number | null) {
    customChosen = false;
    cfg.limit = limit;
  }

  function chooseCustom() {
    customChosen = true;
    cfg.limit = Math.max(1, Math.floor(customLimit || 1));
  }

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
  }

  const groupSelected = (ids: string[]) => ids.every((id) => cfg.deckIds.includes(id));
  function toggleGroup(ids: string[]) {
    cfg.deckIds = groupSelected(ids) ? cfg.deckIds.filter((id) => !ids.includes(id)) : [...new Set([...cfg.deckIds, ...ids])];
  }

  const allDecksSelected = $derived(decks.length > 0 && decks.every((d) => cfg.deckIds.includes(d.id)));

  function start() {
    startSession('/test');
  }

  const directions: [Direction, () => string][] = [
    ['front', () => t('test.front')],
    ['back', () => t('test.back')],
  ];
  const modes: [Mode, () => string][] = [
    ['cram', () => t('test.cram')],
    ['refresh', () => t('test.refresh')],
  ];
  const sorts: [SortMode, () => string][] = [
    ['deck', () => t('test.sortDeck')],
    ['random', () => t('test.sortRandom')],
    ['level', () => t('test.sortLevel')],
  ];
</script>

<TopBar title={t('test.title')} />

<div class="page">
  {#if $allDecks && cards.length === 0}
    <p class="muted empty">{t('test.noDecks')}</p>
  {:else if $allDecks}
    <section class="section">
      <h2 class="section-title">{t('test.decks')}</h2>
      {#snippet allChip()}
        <button
          type="button"
          class="chip"
          aria-pressed={allDecksSelected}
          onclick={() => (cfg.deckIds = allDecksSelected ? [] : decks.map((d) => d.id))}
        >
          {t('common.all')}
        </button>
      {/snippet}
      {#if groups.length > 1}
        <div class="chips">{@render allChip()}</div>
      {/if}
      {#each groups as group (group.collection.id)}
        {@const ids = group.decks.map((d) => d.id)}
        <div class="group">
          {#if groups.length > 1}
            <button type="button" class="group-title" aria-pressed={groupSelected(ids)} onclick={() => toggleGroup(ids)}>
              <span class="box" aria-hidden="true">{#if groupSelected(ids)}<Icon name="check" size={14} />{/if}</span>
              {group.collection.name}
            </button>
          {/if}
          <div class="chips">
            {#if groups.length === 1 && decks.length > 1}{@render allChip()}{/if}
            {#each group.decks as deck (deck.id)}
              <button
                type="button"
                class="chip"
                aria-pressed={cfg.deckIds.includes(deck.id)}
                onclick={() => (cfg.deckIds = toggle(cfg.deckIds, deck.id))}
              >
                {deck.name} <span class="count">{deckCount.get(deck.id) ?? 0}</span>
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </section>

    <section class="section">
      <h2 class="section-title">{t('test.count')}</h2>
      <div class="seg">
        <button type="button" aria-pressed={limitMode === 'all'} onclick={() => setLimit(null)}>{t('common.all')}</button>
        {#each QUICK_LIMITS as n (n)}
          <button type="button" aria-pressed={limitMode === String(n)} onclick={() => setLimit(n)}>{n}</button>
        {/each}
        <button type="button" aria-pressed={limitMode === 'custom'} onclick={chooseCustom}>{t('test.countCustom')}</button>
      </div>
      {#if limitMode === 'custom'}
        <input class="input custom" type="number" inputmode="numeric" min="1" bind:value={customLimit} oninput={chooseCustom} />
      {/if}
    </section>

    <section class="section">
      <h2 class="section-title">{t('test.showFirst')}</h2>
      <div class="seg">
        {#each directions as [value, label] (value)}
          <button type="button" aria-pressed={cfg.direction === value} onclick={() => (cfg.direction = value)}>{label()}</button>
        {/each}
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">{t('test.mode')}</h2>
      <div class="seg">
        {#each modes as [value, label] (value)}
          <button type="button" aria-pressed={cfg.mode === value} onclick={() => (cfg.mode = value)}>{label()}</button>
        {/each}
      </div>
      <p class="muted small mode-hint">{cfg.mode === 'cram' ? t('test.cramHint') : t('test.refreshHint')}</p>
    </section>

    <section class="section">
      <h2 class="section-title">{t('test.order')}</h2>
      <div class="seg">
        {#each sorts as [value, label] (value)}
          <button type="button" aria-pressed={cfg.sort === value} onclick={() => (cfg.sort = value)}>{label()}</button>
        {/each}
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">{t('test.levels')}</h2>
      <div class="chips">
        {#each LEVELS as level (level)}
          <button
            type="button"
            class="chip"
            aria-pressed={cfg.levels.includes(level)}
            onclick={() => (cfg.levels = toggle<Level>(cfg.levels, level).sort((a, b) => a - b))}
          >
            <span class="level-dot" style:background="var(--lv{level})"></span>
            {levelLabel(level)} <span class="count">{levelCounts[level]}</span>
          </button>
        {/each}
      </div>
    </section>

    {#if visibleTags.length > 0 || showUntagged}
      <section class="section">
        <h2 class="section-title">{t('test.tags')}</h2>
        <div class="chips">
          <button
            type="button"
            class="chip"
            aria-pressed={anyTag}
            onclick={() => {
              cfg.tagIds = [];
              cfg.includeUntagged = false;
            }}
          >
            {t('common.all')}
          </button>
          {#each visibleTags as tag (tag.id)}
            <button type="button" class="chip" aria-pressed={cfg.tagIds.includes(tag.id)} onclick={() => (cfg.tagIds = toggle(cfg.tagIds, tag.id))}>
              {tagLabel(tag)} <span class="count">{tagCounts.m.get(tag.id) ?? 0}</span>
            </button>
          {/each}
          {#if showUntagged}
            <button type="button" class="chip" aria-pressed={cfg.includeUntagged} onclick={() => (cfg.includeUntagged = !cfg.includeUntagged)}>
              {t('tags.untagged')} <span class="count">{tagCounts.untagged}</span>
            </button>
          {/if}
        </div>
      </section>
    {/if}
  {/if}
</div>

{#if $allDecks && cards.length > 0}
  <div class="start">
    <button class="btn btn-primary btn-block" type="button" disabled={total === 0} onclick={start}>
      <Icon name="play" size={18} />
      {total === 0 ? t('test.noCards') : t('test.start', { n: total })}
    </button>
  </div>
{/if}

<style>
  .group + .group,
  .chips + .group {
    margin-top: 12px;
  }
  .group-title {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 8px;
    padding: 4px 2px;
    border: 0;
    background: none;
    color: var(--text);
    font: inherit;
    font-weight: 700;
    font-size: 0.95rem;
    cursor: pointer;
  }
  .group-title .box {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border: 2px solid var(--text);
    border-radius: 6px;
  }
  .group-title[aria-pressed='true'] .box {
    border-color: var(--selected);
    background: var(--selected);
    color: var(--on-selected);
  }
  .page {
    padding-bottom: calc(var(--tabbar-h) + var(--safe-bottom) + 96px);
  }
  .empty {
    padding: 48px 0;
    text-align: center;
  }
  .mode-hint {
    margin: 8px 0 0;
  }
  .custom {
    width: 120px;
    margin-top: 8px;
  }
  .start {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 15;
    /* Reaches down behind the tab bar, so no chip shows between the button and the bar. */
    padding: 20px 16px calc(var(--tabbar-h) + var(--safe-bottom) + 4px);
    background: linear-gradient(transparent, var(--bg) 20px);
  }
  .start .btn {
    display: flex;
    max-width: 688px;
    min-height: 52px;
    margin: 0 auto;
    font-size: 1.05rem;
  }
</style>
