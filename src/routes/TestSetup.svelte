<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import TopBar from '../components/TopBar.svelte';
  import { levelLabel, sortTags, t, tagLabel } from '../lib/i18n/index.svelte';
  import { allCards, allDecks, allTags } from '../lib/live';
  import { navigate } from '../lib/router.svelte';
  import { filterCards, matchesTags, type Direction, type Mode, type SortMode } from '../lib/session';
  import { saveTestConfig, testState } from '../lib/testState.svelte';
  import { LEVELS, type Level } from '../lib/types';

  const cfg = testState.config;
  const QUICK_LIMITS = [10, 20, 50];

  const decks = $derived($allDecks ?? []);
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

  const matching = $derived(filterCards(cards, cfg).length);
  const total = $derived(cfg.limit ? Math.min(cfg.limit, matching) : matching);

  let customLimit = $state(cfg.limit && !QUICK_LIMITS.includes(cfg.limit) ? cfg.limit : 30);
  const limitMode = $derived(cfg.limit === null ? 'all' : QUICK_LIMITS.includes(cfg.limit) ? String(cfg.limit) : 'custom');

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
  }

  const allDecksSelected = $derived(decks.length > 0 && decks.every((d) => cfg.deckIds.includes(d.id)));

  function start() {
    testState.onlyCardIds = null;
    navigate('/test/run');
  }

  const directions: [Direction, () => string][] = [
    ['front', () => t('test.front')],
    ['back', () => t('test.back')],
  ];
  const modes: [Mode, () => string][] = [
    ['finite', () => t('test.finite')],
    ['infinite', () => t('test.infinite')],
  ];
  const sorts: [SortMode, () => string][] = [
    ['deck', () => t('test.sortDeck')],
    ['random', () => t('test.sortRandom')],
    ['az', () => t('test.sortAz')],
    ['za', () => t('test.sortZa')],
  ];
</script>

<TopBar title={t('test.title')} />

<div class="page">
  {#if $allDecks && cards.length === 0}
    <p class="muted empty">{t('test.noDecks')}</p>
  {:else if $allDecks}
    <section class="section">
      <h2 class="section-title">{t('test.decks')}</h2>
      <div class="chips">
        {#if decks.length > 1}
          <button
            type="button"
            class="chip"
            aria-pressed={allDecksSelected}
            onclick={() => (cfg.deckIds = allDecksSelected ? [] : decks.map((d) => d.id))}
          >
            {t('common.all')}
          </button>
        {/if}
        {#each decks as deck (deck.id)}
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

    <section class="section">
      <h2 class="section-title">{t('test.tags')} <span class="hint">· {t('test.tagsHint')}</span></h2>
      <div class="chips">
        {#each visibleTags as tag (tag.id)}
          <button type="button" class="chip" aria-pressed={cfg.tagIds.includes(tag.id)} onclick={() => (cfg.tagIds = toggle(cfg.tagIds, tag.id))}>
            {tagLabel(tag)} <span class="count">{tagCounts.m.get(tag.id) ?? 0}</span>
          </button>
        {/each}
        <button type="button" class="chip" aria-pressed={cfg.includeUntagged} onclick={() => (cfg.includeUntagged = !cfg.includeUntagged)}>
          {t('tags.untagged')} <span class="count">{tagCounts.untagged}</span>
        </button>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">{t('test.count')}</h2>
      <div class="seg">
        <button type="button" aria-pressed={limitMode === 'all'} onclick={() => (cfg.limit = null)}>{t('common.all')}</button>
        {#each QUICK_LIMITS as n (n)}
          <button type="button" aria-pressed={limitMode === String(n)} onclick={() => (cfg.limit = n)}>{n}</button>
        {/each}
        <button type="button" aria-pressed={limitMode === 'custom'} onclick={() => (cfg.limit = customLimit)}>{t('test.countCustom')}</button>
      </div>
      {#if limitMode === 'custom'}
        <input
          class="input custom"
          type="number"
          inputmode="numeric"
          min="1"
          bind:value={customLimit}
          oninput={() => (cfg.limit = Math.max(1, Math.floor(customLimit || 1)))}
        />
      {/if}
    </section>
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
  .page {
    padding-bottom: calc(var(--tabbar-h) + var(--safe-bottom) + 96px);
  }
  .empty {
    padding: 48px 0;
    text-align: center;
  }
  .hint {
    font-weight: 500;
    letter-spacing: 0;
    text-transform: none;
  }
  .custom {
    width: 120px;
    margin-top: 8px;
  }
  .start {
    position: fixed;
    left: 0;
    right: 0;
    bottom: calc(var(--tabbar-h) + var(--safe-bottom));
    z-index: 15;
    padding: 12px 16px;
    background: linear-gradient(transparent, var(--bg) 35%);
  }
  .start .btn {
    display: flex;
    max-width: 688px;
    min-height: 52px;
    margin: 0 auto;
    font-size: 1.05rem;
    box-shadow: var(--shadow-lg);
  }
</style>
