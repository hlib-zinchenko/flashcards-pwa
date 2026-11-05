<script lang="ts">
  import { onMount } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import CardEditor from '../components/CardEditor.svelte';
  import Icon from '../components/Icon.svelte';
  import Modal from '../components/Modal.svelte';
  import SwipeCard from '../components/SwipeCard.svelte';
  import { countSession } from '../lib/backup.svelte';
  import { db } from '../lib/db';
  import { t, tagLabel } from '../lib/i18n/index.svelte';
  import { allTags } from '../lib/live';
  import { loadPref, savePref } from '../lib/prefs';
  import { gradeFields } from '../lib/learning';
  import { gradeCard, restoreGrade, updateCard, type CardInput } from '../lib/repo/cards';
  import { navigate } from '../lib/router.svelte';
  import { buildPool, Session, sortCards, summarize, type Summary } from '../lib/session';
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
  /** The summary is for a session the user quit; Continue resumes it. */
  let endedEarly = $state(false);
  let remaining = $state(0);
  let missedIds = $state<string[]>([]);
  /** Each graded card as it was before its grade, newest last; parallel to the Session's undo history. */
  let gradedBefore: (Card | undefined)[] = [];
  /** This session already counts toward the backup reminder. */
  let counted = false;
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
    return { done: session.completed, total: session.pool.length, answered: session.answered };
  });
  const canUndo = $derived.by(() => {
    version;
    return session?.canUndo ?? false;
  });
  const missedCards = $derived(missedIds.map((id) => cards.get(id)).filter((c) => !!c));
  const promptOf = (c: Card) => (cfg.direction === 'front' ? c.front : c.back);
  const answerOf = (c: Card) => (cfg.direction === 'front' ? c.back : c.front);
  const prompt = $derived(current ? promptOf(current) : '');
  const answer = $derived(current ? answerOf(current) : '');
  const tagLabels = $derived(
    (current?.tags ?? []).map((id) => tagById.get(id)).filter((tag) => !!tag).map((tag) => tagLabel(tag)),
  );

  function begin(pool: Card[]) {
    cards.clear();
    for (const c of pool) cards.set(c.id, c);
    startLevels = new Map(pool.map((c) => [c.id, c.level]));
    session = new Session(pool.map((c) => c.id), cfg.mode);
    gradedBefore = [];
    counted = false;
    summary = null;
    flipped = false;
    version++;
  }

  async function load(onlyIds: string[] | null = null) {
    const [decks, all] = await Promise.all([db.decks.toArray(), db.cards.toArray()]);
    const deckOrder = new Map(decks.map((d) => [d.id, d.position]));
    let pool: Card[];
    if (onlyIds) {
      const ids = new Set(onlyIds);
      pool = sortCards(all.filter((c) => ids.has(c.id)), cfg, deckOrder);
    } else {
      pool = buildPool(all, cfg, deckOrder);
    }
    if (pool.length === 0) {
      navigate(testState.origin, { replace: true });
      return;
    }
    begin(pool);
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
      const before = cards.get(id);
      const updated = await gradeCard(id, known);
      gradedBefore.push(before);
      if (updated) cards.set(id, updated);
      session.grade(known);
      flipped = false;
      version++;
      if (session.done) finish();
    } finally {
      busy = false;
    }
  }

  /** Take back the last answer: restore the card's level and show it again. */
  async function undo() {
    if (!session || busy || !session.canUndo) return;
    busy = true;
    try {
      const before = gradedBefore.pop();
      if (before) {
        await restoreGrade(before);
        const now = cards.get(before.id);
        if (now) cards.set(before.id, { ...now, ...gradeFields(before) });
      }
      session.undo();
      summary = null;
      flipped = false;
      version++;
    } finally {
      busy = false;
    }
  }

  function finish() {
    if (!session) return;
    if (session.answered === 0) {
      navigate(testState.origin);
      return;
    }
    const levels = new Map([...cards].map(([id, c]) => [id, c.level]));
    summary = summarize(session, startLevels, levels);
    endedEarly = !session.done;
    remaining = session.remaining;
    if (!counted) {
      counted = true;
      countSession();
    }
    missedIds = [...session.missed];
  }

  function resume() {
    summary = null;
    flipped = false;
  }

  async function saveEdit(input: CardInput) {
    if (!current) return;
    await updateCard(current.id, input);
    const updated = await db.cards.get(current.id);
    if (updated) cards.set(updated.id, updated);
    editOpen = false;
  }

  function dismissGestures() {
    showGestures = false;
    savePref('gestureHintSeen', true);
  }

  function onKey(e: KeyboardEvent) {
    if (editOpen) return;
    if (showGestures && current && !summary) {
      if (e.key === 'Enter' || e.key === 'Escape') dismissGestures();
      return;
    }
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') {
      e.preventDefault();
      undo();
      return;
    }
    if (summary || !current) return;
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
      <div class="summary-body">
        <div class="headline">
          <p class="status">{endedEarly ? t('summary.ended', { n: remaining }) : t('summary.title')}</p>
          <h1 aria-label={t('summary.headline', { known: summary.firstTry, total: summary.uniqueCards })}>
            <span class="score display" aria-hidden="true">{summary.firstTry}<span class="of">/{summary.uniqueCards}</span></span>
            <span class="caption" aria-hidden="true">{cfg.mode === 'cram' ? `${t('summary.knownCaption')} ${t('summary.firstTryNote')}` : t('summary.knownCaption')}</span>
          </h1>
        </div>

        <dl class="stats">
          <div class="up"><dd class="display">{summary.levelUps}</dd><dt>{t('summary.levelUps')}</dt></div>
          <div class="down"><dd class="display">{summary.levelDowns}</dd><dt>{t('summary.levelDowns')}</dt></div>
          <div><dd class="display">{summary.missed}</dd><dt>{t('summary.missed')}</dt></div>
          <div><dd class="display">{summary.answered}</dd><dt>{t('summary.answered')}</dt></div>
        </dl>

        {#if missedCards.length > 0}
          <section class="missed">
            <h2 class="section-title">{t('summary.missedCards')}</h2>
            <ul class="panel">
              {#each missedCards as c (c.id)}
                <li><span class="q">{promptOf(c)}</span><span class="a">{answerOf(c)}</span></li>
              {/each}
            </ul>
          </section>
        {/if}

        <div class="summary-actions">
          {#if endedEarly}
            <button class="btn btn-primary btn-block" type="button" onclick={resume}>
              <Icon name="play" size={18} />{t('summary.continue')}
            </button>
          {/if}
          {#if missedIds.length > 0}
            <button class="btn btn-block" type="button" onclick={() => load(missedIds)}>
              {t('summary.retryMissed', { n: missedIds.length })}
            </button>
          {/if}
          {#if !endedEarly}
            <button class="btn btn-block" type="button" onclick={() => load()}>
              <Icon name="reset" size={18} />{t('summary.again')}
            </button>
          {/if}
          <button class="btn btn-block" class:btn-primary={!endedEarly} type="button" onclick={() => navigate(testState.origin)}>
            {t('summary.done')}
          </button>
          {#if !endedEarly && canUndo}
            <button class="btn btn-ghost btn-block" type="button" onclick={undo}>
              <Icon name="undo" size={18} />{t('run.undo')}
            </button>
          {/if}
        </div>
      </div>
    </div>
  {:else if current}
    <header>
      <button class="icon-tile" type="button" onclick={finish} aria-label={t('run.finish')} title={t('run.finish')}>
        <Icon name="close" size={20} />
      </button>
      <div class="progress">
        <div class="track"><div class="fill" style:width="{(progress.done / progress.total) * 100}%"></div></div>
        <span class="count display">{progress.done} / {progress.total}</span>
      </div>
      <button class="icon-tile" type="button" onclick={undo} disabled={!canUndo} aria-label={t('run.undo')} title={t('run.undo')}>
        <Icon name="undo" size={19} />
      </button>
      <button class="icon-tile" type="button" onclick={() => (editOpen = true)} aria-label={t('run.edit')} title={t('run.edit')}>
        <Icon name="edit" size={18} />
      </button>
    </header>

    <main class="stage">
      <!-- The cards still waiting, peeking out from under the current one. -->
      {#if progress.total - progress.done > 1}<div class="ghost g1" aria-hidden="true"></div>{/if}
      {#if progress.total - progress.done > 2}<div class="ghost g2" aria-hidden="true"></div>{/if}
      {#key progress.answered}
        <SwipeCard
          bind:this={swipeCard}
          bind:flipped
          {prompt}
          {answer}
          notes={current.notes}
          {tagLabels}
          ongrade={grade}
          onedit={() => (editOpen = true)}
        />
      {/key}
    </main>

    <footer>
      <button class="answer miss" class:dim={!flipped} type="button" onclick={() => swipeCard?.fly(false)}>
        {t('run.dontKnow')}
      </button>
      <button class="answer flip" type="button" onclick={() => (flipped = !flipped)} aria-label={t('run.flip')} title={t('run.flip')}>
        <Icon name="reset" size={20} />
      </button>
      <button class="answer know" class:dim={!flipped} type="button" onclick={() => swipeCard?.fly(true)}>
        {t('run.know')}
      </button>
    </footer>

    {#if showGestures}
      <div class="gestures" role="dialog" aria-modal="true" aria-label={t('run.gestureTitle')}>
        <div class="gestures-box panel">
          <h2>{t('run.gestureTitle')}</h2>
          <ul>
            <li><span class="g"><Icon name="tap" size={20} /></span>{t('run.gestureTap')}</li>
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
    padding: calc(var(--safe-top) + 8px) 16px calc(var(--safe-bottom) + 16px);
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
    gap: 10px;
    min-width: 0;
    padding: 0 4px;
  }
  .track {
    flex: 1;
    height: 8px;
    overflow: hidden;
    border-radius: 999px;
    background: color-mix(in srgb, var(--surface) 45%, transparent);
  }
  .fill {
    height: 100%;
    border-radius: inherit;
    background: var(--text);
    transition: width 0.3s;
  }
  .count {
    flex: none;
    font-size: 0.95rem;
    font-variant-numeric: tabular-nums;
  }
  .stage {
    position: relative;
    display: flex;
    flex: 1;
    min-height: 0;
    padding: 18px 6px 22px;
  }
  .ghost {
    position: absolute;
    inset: 24px 16px 26px;
    border-radius: 28px;
    pointer-events: none;
  }
  .g1 {
    background: var(--accent-soft);
    box-shadow: 0 6px 0 var(--accent-edge);
    transform: rotate(3.5deg) translate(6px, 4px);
  }
  .g2 {
    background: var(--butter);
    box-shadow: 0 6px 0 var(--butter-edge);
    transform: rotate(-3deg) translate(-4px, 2px);
  }
  footer {
    display: grid;
    grid-template-columns: 1fr 48px 1fr;
    align-items: center;
    gap: 10px;
  }
  .answer {
    --tile: var(--surface);
    --tile-edge: var(--surface-edge);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 48px;
    margin-bottom: 4px;
    padding: 0 10px;
    border: 0;
    border-radius: 16px;
    background: var(--tile);
    box-shadow: 0 4px 0 var(--tile-edge);
    color: var(--text);
    font-size: 1rem;
    font-weight: 700;
    white-space: nowrap;
    cursor: pointer;
    transition: transform 0.08s ease-out, box-shadow 0.08s ease-out, opacity 0.15s;
  }
  .answer:active {
    transform: translateY(3px);
    box-shadow: 0 1px 0 var(--tile-edge);
  }
  /* Grade after seeing the answer; swiping still works for fast users. */
  .answer.dim {
    opacity: 0.55;
  }
  .answer.know {
    --tile: var(--mint);
    --tile-edge: var(--mint-edge);
    color: var(--on-mint);
  }
  .answer.miss {
    --tile: var(--rose);
    --tile-edge: var(--rose-edge);
    color: var(--on-rose);
  }
  .flip {
    width: 48px;
    padding: 0;
    border-radius: 50%;
  }
  header .icon-tile:disabled {
    opacity: 0.35;
  }

  .summary {
    display: flex;
    flex: 1;
    flex-direction: column;
    overflow-y: auto;
    touch-action: pan-y;
  }
  /* Auto margins center the content but let a long missed list scroll from the top. */
  .summary-body {
    display: grid;
    gap: 22px;
    margin: auto 0;
    padding: 16px 0;
  }
  .headline p {
    margin: 0;
  }
  .status {
    color: var(--muted);
    font-size: 0.95rem;
    font-weight: 600;
  }
  .headline h1 {
    display: grid;
    gap: 8px;
    margin: 8px 0 0;
    font-weight: 700;
  }
  .score {
    font-size: 6rem;
    line-height: 0.9;
    font-variant-numeric: tabular-nums;
  }
  .of {
    font-size: 0.5em;
    opacity: 0.55;
  }
  .caption {
    font-size: 1.1rem;
    line-height: 1.3;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
    margin: 0;
  }
  .stats div {
    --tile: var(--surface);
    --tile-edge: var(--surface-edge);
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px 10px 10px;
    border-radius: 16px;
    background: var(--tile);
    box-shadow: 0 4px 0 var(--tile-edge);
  }
  .stats .up {
    --tile: var(--mint);
    --tile-edge: var(--mint-edge);
    color: var(--on-mint);
  }
  .stats .down {
    --tile: var(--rose);
    --tile-edge: var(--rose-edge);
    color: var(--on-rose);
  }
  dt {
    font-size: 0.78rem;
    font-weight: 700;
    line-height: 1.2;
  }
  dd {
    margin: 0;
    font-size: 1.6rem;
    line-height: 1;
  }
  @media (max-width: 360px) {
    .stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  .missed ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .missed li {
    display: flex;
    gap: 12px;
    justify-content: space-between;
    align-items: baseline;
    padding: 13px 16px;
    border-top: 1.5px dashed var(--border);
  }
  .missed li:first-child {
    border-top: 0;
  }
  .missed .q {
    font-family: var(--font-card);
    font-size: 1.15rem;
    font-weight: 700;
  }
  .missed .a {
    color: var(--muted-2);
    text-align: right;
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
    gap: 8px;
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
    background: var(--scrim);
  }
  .gestures-box {
    width: 100%;
    max-width: 380px;
    padding: 22px;
  }
  .gestures-box h2 {
    font-family: var(--font-head);
    font-weight: 900;
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
  .g.know {
    background: var(--mint);
    color: var(--on-mint);
  }
  .g.miss {
    background: var(--rose);
    color: var(--on-rose);
  }
  .keys {
    margin: 0 0 16px;
  }
  @media (pointer: coarse) {
    .keys {
      display: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .answer {
      transition: none;
    }
  }
</style>
