<script lang="ts">
  import { t } from '../lib/i18n/index.svelte';
  import { groupByDeck, parseCsv, splitGroups } from '../lib/io/csv';
  import { addCards, DeckFullError } from '../lib/repo/cards';
  import { createDeck } from '../lib/repo/decks';
  import { normalizeTagName, resolveTagNames } from '../lib/repo/tags';
  import { showToast } from '../lib/toast.svelte';
  import { MAX_DECK_CARDS } from '../lib/types';
  import Modal from './Modal.svelte';

  let {
    open = $bindable(false),
    text,
    fileName,
    deckId,
    collectionId,
    onimported,
  }: {
    open?: boolean;
    text: string;
    fileName: string;
    /** Import into this deck; when absent new decks are created (one per `deck` column value). */
    deckId?: string;
    /** Collection a new deck is created in (needed when deckId is absent). */
    collectionId?: string;
    onimported?: (deckId: string) => void;
  } = $props();

  const PREVIEW = 5;
  let header = $state<boolean | undefined>(undefined);
  let deckName = $state('');
  let busy = $state(false);

  $effect(() => {
    if (open) {
      header = undefined;
      deckName = fileName.replace(/\.[^.]+$/, '');
    }
  });

  const parsed = $derived(parseCsv(text, { header }));
  // A collection file names a deck per row; importing into a deck ignores those names.
  // A deck holds MAX_DECK_CARDS at most: bigger groups become "Name", "Name 2"…
  const groups = $derived(deckId ? null : splitGroups(groupByDeck(parsed.rows, deckName.trim() || fileName), MAX_DECK_CARDS));
  const multi = $derived(!!groups && parsed.rows.some((r) => r.deck));
  const separator = $derived(
    parsed.delimiter === '\t' ? t('csv.tab') : parsed.delimiter === ';' ? t('csv.semicolon') : t('csv.comma'),
  );

  async function doImport() {
    if (!parsed.rows.length || busy) return;
    busy = true;
    try {
      const tagIds = await resolveTagNames(parsed.rows.flatMap((r) => r.tags));
      const targets = deckId ? [{ id: deckId, rows: parsed.rows }] : [];
      for (const group of groups ?? []) targets.push({ id: await createDeck(group.name, collectionId!), rows: group.rows });
      for (const target of targets) {
        await addCards(
          target.id,
          target.rows.map((r) => ({
            front: r.front,
            back: r.back,
            notes: r.notes,
            tags: r.tags.map((name) => tagIds.get(normalizeTagName(name))!).filter(Boolean),
          })),
        );
      }
      showToast(t('csv.imported', { n: parsed.rows.length }));
      open = false;
      // Several decks: stay where the user is, so they see them all.
      if (targets.length === 1) onimported?.(targets[0].id);
    } catch (err) {
      // Only when importing into an existing deck: new decks are split to fit.
      if (!(err instanceof DeckFullError)) throw err;
      showToast(t('csv.noRoom', { n: err.room, max: MAX_DECK_CARDS }), 5000);
    } finally {
      busy = false;
    }
  }
</script>

<Modal bind:open title={t('csv.title')}>
  <p class="muted small hint">{t('csv.formatHint')}</p>
  {#if !deckId && !multi}
    <label class="field">
      <span>{t('deck.name')}</span>
      <input class="input" bind:value={deckName} maxlength="120" />
    </label>
  {/if}
  <label class="check">
    <input type="checkbox" checked={parsed.header} onchange={(e) => (header = e.currentTarget.checked)} />
    {t('csv.header')}
  </label>
  <p class="meta">
    <strong>{t('csv.found', { n: parsed.rows.length })}</strong>
    {#if groups && groups.length > 1}<span class="muted"> · {t('collection.decks', { n: groups.length })}</span>{/if}
    <span class="muted"> · {t('csv.separator')}: {separator}</span>
    {#if parsed.skipped}<span class="muted"> · {t('csv.skipped', { n: parsed.skipped })}</span>{/if}
  </p>
  {#if parsed.rows.length}
    <div class="preview">
      {#each parsed.rows.slice(0, PREVIEW) as row, i (i)}
        <div class="row">
          <span>{row.front}</span>
          <span>{row.back}</span>
          {#if multi}<span class="deck muted small">{row.deck ?? deckName}</span>{/if}
          {#if row.tags.length}<span class="tags">{#each row.tags as tag (tag)}<span class="tag-pill">{tag}</span> {/each}</span>{/if}
        </div>
      {/each}
      {#if parsed.rows.length > PREVIEW}
        <p class="muted small more">{t('csv.more', { n: parsed.rows.length - PREVIEW })}</p>
      {/if}
    </div>
  {:else}
    <p class="muted">{t('csv.empty')}</p>
  {/if}
  {#snippet footer()}
    <button class="btn" type="button" onclick={() => (open = false)}>{t('common.cancel')}</button>
    <button class="btn btn-primary" type="button" disabled={!parsed.rows.length || busy} onclick={doImport}>
      {t('csv.import', { n: parsed.rows.length })}
    </button>
  {/snippet}
</Modal>

<style>
  .hint {
    margin-top: 0;
  }
  .check {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
  }
  .check input {
    width: 20px;
    height: 20px;
    accent-color: var(--accent);
  }
  .meta {
    margin: 4px 0 10px;
  }
  .preview {
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }
  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 12px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    font-size: 0.92rem;
    overflow-wrap: anywhere;
  }
  .row:last-child {
    border-bottom: 0;
  }
  .tags,
  .deck {
    grid-column: 1 / -1;
  }
  .more {
    margin: 0;
    padding: 8px 12px;
  }
</style>
