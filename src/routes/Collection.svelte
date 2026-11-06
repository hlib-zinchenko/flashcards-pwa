<script lang="ts">
  import { liveQuery } from 'dexie';
  import CollectionLanguages from '../components/CollectionLanguages.svelte';
  import CsvImportModal from '../components/CsvImportModal.svelte';
  import Icon from '../components/Icon.svelte';
  import LevelBar from '../components/LevelBar.svelte';
  import Modal from '../components/Modal.svelte';
  import NameModal from '../components/NameModal.svelte';
  import TopBar from '../components/TopBar.svelte';
  import { askConfirm } from '../lib/confirm.svelte';
  import { db } from '../lib/db';
  import { languageName, t } from '../lib/i18n/index.svelte';
  import { pickFile } from '../lib/io/file';
  import { levelCounts } from '../lib/learning';
  import { allCards, allDecks } from '../lib/live';
  import { deleteCollection, renameCollection } from '../lib/repo/collections';
  import { createDeck } from '../lib/repo/decks';
  import { href, lastCollection, navigate, rememberCollection } from '../lib/router.svelte';
  import { openSetup, startQuick } from '../lib/testState.svelte';
  import { showToast } from '../lib/toast.svelte';
  import type { Card } from '../lib/types';

  let { id }: { id: string } = $props();

  // undefined = still loading, null = missing
  const collection = $derived(liveQuery(async () => (await db.collections.get(id)) ?? null));
  const decks = $derived(($allDecks ?? []).filter((d) => d.collectionId === id));
  const deckIds = $derived(decks.map((d) => d.id));
  const origin = $derived(`/collection/${id}`);

  // Opening a collection makes it the Decks tab's home. If it's gone (deleted, or replaced by an
  // import), forget it and fall back to the list, so the tab never leads to "not found".
  $effect(() => {
    if ($collection) rememberCollection(id);
    else if ($collection === null && lastCollection.id === id) {
      rememberCollection(null);
      navigate('/', { replace: true });
    }
  });

  const byDeck = $derived.by(() => {
    const ids = new Set(deckIds);
    const map = new Map<string, Card[]>();
    for (const c of $allCards ?? []) {
      if (!ids.has(c.deckId)) continue;
      const list = map.get(c.deckId);
      if (list) list.push(c);
      else map.set(c.deckId, [c]);
    }
    return map;
  });
  const cards = $derived([...byDeck.values()].flat());

  let creating = $state(false);
  let csvOpen = $state(false);
  let csvText = $state('');
  let csvName = $state('');
  let settingsOpen = $state(false);
  let renaming = $state(false);

  async function create(name: string) {
    const deckId = await createDeck(name, id);
    creating = false;
    navigate(`/deck/${deckId}`);
  }

  async function importCsv() {
    const file = await pickFile('.csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain');
    if (!file) return;
    csvText = await file.text();
    csvName = file.name;
    csvOpen = true;
  }

  async function rename(name: string) {
    await renameCollection(id, name);
    renaming = false;
  }

  async function remove() {
    if (!$collection) return;
    settingsOpen = false;
    const ok = await askConfirm({
      title: t('collection.delete'),
      message: t('collection.deleteConfirm', { name: $collection.name, decks: t('collection.decks', { n: decks.length }), cards: t('decks.cards', { n: cards.length }) }),
      confirmLabel: t('common.delete'),
    });
    if (!ok) return;
    await deleteCollection(id);
    rememberCollection(null);
    showToast(t('collection.deleted'));
    navigate('/', { replace: true });
  }
</script>

