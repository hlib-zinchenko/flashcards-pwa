<script lang="ts">
  import CsvImportModal from '../components/CsvImportModal.svelte';
  import Icon from '../components/Icon.svelte';
  import InstallHint from '../components/InstallHint.svelte';
  import LevelBar from '../components/LevelBar.svelte';
  import NameModal from '../components/NameModal.svelte';
  import TopBar from '../components/TopBar.svelte';
  import { t } from '../lib/i18n/index.svelte';
  import { pickFile } from '../lib/io/file';
  import { levelCounts } from '../lib/learning';
  import { allCards, allDecks } from '../lib/live';
  import { createDeck } from '../lib/repo/decks';
  import { href, navigate } from '../lib/router.svelte';
  import type { Card } from '../lib/types';

  const byDeck = $derived.by(() => {
    const map = new Map<string, Card[]>();
    for (const c of $allCards ?? []) {
      const list = map.get(c.deckId);
      if (list) list.push(c);
      else map.set(c.deckId, [c]);
    }
    return map;
  });

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
    <ul class="list">
      {#each $allDecks as deck (deck.id)}
        {@const cards = byDeck.get(deck.id) ?? []}
        <li>
          <a class="deck panel" href={href(`/deck/${deck.id}`)}>
            <div class="row">
              <span class="name">{deck.name}</span>
              <span class="muted small">{t('decks.cards', { n: cards.length })}</span>
              <Icon name="right" size={18} />
            </div>
            <LevelBar counts={levelCounts(cards)} />
          </a>
        </li>
      {/each}
    </ul>
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
  .list {
    display: grid;
    gap: 10px;
    margin: 12px 0 0;
    padding: 0;
    list-style: none;
  }
  .deck {
    display: grid;
    gap: 12px;
    padding: 16px;
    color: inherit;
    text-decoration: none;
  }
  .deck:active {
    background: var(--surface-2);
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
