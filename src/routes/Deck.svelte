<script lang="ts">
  import { liveQuery } from 'dexie';
  import CardEditor from '../components/CardEditor.svelte';
  import CsvImportModal from '../components/CsvImportModal.svelte';
  import Icon from '../components/Icon.svelte';
  import LevelBar from '../components/LevelBar.svelte';
  import Modal from '../components/Modal.svelte';
  import NameModal from '../components/NameModal.svelte';
  import TagPicker from '../components/TagPicker.svelte';
  import TopBar from '../components/TopBar.svelte';
  import { db } from '../lib/db';
  import { languageName, levelLabel, sortTags, t, tagLabel } from '../lib/i18n/index.svelte';
  import { cardRows, toCsv } from '../lib/io/csv';
  import { pickFile, safeFileName, shareFile } from '../lib/io/file';
  import { levelCounts } from '../lib/learning';
  import { allCollections, allDecks, allTags } from '../lib/live';
  import { addCard, deckCards, deleteCard, resetDeckProgress, restoreCard, swapCards, updateCard, type CardInput } from '../lib/repo/cards';
  import { deleteDeck, moveDeck, renameDeck, setDeckSpeech, swapDeckSides } from '../lib/repo/decks';
  import { sideSpeech } from '../lib/collections';
  import { href, navigate, rememberCollection } from '../lib/router.svelte';
  import { quickConfig } from '../lib/session';
  import { testState } from '../lib/testState.svelte';
  import { askConfirm } from '../lib/confirm.svelte';
  import { speechSupported } from '../lib/speech.svelte';
  import { showToast } from '../lib/toast.svelte';
  import type { Card, CardSide } from '../lib/types';

  let { id }: { id: string } = $props();

  // undefined = still loading, null = missing
  const deck = $derived(liveQuery(async () => (await db.decks.get(id)) ?? null));
  const cards = $derived(liveQuery(() => deckCards(id)));
  const collection = $derived($deck ? ($allCollections ?? []).find((c) => c.id === $deck.collectionId) : undefined);
  const tags = $derived($allTags ?? []);
  const tagById = $derived(new Map(tags.map((tag) => [tag.id, tag])));

  // ---- Quick add ----
  let front = $state('');
  let back = $state('');
  let newTags = $state<string[]>([]);
  let frontEl: HTMLTextAreaElement | undefined = $state();
  let backEl: HTMLTextAreaElement | undefined = $state();
  let addOpen = $state(false);
  const showAdd = $derived(addOpen || $cards?.length === 0);

  async function add(e?: SubmitEvent) {
    e?.preventDefault();
    if (!front.trim() && !back.trim()) return;
    await addCard(id, { front, back, tags: newTags });
    // Keep the form open for the next card (it was shown implicitly while the deck was empty).
    addOpen = true;
    front = '';
    back = '';
    frontEl?.focus();
    showToast(t('card.added'));
  }

  function enterNext(e: KeyboardEvent, next: () => void) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      next();
    }
  }

  // ---- Filter ----
  let query = $state('');
  let filterTag = $state<string | null>(null);
  const usedTags = $derived(sortTags(tags.filter((tag) => $cards?.some((c) => c.tags.includes(tag.id)))));
  const filtered = $derived.by(() => {
    const q = query.trim().toLowerCase();
    return ($cards ?? []).filter(
      (c) =>
        (!filterTag || c.tags.includes(filterTag)) &&
        (!q || [c.front, c.back, c.notes ?? ''].some((text) => text.toLowerCase().includes(q))),
    );
  });
  const filtering = $derived(!!query.trim() || filterTag !== null);

  // ---- Reorder ----
  let reordering = $state(false);
  async function move(index: number, delta: number) {
    const list = $cards ?? [];
    const a = list[index];
    const b = list[index + delta];
    if (a && b) await swapCards(a, b);
  }

  // ---- Edit ----
  let editing = $state<Card | null>(null);
  let editOpen = $state(false);
  function openEdit(card: Card) {
    editing = card;
    editOpen = true;
  }
  async function saveEdit(input: CardInput & { deckId?: string }) {
    if (!editing) return;
    await updateCard(editing.id, input);
    editOpen = false;
    showToast(t('card.saved'));
  }
  async function removeEditing() {
    if (!editing) return;
    const ok = await askConfirm({ title: t('card.delete'), message: t('card.deleteConfirm', { name: editing.front || editing.back }), confirmLabel: t('common.delete') });
    if (!ok || !editing) return;
    const removed = await deleteCard(editing.id);
    editOpen = false;
    if (removed) showToast(t('card.deleted'), 6000, { label: t('common.undo'), run: () => restoreCard(removed) });
  }

  // ---- Deck menu ----
  let menuOpen = $state(false);
  let renaming = $state(false);
  let csvOpen = $state(false);
  let csvText = $state('');
  let csvName = $state('');

  async function rename(name: string) {
    await renameDeck(id, name);
    renaming = false;
  }

  async function remove() {
    if (!$deck) return;
    menuOpen = false;
    const ok = await askConfirm({ title: t('deck.delete'), message: t('deck.deleteConfirm', { name: $deck.name }), confirmLabel: t('common.delete') });
    if (!ok) return;
    await deleteDeck(id);
    showToast(t('deck.deleted'));
    navigate('/', { replace: true });
  }

  async function reset() {
    menuOpen = false;
    const ok = await askConfirm({ title: t('deck.resetProgress'), message: t('deck.resetConfirm'), confirmLabel: t('deck.reset') });
    if (!ok) return;
    await resetDeckProgress(id);
    showToast(t('deck.progressReset'));
  }

  async function swapSides() {
    menuOpen = false;
    const ok = await askConfirm({ title: t('deck.swapSides'), message: t('deck.swapConfirm'), confirmLabel: t('deck.swap') });
    if (!ok) return;
    await swapDeckSides(id);
    showToast(t('deck.swapped'));
  }

  async function shareCsv() {
    menuOpen = false;
    if (!$deck || !$cards?.length) return;
    const result = await shareFile(`${safeFileName($deck.name)}.csv`, toCsv(cardRows($cards, tagById)), 'text/csv', $deck.name);
    if (result === 'downloaded') showToast(t('share.downloaded'));
  }

  async function importCsv() {
    menuOpen = false;
    const file = await pickFile('.csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain');
    if (!file) return;
    csvText = await file.text();
    csvName = file.name;
    csvOpen = true;
  }

  // ---- Reading aloud ----
  let speechOpen = $state(false);
  const sides: [CardSide, () => string][] = [
    ['front', () => t('card.front')],
    ['back', () => t('card.back')],
  ];
  /** Language the side is read in, or '' when off (also when the collection dropped that language). */
  const sideLang = (side: CardSide) => ($deck && sideSpeech($deck, collection, side)?.lang) || '';

  async function chooseSide(side: CardSide, lang: string) {
    if (!$deck) return;
    await setDeckSpeech(id, { front: sideLang('front'), back: sideLang('back'), [side]: lang });
  }

  // ---- Move ----
  let moveOpen = $state(false);
  async function moveTo(collectionId: string) {
    moveOpen = false;
    if (!$deck || collectionId === $deck.collectionId) return;
    await moveDeck(id, collectionId);
    const target = $allCollections?.find((c) => c.id === collectionId);
    showToast(t('deck.moved', { name: target?.name ?? '' }));
  }

  function study() {
    if ($deck) rememberCollection($deck.collectionId);
    Object.assign(testState.config, quickConfig($state.snapshot(testState.config), [id]));
    navigate('/test');
  }
