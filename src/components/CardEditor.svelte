<script lang="ts">
  import { t } from '../lib/i18n/index.svelte';
  import type { CardInput } from '../lib/repo/cards';
  import type { Deck, Tag } from '../lib/types';
  import TagPicker from './TagPicker.svelte';

  let {
    initial,
    tags,
    decks,
    formId,
    onsubmit,
  }: {
    initial: CardInput & { deckId?: string };
    tags: Tag[];
    /** When given, a deck selector is shown so the card can be moved. */
    decks?: Deck[];
    formId: string;
    onsubmit: (input: CardInput & { deckId?: string }) => void;
  } = $props();

  // Editor state is seeded once from `initial`; the parent re-creates the editor per card.
  // svelte-ignore state_referenced_locally
  let front = $state(initial.front);
  // svelte-ignore state_referenced_locally
  let back = $state(initial.back);
  // svelte-ignore state_referenced_locally
  let selected = $state([...initial.tags]);
  // svelte-ignore state_referenced_locally
  let deckId = $state(initial.deckId);

  function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!front.trim() && !back.trim()) return;
    onsubmit({ front, back, tags: selected, deckId });
  }
</script>

<form id={formId} onsubmit={submit}>
  <label class="field">
    <span>{t('card.front')}</span>
    <textarea class="input" bind:value={front} rows="2" placeholder={t('card.frontPlaceholder')}></textarea>
  </label>
  <label class="field">
    <span>{t('card.back')}</span>
    <textarea class="input" bind:value={back} rows="2" placeholder={t('card.backPlaceholder')}></textarea>
  </label>
  <div class="field">
    <span>{t('card.tags')}</span>
    <TagPicker bind:selected {tags} />
  </div>
  {#if decks && decks.length > 1}
    <label class="field">
      <span>{t('card.deck')}</span>
      <select class="input" bind:value={deckId}>
        {#each decks as deck (deck.id)}
          <option value={deck.id}>{deck.name}</option>
        {/each}
      </select>
    </label>
  {/if}
</form>
