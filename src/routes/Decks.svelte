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
      <Icon name="upload" />
    </button>
    <button class="icon-btn accent" type="button" onclick={() => (creating = true)} aria-label={t('decks.new')} title={t('decks.new')}>
      <Icon name="plus" size={26} />
    </button>
  {/snippet}
</TopBar>

<div class="page">
  <InstallHint />

  {#if $allDecks && $allDecks.length === 0}
    <div class="empty">
      <div class="art" aria-hidden="true">あ</div>
      <h2>{t('decks.empty')}</h2>
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
      <div class="review">
        <button class="btn btn-primary btn-block" type="button" onclick={() => startQuick(allDeckIds, REVIEW_LEVELS)}>
          <Icon name="play" size={18} />{t('decks.review', { n: reviewCount })}
        </button>
        <p class="muted small">{t('decks.reviewHint')}</p>
      </div>
    {/if}

    <ul class="list">
      {#each $allDecks as deck (deck.id)}
        {@const cards = byDeck.get(deck.id) ?? []}
        <li class="deck panel">
          <a class="link" href={href(`/deck/${deck.id}`)}>
            <div class="row">
              <span class="name">{deck.name}</span>
              <span class="muted small">{t('decks.cards', { n: cards.length })}</span>
            </div>
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
              <Icon name="play" size={18} />
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
  .accent {
    color: var(--accent);
  }
  .review {
    margin-top: 12px;
  }
  .review .btn {
    min-height: 52px;
    font-size: 1.05rem;
  }
  .review p {
    margin: 6px 4px 0;
    text-align: center;
  }
  .list {
    display: grid;
    gap: 10px;
    margin: 16px 0 0;
    padding: 0;
    list-style: none;
  }
  .deck {
    display: flex;
    align-items: center;
    overflow: hidden;
  }
  .link {
    display: grid;
    flex: 1;
    min-width: 0;
    gap: 12px;
    padding: 16px;
    color: inherit;
    text-decoration: none;
  }
  .link:active {
    background: var(--surface-2);
  }
  .play {
    display: grid;
    flex: none;
    place-items: center;
    width: 44px;
    height: 44px;
    margin: 0 12px 0 0;
    padding: 0 0 0 2px;
    border: 0;
    border-radius: 50%;
    background: var(--accent-soft);
    color: var(--accent);
    cursor: pointer;
  }
  .play:active {
    background: var(--accent);
    color: var(--on-accent);
  }
  .legend {
    margin-top: 24px;
  }
  .legend ul {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
    margin: 0 4px;
    padding: 0;
    list-style: none;
    font-size: 0.85rem;
  }
  .legend li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .legend .count {
    color: var(--muted);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--muted);
  }
  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    color: var(--text);
    font-size: 1.1rem;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 48px 16px;
    text-align: center;
  }
  .empty p {
    max-width: 320px;
    margin: 0 0 8px;
  }
  .art {
    display: grid;
    place-items: center;
    width: 88px;
    height: 88px;
    margin-bottom: 8px;
    border-radius: 22px;
    background: var(--accent-soft);
    color: var(--accent);
    font-size: 3rem;
    font-weight: 700;
    transform: rotate(-6deg);
  }
</style>