</script>

<TopBar title={$deck?.name ?? ''} back={href($deck ? `/collection/${$deck.collectionId}` : '/')}>
  {#snippet actions()}
    {#if $deck}
      {#if $cards?.length}
        <button class="icon-btn" type="button" onclick={shareCsv} aria-label={t('deck.share')} title={t('deck.share')}>
          <Icon name="share" size={19} />
        </button>
      {/if}
      <button class="icon-btn" type="button" onclick={() => (menuOpen = true)} aria-label={t('common.more')}>
        <Icon name="more" />
      </button>
    {/if}
  {/snippet}
</TopBar>

<div class="page">
  {#if $deck === null}
    <p class="muted center">{t('deck.notFound')}</p>
  {:else if $deck && $cards}
    <div class="summary">
      <div class="stats">
        <LevelBar counts={levelCounts($cards)} />
        <span class="muted small">{t('decks.cards', { n: $cards.length })}</span>
      </div>
      <button class="btn btn-mint" type="button" onclick={study} disabled={$cards.length === 0}>
        <Icon name="play" size={18} />{t('deck.study')}
      </button>
    </div>

    <!-- Quick add -->
    {#if showAdd}
      <form class="add panel" onsubmit={add}>
        <label class="field">
          <span>{t('card.front')}</span>
          <textarea
            class="input"
            rows="1"
            bind:this={frontEl}
            bind:value={front}
            placeholder={t('card.frontPlaceholder')}
            enterkeyhint="next"
            onkeydown={(e) => enterNext(e, () => backEl?.focus())}
          ></textarea>
        </label>
        <label class="field">
          <span>{t('card.back')}</span>
          <textarea
            class="input"
            rows="1"
            bind:this={backEl}
            bind:value={back}
            placeholder={t('card.backPlaceholder')}
            enterkeyhint="done"
            onkeydown={(e) => enterNext(e, () => add())}
          ></textarea>
        </label>
        <div class="field">
          <span>{t('card.tags')}</span>
          <TagPicker bind:selected={newTags} {tags} />
        </div>
        <div class="add-actions">
          <span class="muted small desktop-only">{t('card.enterHint')}</span>
          {#if $cards.length > 0}
            <button class="btn btn-ghost" type="button" onclick={() => (addOpen = false)}>{t('common.close')}</button>
          {/if}
          <button class="btn btn-primary" type="submit" disabled={!front.trim() && !back.trim()}>
            <Icon name="plus" size={18} />{t('common.add')}
          </button>
        </div>
      </form>
    {:else}
      <button class="btn btn-block add-toggle" type="button" onclick={() => (addOpen = true)}>
        <Icon name="plus" size={18} />{t('card.add')}
      </button>
    {/if}

    {#if $cards.length > 0}
      <!-- Toolbar -->
      <div class="toolbar">
        <label class="search">
          <Icon name="search" size={18} />
          <input class="input" type="search" bind:value={query} placeholder={t('deck.search')} disabled={reordering} />
        </label>
        <button
          class="btn"
          class:btn-primary={reordering}
          type="button"
          onclick={() => {
            reordering = !reordering;
            query = '';
            filterTag = null;
          }}
        >
          <Icon name={reordering ? 'check' : 'reorder'} size={18} />
          <span class="desktop-only">{reordering ? t('deck.reorderDone') : t('deck.reorder')}</span>
        </button>
      </div>
      {#if usedTags.length > 0 && !reordering}
        <div class="tag-filter chips">
          {#each usedTags as tag (tag.id)}
            <button
              type="button"
              class="chip"
              aria-pressed={filterTag === tag.id}
              onclick={() => (filterTag = filterTag === tag.id ? null : tag.id)}
            >
              {tagLabel(tag)}
            </button>
          {/each}
        </div>
      {/if}

      <ul class="cards">
        {#each filtered as card, i (card.id)}
          <li class="panel">
            <button class="card-row" type="button" onclick={() => !reordering && openEdit(card)} disabled={reordering}>
              <span
                class="level-dot"
                style:background="var(--lv{card.level})"
                title={levelLabel(card.level)}
                aria-label={levelLabel(card.level)}
              ></span>
              <span class="texts">
                <span class="front">{card.front}</span>
                <span class="back muted">{card.back}</span>
                {#if card.tags.length}
                  <span class="tags">
                    {#each card.tags as tid (tid)}
                      {@const tag = tagById.get(tid)}
                      {#if tag}<span class="tag-pill">{tagLabel(tag)}</span>{/if}
                    {/each}
                  </span>
                {/if}
              </span>
            </button>
            {#if reordering && !filtering}
              <div class="move">
                <button class="icon-btn" type="button" disabled={i === 0} onclick={() => move(i, -1)} aria-label={t('deck.moveUp')}>
                  <Icon name="up" />
                </button>
                <button class="icon-btn" type="button" disabled={i === filtered.length - 1} onclick={() => move(i, 1)} aria-label={t('deck.moveDown')}>
                  <Icon name="down" />
                </button>
              </div>
            {/if}
          </li>
        {:else}
          <p class="muted center">{t('deck.noMatches')}</p>
        {/each}
      </ul>
    {/if}
  {/if}
</div>

<!-- Edit card -->
<Modal bind:open={editOpen} title={t('card.edit')}>
  {#if editing}
    {#key editing.id}
      <CardEditor
        formId="edit-card"
        initial={editing}
        {tags}
        decks={$allDecks ?? []}
        onsubmit={saveEdit}
      />
    {/key}
    <p class="muted small">
      {levelLabel(editing.level)} · {t('card.stats', { seen: editing.timesSeen, known: editing.timesKnown, missed: editing.timesMissed })}
    </p>
  {/if}
  {#snippet footer()}
    <button class="btn btn-danger icon-only" type="button" onclick={removeEditing} aria-label={t('card.delete')}>
      <Icon name="trash" size={18} />
    </button>
    <button class="btn btn-primary" type="submit" form="edit-card">{t('common.save')}</button>
  {/snippet}
</Modal>

<!-- Deck actions -->
<Modal bind:open={menuOpen} title={$deck?.name ?? ''}>
  <div class="menu">
    <button class="btn" type="button" onclick={() => { menuOpen = false; renaming = true; }}>
      <Icon name="edit" size={18} />{t('deck.rename')}
    </button>
    {#if speechSupported}
      <button class="btn" type="button" onclick={() => { menuOpen = false; speechOpen = true; }}>
        <Icon name="volume" size={18} />{t('deck.speech')}
      </button>
    {/if}
    {#if ($allCollections?.length ?? 0) > 1}
      <button class="btn" type="button" onclick={() => { menuOpen = false; moveOpen = true; }}>
        <Icon name="right" size={18} />{t('deck.move')}
      </button>
    {/if}
    <button class="btn" type="button" onclick={swapSides} disabled={!$cards?.length}>
      <Icon name="flip" size={18} />{t('deck.swapSides')}
    </button>
    <button class="btn" type="button" onclick={importCsv}><Icon name="fileImport" size={18} />{t('deck.importCsv')}</button>
    <button class="btn" type="button" onclick={shareCsv} disabled={!$cards?.length}>
      <Icon name="share" size={18} />{t('deck.share')}
    </button>
    <button class="btn" type="button" onclick={reset} disabled={!$cards?.length}>
      <Icon name="reset" size={18} />{t('deck.resetProgress')}
    </button>
    <button class="btn btn-danger" type="button" onclick={remove}><Icon name="trash" size={18} />{t('deck.delete')}</button>
  </div>
</Modal>

<Modal bind:open={speechOpen} title={t('deck.speech')}>
  {#if $deck && collection}
    {#if collection.languages.length}
      <p class="muted small speech-lead">{t('deck.speechHint')}</p>
      {#each sides as [side, label] (side)}
        <h3 class="side-title">{label()}</h3>
        <div class="chips side-chips">
          <button type="button" class="chip" aria-pressed={sideLang(side) === ''} onclick={() => chooseSide(side, '')}>{t('deck.speechOff')}</button>
          {#each collection.languages as l (l.lang)}
            <button type="button" class="chip" aria-pressed={sideLang(side) === l.lang} onclick={() => chooseSide(side, l.lang)}>
              {languageName(l.lang)}
            </button>
          {/each}
        </div>
      {/each}
    {:else}
      <p class="muted">{t('deck.speechNoLanguages', { name: collection.name })}</p>
      <a class="btn btn-block" href={href(`/collection/${collection.id}`)} onclick={() => (speechOpen = false)}>
        <Icon name="settings" size={18} />{collection.name}
      </a>
    {/if}
  {/if}
</Modal>

<Modal bind:open={moveOpen} title={t('deck.move')}>
  <div class="menu">
    {#each $allCollections ?? [] as c (c.id)}
      <button class="btn" class:btn-primary={c.id === $deck?.collectionId} type="button" onclick={() => moveTo(c.id)}>
        {#if c.id === $deck?.collectionId}<Icon name="check" size={18} />{/if}{c.name}
      </button>
    {/each}
  </div>
</Modal>

<NameModal
  bind:open={renaming}
  title={t('deck.rename')}
  label={t('deck.name')}
  value={$deck?.name ?? ''}
  submitLabel={t('common.save')}
  onsubmit={rename}
/>

<CsvImportModal bind:open={csvOpen} text={csvText} fileName={csvName} deckId={id} />

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
  .add {
    margin-top: 16px;
    padding: 14px 14px 10px;
  }
  .add textarea {
    min-height: 44px;
    field-sizing: content;
    max-height: 160px;
  }
  .add-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
  }
  .add-actions .muted {
    flex: 1;
  }
  .add-toggle {
    margin-top: 16px;
    border: 2px dashed color-mix(in srgb, var(--text) 40%, transparent);
    background: transparent;
    box-shadow: none;
    color: var(--text);
  }
  .add-toggle:active {
    background: color-mix(in srgb, var(--surface) 40%, transparent);
    box-shadow: none;
  }
  .toolbar {
    display: flex;
    gap: 8px;
    margin-top: 20px;
  }
  .search {
    position: relative;
    flex: 1;
    color: var(--muted);
  }
  .search :global(svg) {
    position: absolute;
    top: 13px;
    left: 12px;
  }
  .search input {
    padding-left: 38px;
  }
  .tag-filter {
    flex-wrap: nowrap;
    margin: 10px -16px 0;
    padding: 0 16px 2px;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .tag-filter .chip {
    flex: none;
  }
  .cards {
    display: grid;
    gap: 12px;
    margin: 12px 0 0;
    padding: 0;
    list-style: none;
  }
  .cards li {
    display: flex;
    align-items: center;
    overflow: hidden;
  }
  .card-row {
    display: flex;
    flex: 1;
    align-items: flex-start;
    gap: 12px;
    min-width: 0;
    padding: 12px 14px;
    border: 0;
    background: none;
    text-align: left;
    cursor: pointer;
  }
  .card-row:disabled {
    cursor: default;
    color: inherit;
  }
  .card-row:active:not(:disabled) {
    background: var(--surface-2);
  }
  .card-row .level-dot {
    margin-top: 7px;
  }
  .texts {
    display: grid;
    flex: 1;
    gap: 2px;
    min-width: 0;
  }
  .front,
  .back {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .front {
    font-family: var(--font-card);
    font-size: 1.05rem;
    font-weight: 700;
  }
  .back {
    font-size: 0.92rem;
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
  }
  .move {
    display: flex;
    padding-right: 4px;
  }
  .move .icon-btn:disabled {
    opacity: 0.3;
  }
  .menu {
    display: grid;
    gap: 8px;
  }
  .menu .btn {
    justify-content: flex-start;
  }
  .speech-lead {
    margin: 0 0 4px;
  }
  /* The sheet is paper too; tint unselected chips so they don't vanish into it (as in TagPicker). */
  .side-chips .chip:not([aria-pressed='true']) {
    background: var(--accent-soft);
  }
  .side-title {
    margin: 14px 0 8px;
    font-size: 0.95rem;
    font-weight: 700;
  }
  .desktop-only {
    display: none;
  }
  @media (hover: hover) and (pointer: fine) {
    .desktop-only {
      display: inline;
    }
  }
</style>