<TopBar title={$collection?.name ?? ''} back={href('/')}>
  {#snippet actions()}
    {#if $collection}
      <button class="icon-btn" type="button" onclick={importCsv} aria-label={t('decks.importCsv')} title={t('decks.importCsv')}>
        <Icon name="upload" size={19} />
      </button>
      <button class="icon-btn" type="button" onclick={() => (creating = true)} aria-label={t('decks.new')} title={t('decks.new')}>
        <Icon name="plus" size={21} />
      </button>
      <button class="icon-btn" type="button" onclick={() => (settingsOpen = true)} aria-label={t('collection.settings')} title={t('collection.settings')}>
        <Icon name="settings" size={19} />
      </button>
    {/if}
  {/snippet}
</TopBar>

<div class="page">
  {#if $collection === null}
    <p class="muted center">{t('collection.notFound')}</p>
  {:else if $collection && $allDecks}
    <div class="summary">
      <div class="stats">
        <LevelBar counts={levelCounts(cards)} />
        <span class="muted small">{t('collection.decks', { n: decks.length })} · {t('decks.cards', { n: cards.length })}</span>
      </div>
      <button class="btn btn-primary" type="button" onclick={() => openSetup(deckIds)} disabled={cards.length === 0}>
        <Icon name="play" size={18} />{t('deck.study')}
      </button>
    </div>
    <button class="speech-line" type="button" onclick={() => (settingsOpen = true)}>
      <Icon name="volume" size={16} />
      {#if $collection.languages.length}
        {$collection.languages.map((l) => languageName(l.lang)).join(' · ')}
      {:else}
        {t('collection.speechOff')}
      {/if}
    </button>

    {#if decks.length === 0}
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
    {:else}
      <ul class="grid">
        {#each decks as deck, i (deck.id)}
          {@const deckCards = byDeck.get(deck.id) ?? []}
          <li class="deck tile tone-{i % 3}">
            <a class="link" href={href(`/deck/${deck.id}`)}>
              <span class="name">{deck.name}</span>
              <span class="tally"><span class="display">{deckCards.length}</span><small>{t('decks.cardsWord', { n: deckCards.length })}</small></span>
              <LevelBar counts={levelCounts(deckCards)} />
            </a>
            {#if deckCards.length > 0}
              <button
                class="play"
                type="button"
                onclick={() => startQuick([deck.id], undefined, origin)}
                aria-label={t('decks.study', { name: deck.name })}
                title={t('decks.study', { name: deck.name })}
              >
                <Icon name="play" size={14} />
              </button>
            {/if}
          </li>
        {/each}
      </ul>
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

<NameModal
  bind:open={renaming}
  title={t('collection.rename')}
  label={t('collection.name')}
  value={$collection?.name ?? ''}
  submitLabel={t('common.save')}
  onsubmit={rename}
/>

<Modal bind:open={settingsOpen} title={$collection?.name ?? ''}>
  {#if $collection}
    <h3 class="sub-title">{t('collection.languages')}</h3>
    <p class="muted small lead">{t('collection.languagesHint')}</p>
    <CollectionLanguages collection={$collection} />
    <div class="menu">
      <button class="btn" type="button" onclick={() => { settingsOpen = false; renaming = true; }}>
        <Icon name="edit" size={18} />{t('collection.rename')}
      </button>
      <button class="btn btn-danger" type="button" onclick={remove}><Icon name="trash" size={18} />{t('collection.delete')}</button>
    </div>
  {/if}
</Modal>

<CsvImportModal bind:open={csvOpen} text={csvText} fileName={csvName} collectionId={id} onimported={(deckId) => navigate(`/deck/${deckId}`)} />

<style>
  .center {
    padding: 32px 0;
    text-align: center;
  }
  .summary {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 4px;
  }
  .stats {
    display: grid;
    flex: 1;
    gap: 6px;
  }
  .speech-line {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
    padding: 4px 2px;
    border: 0;
    background: none;
    color: var(--muted);
    font: inherit;
    font-size: 0.875rem;
    text-align: left;
    cursor: pointer;
  }
  .sub-title {
    margin: 0 0 4px;
    font-size: 0.95rem;
    font-weight: 700;
  }
  .lead {
    margin: 0 0 10px;
  }
  .menu {
    display: grid;
    gap: 8px;
    margin-top: 20px;
  }
  .menu .btn {
    justify-content: flex-start;
  }
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
