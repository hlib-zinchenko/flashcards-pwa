<script lang="ts">
  import { onMount } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import CardEditor from '../components/CardEditor.svelte';
  import Icon from '../components/Icon.svelte';
  import Modal from '../components/Modal.svelte';
  import SwipeCard from '../components/SwipeCard.svelte';
  import { db } from '../lib/db';
  import { t, tagLabel } from '../lib/i18n/index.svelte';
  import { allTags } from '../lib/live';
  import { loadPref, savePref } from '../lib/prefs';
  import { gradeCard, updateCard, type CardInput } from '../lib/repo/cards';
  import { navigate } from '../lib/router.svelte';
  import { buildPool, Session, sortCards, summarize, type Mode, type Summary } from '../lib/session';
  import { testState } from '../lib/testState.svelte';
  import type { Card, Level } from '../lib/types';

  const cfg = testState.config;

  const cards = new SvelteMap<string, Card>();
  let session = $state.raw<Session | null>(null);
  let startLevels = new Map<string, Level>();
  /** Bumped after every session mutation (Session itself is not reactive). */
  let version = $state(0);
  let flipped = $state(false);
  let busy = false;
  let summary = $state<Summary | null>(null);
  let missedIds = $state<string[]>([]);
  let editOpen = $state(false);
  let showGestures = $state(!loadPref('gestureHintSeen', false));
  let swipeCard: SwipeCard | undefined = $state();

  const tagById = $derived(new Map(($allTags ?? []).map((tag) => [tag.id, tag])));

  const current = $derived.by(() => {
    version;
    return session?.current ? cards.get(session.current) : undefined;
  });
  const progress = $derived.by(() => {
    version;
    if (!session) return { done: 0, total: 0, answered: 0 };
    return { done: session.learned.size, total: session.pool.length, answered: session.answered };
  });
  const prompt = $derived(current ? (cfg.direction === 'front' ? current.front : current.back) : '');
  const answer = $derived(current ? (cfg.direction === 'front' ? current.back : current.front) : '');
  const tagLabels = $derived(
    (current?.tags ?? []).map((id) => tagById.get(id)).filter((tag) => !!tag).map((tag) => tagLabel(tag)),
  );

  function begin(pool: Card[], mode: Mode) {
    cards.clear();
    for (const c of pool) cards.set(c.id, c);
    startLevels = new Map(pool.map((c) => [c.id, c.level]));
    session = new Session(
      pool.map((c) => c.id),
      mode,
      { reshuffle: cfg.sort === 'random' },
    );
    summary = null;
    flipped = false;
    version++;
  }

  async function load(onlyIds: string[] | null = null) {
    const [decks, all] = await Promise.all([db.decks.toArray(), db.cards.toArray()]);
    const deckOrder = new Map(decks.map((d) => [d.id, d.position]));
    let pool: Card[];
    let mode = cfg.mode;
    if (onlyIds) {
      const ids = new Set(onlyIds);
      pool = sortCards(all.filter((c) => ids.has(c.id)), cfg, deckOrder);
      mode = 'finite';
    } else {
      pool = buildPool(all, cfg, deckOrder);
    }
    if (pool.length === 0) {
      navigate('/test', { replace: true });
      return;
    }
    begin(pool, mode);
  }

  onMount(() => {
    const only = testState.onlyCardIds;
    testState.onlyCardIds = null;
    load(only);
  });

  async function grade(known: boolean) {
    if (!session || busy || session.current === null) return;
    busy = true;
    try {
      const id = session.current;
      const updated = await gradeCard(id, known);
      if (updated) cards.set(id, updated);
      session.grade(known);
      flipped = false;
      version++;
      if (session.done) finish();
    } finally {
      busy = false;
    }
  }

  function finish() {
    if (!session) return;
    if (session.answered === 0) {
      navigate('/test');
      return;
    }
    const levels = new Map([...cards].map(([id, c]) => [id, c.level]));
    summary = summarize(session, startLevels, levels);
    missedIds = [...session.missed];
  }

  async function saveEdit(input: CardInput) {
    if (!current) return;
    await updateCard(current.id, input);
    cards.set(current.id, { ...current, front: input.front.trim(), back: input.back.trim(), tags: [...input.tags] });
    editOpen = false;
  }

  function dismissGestures() {
    showGestures = false;
    savePref('gestureHintSeen', true);
  }

  function onKey(e: KeyboardEvent) {
    if (editOpen || summary || !current) return;
    if (showGestures) {
      if (e.key === 'Enter' || e.key === 'Escape') dismissGestures();
      return;
    }
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    switch (e.key) {
      case ' ':
      case 'ArrowUp':
      case 'ArrowDown':
        e.preventDefault();
        flipped = !flipped;
        break;
      case 'ArrowRight':
        swipeCard?.fly(true);
        break;
      case 'ArrowLeft':
        swipeCard?.fly(false);
        break;
      case 'e':
      case 'E':
        editOpen = true;
        break;
      case 'Escape':
        finish();
        break;
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="run">
  {#if summary}
    <div class="summary">
      <h1>{t('summary.title')}</h1>
      <dl class="stats">
        <div><dt>{t('summary.answered')}</dt><dd>{summary.answered}</dd></div>
        <div><dt>{t('summary.firstTry')}</dt><dd class="know">{summary.firstTry}</dd></div>
        <div><dt>{t('summary.missed')}</dt><dd class="miss">{summary.missed}</dd></div>
        <div><dt>{t('summary.levelUps')}</dt><dd class="know">↑ {summary.levelUps}</dd></div>
        <div><dt>{t('summary.levelDowns')}</dt><dd class="miss">↓ {summary.levelDowns}</dd></div>
      </dl>
      <div class="summary-actions">
        {#if missedIds.length > 0}
          <button class="btn btn-block" type="button" onclick={() => load(missedIds)}>
            {t('summary.retryMissed', { n: missedIds.length })}
          </button>
        {/if}
        <button class="btn btn-block" type="button" onclick={() => load()}>
          <Icon name="reset" size={18} />{t('summary.again')}
        </button>
        <button class="btn btn-primary btn-block" type="button" onclick={() => navigate('/test')}>
          {t('summary.done')}
        </button>
      </div>
    </div>
  {:else if current}
    <header>
      <button class="icon-btn" type="button" onclick={finish} aria-label={t('run.finish')} title={t('run.finish')}>
        <Icon name="close" />
      </button>
      <div class="progress">
        {#if session?.mode === 'finite'}
          <div class="track"><div class="fill" style:width="{(progress.done / progress.total) * 100}%"></div></div>
          <span class="muted small">{progress.done} / {progress.total}</span>
        {:else}
          <span class="muted small">{t('run.answered', { n: progress.answered })}</span>
        {/if}
      </div>
      <button class="icon-btn" type="button" onclick={() => (editOpen = true)} aria-label={t('run.edit')} title={t('run.edit')}>
        <Icon name="edit" size={20} />
      </button>
    </header>

    <main class="stage">
      {#key progress.answered}
        <SwipeCard
          bind:this={swipeCard}
          bind:flipped
          {prompt}
          {answer}
          {tagLabels}
          ongrade={grade}
          onedit={() => (editOpen = true)}
        />
      {/key}
    </main>

    <footer>
      <button class="answer miss" type="button" onclick={() => swipeCard?.fly(false)}>
        <Icon name="close" size={20} />{t('run.dontKnow')}
      </button>
      <button class="icon-btn flip" type="button" onclick={() => (flipped = !flipped)} aria-label={t('run.flip')} title={t('run.flip')}>
        <Icon name="flip" />
      </button>
      <button class="answer know" type="button" onclick={() => swipeCard?.fly(true)}>
        <Icon name="check" size={20} />{t('run.know')}
      </button>
    </footer>

    {#if showGestures}
      <div class="gestures" role="dialog" aria-modal="true" aria-label={t('run.gestureTitle')}>
        <div class="gestures-box panel">
          <h2>{t('run.gestureTitle')}</h2>
          <ul>
            <li><span class="g">👆</span>{t('run.gestureTap')}</li>
            <li><span class="g know">→</span>{t('run.gestureRight')}</li>
            <li><span class="g miss">←</span>{t('run.gestureLeft')}</li>
            <li><span class="g accent">↓</span>{t('run.gestureDown')}</li>
          </ul>
          <p class="muted small keys">{t('run.gestureKeys')}</p>
          <button class="btn btn-primary btn-block" type="button" onclick={dismissGestures}>{t('run.gestureOk')}</button>
        </div>
      </div>
    {/if}
  {/if}
</div>

<Modal bind:open={editOpen} title={t('card.edit')}>
  {#if current}
    {#key current.id}
      <CardEditor formId="run-edit" initial={current} tags={$allTags ?? []} onsubmit={saveEdit} />
    {/key}
  {/if}
  {#snippet footer()}
    <button class="btn" type="button" onclick={() => (editOpen = false)}>{t('common.cancel')}</button>
    <button class="btn btn-primary" type="submit" form="run-edit">{t('common.save')}</button>
  {/snippet}
</Modal>

<style>
  .run {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    max-width: 640px;
    margin: 0 auto;
    padding: calc(var(--safe-top) + 4px) 16px calc(var(--safe-bottom) + 12px);
    overflow: hidden;
    overscroll-behavior: none;
    touch-action: none;
  }
  header {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .progress {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }
  .track {
    flex: 1;
    height: 6px;
    overflow: hidden;
    border-radius: 999px;
    background: var(--surface-2);
  }
  .fill {
    height: 100%;
    border-radius: inherit;
    background: var(--know);
    transition: width 0.3s;
  }
  .stage {
    display: flex;
    flex: 1;
    min-height: 0;
    padding: 12px 4px 16px;
  }
  footer {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .answer {
    display: inline-flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 56px;
    border: 2px solid currentColor;
    border-radius: 16px;
    background: var(--surface);
    font-size: 1.02rem;
    font-weight: 700;
    cursor: pointer;
  }
  .answer:active {
    transform: scale(0.97);
  }
  .answer.know {
    color: var(--know);
  }
  .answer.miss {
    color: var(--miss);
  }
  .flip {
    flex: none;
    width: 52px;
    height: 52px;
    border: 1px solid var(--border);
    background: var(--surface);
  }

  .summary {
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: center;
    gap: 24px;
    overflow-y: auto;
    touch-action: pan-y;
  }
  .summary h1 {
    text-align: center;
    font-size: 1.7rem;
  }
  .stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin: 0;
  }
  .stats div {
    padding: 14px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
  }
  .stats div:first-child {
    grid-column: 1 / -1;
  }
  dt {
    color: var(--muted);
    font-size: 0.85rem;
  }
  dd {
    margin: 2px 0 0;
    font-size: 1.8rem;
    font-weight: 800;
  }
  .know {
    color: var(--know);
  }
  .miss {
    color: var(--miss);
  }
  .accent {
    color: var(--accent);
  }
  .summary-actions {
    display: grid;
    gap: 10px;
  }
  .summary-actions .btn {
    min-height: 50px;
  }

  .gestures {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: grid;
    place-items: center;
    padding: 24px;
    background: rgb(0 0 0 / 0.45);
  }
  .gestures-box {
    width: 100%;
    max-width: 380px;
    padding: 22px;
  }
  .gestures-box ul {
    display: grid;
    gap: 12px;
    margin: 16px 0;
    padding: 0;
    list-style: none;
  }
  .gestures-box li {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .g {
    display: inline-grid;
    place-items: center;
    width: 36px;
    height: 36px;
    flex: none;
    border-radius: 50%;
    background: var(--surface-2);
    font-size: 1.2rem;
    font-weight: 800;
  }
  .keys {
    margin: 0 0 16px;
  }
  @media (pointer: coarse) {
    .keys {
      display: none;
    }
  }
</style>
