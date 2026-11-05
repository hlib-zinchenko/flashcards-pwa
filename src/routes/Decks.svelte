<script lang="ts">
  import CsvImportModal from '../components/CsvImportModal.svelte';
  import Icon from '../components/Icon.svelte';
  import InstallHint from '../components/InstallHint.svelte';
  import LevelBar from '../components/LevelBar.svelte';
  import NameModal from '../components/NameModal.svelte';
  import TopBar from '../components/TopBar.svelte';
  import { levelLabel, t } from '../lib/i18n/index.svelte';
  import { pickFile } from '../lib/io/file';
  import { levelCounts } from '../lib/learning';
  import { allCards, allDecks } from '../lib/live';
  import { createDeck } from '../lib/repo/decks';
  import { href, navigate } from '../lib/router.svelte';
  import { poolSize, quickConfig, REVIEW_LEVELS } from '../lib/session';
  import { startQuick, testState } from '../lib/testState.svelte';
  import { LEVELS, type Card } from '../lib/types';

  const byDeck = $derived.by(() => {
    const map = new Map<string, Card[]>();
    for (const c of $allCards ?? []) {
      const list = map.get(c.deckId);
      if (list) list.push(c);
      else map.set(c.deckId, [c]);
    }
    return map;
  });

  const allDeckIds = $derived(($allDecks ?? []).map((d) => d.id));
  const totals = $derived(levelCounts($allCards ?? []));
  /** Size of the "Review weak cards" session, using the saved card limit. */
  const reviewCount = $derived(poolSize($allCards ?? [], quickConfig(testState.config, allDeckIds, REVIEW_LEVELS)));

  let creating = $state(false);
  let csvOpen = $state(false);
  let csvText = $state('');
  let csvName = $state('');

  async function create(name: string) {
    const id = await createDeck(name);
    creating = false;
    navigate(`/deck/${id}`);
  }

  async function importCsv() {
    const file = await pickFile('.csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain');
    if (!file) return;
    csvText = await file.text();
    csvName = file.name;
    csvOpen = true;
  }
</script>

