<script lang="ts">
  import ResumeSession from '../components/ResumeSession.svelte';
  import Icon from '../components/Icon.svelte';
  import TopBar from '../components/TopBar.svelte';
  import { levelLabel, sortTags, t, tagLabel } from '../lib/i18n/index.svelte';
  import { allCards, allCollections, allDecks, allTags } from '../lib/live';
  import { href, lastCollection } from '../lib/router.svelte';
  import { isAll, matchesTags, pickFromAll, poolSize, scopeDeckIds, type Direction, type Mode, type SortMode } from '../lib/session';
  import { saveTestConfig, startSession, testState } from '../lib/testState.svelte';
  import { LEVELS, type Level } from '../lib/types';

  const cfg = testState.config;
  const QUICK_LIMITS = [10, 20, 50];

  // A test only ever uses the decks of one collection: the one opened last.
  // undefined = still loading, null = none opened yet, or it was deleted.
  const collection = $derived($allCollections && (($allCollections.find((c) => c.id === lastCollection.id)) ?? null));
  const decks = $derived(collection ? ($allDecks ?? []).filter((d) => d.collectionId === collection.id) : []);
  const cards = $derived.by(() => {
    const ids = new Set(decks.map((d) => d.id));
    return ($allCards ?? []).filter((c) => ids.has(c.deckId));
  });
  const tags = $derived(sortTags($allTags ?? []));

  // Persist the configuration whenever it changes.
  $effect(() => {
    $state.snapshot(cfg);
    saveTestConfig();
  });

  // Drop deleted tags. On opening, keep only this collection's decks (all of them if none were chosen),
  // once, so unticking every deck afterwards doesn't tick them all again.
  let initialized = false;
  $effect(() => {
    if (!$allDecks || !$allTags || !collection) return;
    const tagIds = new Set($allTags.map((tag) => tag.id));
    const keptTags = cfg.tagIds.filter((id) => tagIds.has(id));
    if (keptTags.length !== cfg.tagIds.length) cfg.tagIds = keptTags;
    if (!initialized) {
      initialized = true;
      const scoped = scopeDeckIds(cfg.deckIds, decks.map((d) => d.id));
      if (scoped.length !== cfg.deckIds.length || scoped.some((id, i) => id !== cfg.deckIds[i])) cfg.deckIds = scoped;
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

  // Decks and levels: with everything chosen only "All" looks pressed, as with tags (see pickFromAll).
  const deckIds = $derived(decks.map((d) => d.id));
  const allDecksSelected = $derived(isAll(cfg.deckIds, deckIds));
  const allLevelsSelected = $derived(isAll(cfg.levels, LEVELS));

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
  <ResumeSession />
  {#if collection === null}
    <div class="empty">
      <p class="muted">{t('test.noCollection')}</p>
      <a class="btn btn-primary" href={href('/')}><Icon name="decks" size={18} />{t('test.openCollection')}</a>
    </div>
  {:else if collection && $allDecks && cards.length === 0}
    <div class="empty">
      <p class="muted">{t('test.noDecks')}</p>
      <a class="btn btn-primary" href={href(`/collection/${collection.id}`)}><Icon name="decks" size={18} />{collection.name}</a>
    </div>
  {:else if collection && $allDecks}
    <section class="section">
      <h2 class="section-title">{collection.name}</h2>
      <div class="chips">
        {#if decks.length > 1}
          <button
            type="button"
            class="chip"
            aria-pressed={allDecksSelected}
            onclick={() => (cfg.deckIds = [...deckIds])}
          >
            {t('common.all')}
          </button>
        {/if}
        {#each decks as deck (deck.id)}
          <button
            type="button"
            class="chip"
            class:zero={!deckCount.get(deck.id)}
            aria-pressed={!allDecksSelected && cfg.deckIds.includes(deck.id)}
            onclick={() => (cfg.deckIds = pickFromAll(cfg.deckIds, deckIds, deck.id))}
          >
            {deck.name} <span class="count">{deckCount.get(deck.id) ?? 0}</span>
          </button>
        {/each}
      </div>
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
        <button type="button" class="chip" aria-pressed={allLevelsSelected} onclick={() => (cfg.levels = [...LEVELS])}>
          {t('common.all')}
        </button>
        {#each LEVELS as level (level)}
          <button
            type="button"
            class="chip"
            class:zero={levelCounts[level] === 0}
            aria-pressed={!allLevelsSelected && cfg.levels.includes(level)}
            onclick={() => (cfg.levels = pickFromAll<Level>(cfg.levels, LEVELS, level))}
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
  <div class="start start-bar">
    <button class="btn btn-mint btn-block" type="button" disabled={total === 0} onclick={start}>
      <Icon name="play" size={18} />
      {total === 0 ? t('test.noCards') : t('test.start', { n: total })}
    </button>
  </div>
{/if}

<style>
  .page {
    padding-bottom: calc(var(--tabbar-h) + var(--safe-bottom) + 96px);
  }
  .empty {
    display: grid;
    justify-items: center;
    gap: 16px;
    padding: 48px 0;
    text-align: center;
  }
  .empty p {
    max-width: 32ch;
    margin: 0;
  }
  /* Nothing to test in it: still tappable, but quieter. */
  .chip.zero:not([aria-pressed='true']) {
    opacity: 0.5;
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
  /* The bar above already fades the page out; the tab bar's own fade would fall on the button. */
  :global(body:has(.start-bar)) :global(.tabbar) {
    background: none;
  }
  .start .btn {
    display: flex;
    max-width: 688px;
    min-height: 52px;
    margin: 0 auto;
    font-size: 1.05rem;
  }
</style>
