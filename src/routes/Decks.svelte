<script lang="ts">
  import ResumeSession from '../components/ResumeSession.svelte';
  import Icon from '../components/Icon.svelte';
  import InstallHint from '../components/InstallHint.svelte';
  import LevelBar from '../components/LevelBar.svelte';
  import NameModal from '../components/NameModal.svelte';
  import TopBar from '../components/TopBar.svelte';
  import { levelLabel, t } from '../lib/i18n/index.svelte';
  import { levelCounts } from '../lib/learning';
  import { allCards, allCollections, allDecks } from '../lib/live';
  import { createCollection } from '../lib/repo/collections';
  import { href, navigate } from '../lib/router.svelte';
  import { startQuick } from '../lib/testState.svelte';
  import { LEVELS, type Card } from '../lib/types';

  /** Decks and cards of each collection. */
  const byCollection = $derived.by(() => {
    const deckCollection = new Map(($allDecks ?? []).map((d) => [d.id, d.collectionId]));
    const map = new Map<string, { decks: string[]; cards: Card[] }>();
    const entry = (id: string) => {
      let e = map.get(id);
      if (!e) map.set(id, (e = { decks: [], cards: [] }));
      return e;
    };
    for (const d of $allDecks ?? []) entry(d.collectionId).decks.push(d.id);
    for (const c of $allCards ?? []) {
      const collectionId = deckCollection.get(c.deckId);
      if (collectionId) entry(collectionId).cards.push(c);
    }
    return map;
  });

  const totals = $derived(levelCounts($allCards ?? []));

  let creating = $state(false);

  async function create(name: string) {
    const id = await createCollection(name);
    creating = false;
    navigate(`/collection/${id}`);
  }
</script>

<TopBar title={t('collections.title')}>
  {#snippet actions()}
    <button class="icon-btn" type="button" onclick={() => (creating = true)} aria-label={t('collections.new')} title={t('collections.new')}>
      <Icon name="plus" size={21} />
    </button>
  {/snippet}
</TopBar>

<div class="page">
  <InstallHint />
  <ResumeSession />

  {#if $allCollections && $allCollections.length === 0}
    <div class="empty">
      <div class="art display" aria-hidden="true">あ</div>
      <h2 class="display">{t('collections.empty')}</h2>
      <p class="muted">{t('collections.emptyHint')}</p>
      <button class="btn btn-primary" type="button" onclick={() => (creating = true)}>
        <Icon name="plus" size={18} />{t('collections.new')}
      </button>
    </div>
  {:else if $allCollections && $allDecks}
    <ul class="grid">
      {#each $allCollections as collection, i (collection.id)}
        {@const group = byCollection.get(collection.id) ?? { decks: [], cards: [] }}
        <li class="deck tile tone-{i % 3}">
          <a class="link" href={href(`/collection/${collection.id}`)}>
            <span class="name">{collection.name}</span>
            <small class="decks-n">{t('collection.decks', { n: group.decks.length })}</small>
            <span class="tally"><span class="display">{group.cards.length}</span><small>{t('decks.cardsWord', { n: group.cards.length })}</small></span>
            <LevelBar counts={levelCounts(group.cards)} />
          </a>
          {#if group.cards.length > 0}
            <button
              class="play"
              type="button"
              onclick={() => startQuick(group.decks)}
              aria-label={t('decks.study', { name: collection.name })}
              title={t('decks.study', { name: collection.name })}
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
  title={t('collections.new')}
  label={t('collection.name')}
  placeholder={t('collection.namePlaceholder')}
  submitLabel={t('common.create')}
  onsubmit={create}
/>

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
  .decks-n {
    margin-top: 4px;
    font-size: 0.8rem;
    opacity: 0.75;
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
  /* A ring keeps the level dots crisp on the lavender ground. */
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