<TopBar title={t('decks.title')}>
  {#snippet actions()}
    <button class="icon-btn" type="button" onclick={importCsv} aria-label={t('decks.importCsv')} title={t('decks.importCsv')}>
      <Icon name="upload" size={19} />
    </button>
    <button class="icon-btn" type="button" onclick={() => (creating = true)} aria-label={t('decks.new')} title={t('decks.new')}>
      <Icon name="plus" size={21} />
    </button>
  {/snippet}
</TopBar>

<div class="page">
  <InstallHint />

  {#if $allDecks && $allDecks.length === 0}
    <div class="empty">
      <div class="art display" aria-hidden="true">あ</div>
      <h2 class="display">{t('decks.empty')}</h2>
      <p class="muted">{t('decks.emptyHint')}</p>
      <button class="btn btn-primary" type="button" onclick={() => (creating = true)}>
        <Icon name="plus" size={18} />{t('decks.new')}
      </button>
      <button class="btn btn-ghost" type="button" onclick={importCsv}>
        <Icon name="upload" size={18} />{t('decks.importCsv')}
      </button>
    </div>
  {:else if $allDecks}
    {#if reviewCount > 0}
      <button class="review tile" type="button" onclick={() => startQuick(allDeckIds, REVIEW_LEVELS)}>
        <span class="review-n display">{reviewCount}</span>
        <span class="review-text">
          <b>{t('decks.reviewTitle')}</b>
          <small>{t('decks.reviewHint')}</small>
        </span>
        <span class="go"><Icon name="play" size={16} /></span>
      </button>
    {/if}

    <ul class="grid">
      {#each $allDecks as deck, i (deck.id)}
        {@const cards = byDeck.get(deck.id) ?? []}
        <li class="deck tile tone-{i % 3}">
          <a class="link" href={href(`/deck/${deck.id}`)}>
            <span class="name">{deck.name}</span>
            <span class="tally"><span class="display">{cards.length}</span><small>{t('decks.cardsWord', { n: cards.length })}</small></span>
            <LevelBar counts={levelCounts(cards)} />
          </a>
          {#if cards.length > 0}
            <button
              class="play"
              type="button"
              onclick={() => startQuick([deck.id])}
              aria-label={t('decks.study', { name: deck.name })}
              title={t('decks.study', { name: deck.name })}
            >
              <Icon name="play" size={14} />
            </button>
          {/if}
        </li>
      {/each}
    </ul>

    {#if ($allCards ?? []).length > 0}
      <section class="legend" aria-labelledby="legend-title">
        <h2 id="legend-title" class="section-title">{t('decks.legend')}</h2>
        <ul>
          {#each LEVELS as level (level)}
            <li>
              <span class="level-dot" style:background="var(--lv{level})"></span>
              {levelLabel(level)} <span class="count">{totals[level]}</span>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  {/if}
</div>

<NameModal
  bind:open={creating}
  title={t('decks.new')}
  label={t('deck.name')}
  placeholder={t('deck.namePlaceholder')}
  submitLabel={t('common.create')}
  onsubmit={create}
/>

<CsvImportModal bind:open={csvOpen} text={csvText} fileName={csvName} onimported={(id) => navigate(`/deck/${id}`)} />

<style>
  .tile {
    --tile: var(--surface);
    --tile-edge: var(--surface-edge);
    border: 0;
    border-radius: var(--radius);
    background: var(--tile);
    box-shadow: 0 var(--edge) 0 var(--tile-edge);
    color: var(--text);
    transition: transform 0.08s ease-out, box-shadow 0.08s ease-out;
  }
  .tile:active {
    transform: translateY(4px);
    box-shadow: 0 1px 0 var(--tile-edge);
  }
  .review {
    --tile: var(--mint);
    --tile-edge: var(--mint-edge);
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    margin-top: 8px;
    padding: 16px;
    color: var(--on-mint);
    text-align: left;
    cursor: pointer;
  }
  .review-n {
    font-size: 2.9rem;
    line-height: 0.9;
    font-variant-numeric: tabular-nums;
  }
  .review-text {
    display: grid;
    flex: 1;
    gap: 2px;
    min-width: 0;
  }
  .review-text b {
    font-size: 1.05rem;
    line-height: 1.2;
  }
  .review-text small {
    font-size: 0.85rem;
    opacity: 0.85;
  }
  .go {
    display: grid;
    flex: none;
    place-items: center;
    width: 42px;
    height: 42px;
    padding-left: 2px;
    border-radius: 50%;
    background: var(--on-mint);
    color: var(--mint);
  }
  .go :global(path),
  .play :global(path) {
    fill: currentColor;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 16px 12px;
    margin: 20px 0 0;
    padding: 0;
    list-style: none;
  }
  .deck {
    position: relative;
    display: flex;
  }
  .deck.tone-1 {
    --tile: var(--accent-soft);
    --tile-edge: var(--accent-edge);
  }
  .deck.tone-2 {
    --tile: var(--butter);
    --tile-edge: var(--butter-edge);
  }
  .link {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    min-height: 136px;
    padding: 14px;
    color: inherit;
    text-decoration: none;
    border-radius: inherit;
  }
  .name {
    padding-right: 40px;
    font-weight: 700;
    font-size: 0.98rem;
    line-height: 1.22;
    overflow-wrap: anywhere;
  }
  .tally {
    display: flex;
    align-items: baseline;
    gap: 5px;
    margin-top: auto;
    padding: 10px 0;
  }
  .tally .display {
    font-size: 2.1rem;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .tally small {
    font-size: 0.8rem;
    opacity: 0.75;
  }
  .play {
    position: absolute;
    top: 10px;
    right: 10px;
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    padding: 0 0 0 2px;
    border: 0;
    border-radius: 50%;
    background: color-mix(in srgb, var(--text) 10%, transparent);
    color: var(--text);
    cursor: pointer;
  }
  .play:active {
    transform: scale(0.94);
  }
  .legend {
    margin-top: 28px;
  }
  .legend ul {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
    margin: 0 4px;
    padding: 0;
    list-style: none;
    font-size: 0.875rem;
  }
  .legend li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  /* A ring keeps the lavender "Learning" dot visible on the lavender ground. */
  .legend .level-dot {
    box-shadow: 0 0 0 1.5px color-mix(in srgb, var(--text) 25%, transparent);
  }
  .legend .count {
    color: var(--muted);
  }
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 48px 16px;
    text-align: center;
  }
  .empty h2 {
    font-size: 1.6rem;
  }
  .empty p {
    max-width: 320px;
    margin: 0 0 8px;
  }
  .art {
    display: grid;
    place-items: center;
    width: 96px;
    height: 120px;
    margin-bottom: 14px;
    border-radius: 18px;
    background: var(--surface);
    box-shadow: 0 var(--edge) 0 var(--surface-edge);
    color: var(--text);
    font-size: 3rem;
    transform: rotate(-6deg);
  }
  @media (prefers-reduced-motion: reduce) {
    .tile {
      transition: none;
    }
  }
</style>
