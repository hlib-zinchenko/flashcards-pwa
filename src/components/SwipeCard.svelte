<script lang="ts">
  import { classifyGesture, lockAxis, type Axis } from '../lib/gestures';
  import { t } from '../lib/i18n/index.svelte';
  import { speak, speechSupported, stopSpeaking } from '../lib/speech.svelte';
  import type { CollectionLanguage } from '../lib/types';
  import Icon from './Icon.svelte';

  let {
    prompt,
    answer,
    promptSpeech = null,
    answerSpeech = null,
    notes = '',
    flipped = $bindable(false),
    tagLabels = [],
    tone = 0,
    ongrade,
    onleave,
    onedit,
  }: {
    prompt: string;
    answer: string;
    /** Language and voice to read each face in; null = that face has no read-aloud button. */
    promptSpeech?: CollectionLanguage | null;
    answerSpeech?: CollectionLanguage | null;
    notes?: string;
    flipped?: boolean;
    tagLabels?: string[];
    /** Paper colour, 0–2; the test cycles it so each card in the stack differs from the next. */
    tone?: number;
    ongrade: (known: boolean) => void;
    /** Called as the card starts to fly off, so the stack below can move up. */
    onleave?: () => void;
    onedit: () => void;
  } = $props();

  const FLY_MS = 220;

  let el: HTMLDivElement;
  let width = $state(320);
  let height = $state(420);
  let dx = $state(0);
  let dy = $state(0);
  let dragging = $state(false);
  let leaving = $state(false);
  let notesOpen = $state(false);
  /** Face being read aloud. */
  let speaking = $state<'front' | 'back' | null>(null);
  /** Bumped on every start/stop, so a late onend from an interrupted reading is ignored. */
  let speechRun = 0;

  const speechFor = (face: 'front' | 'back') => (face === 'front' ? promptSpeech : answerSpeech);

  /** Read the visible face aloud, or stop if it's already being read. Does nothing on a face that isn't read. */
  export function toggleSpeech() {
    const face = flipped ? 'back' : 'front';
    if (speaking === face) {
      stopReading();
      return;
    }
    const voice = speechFor(face);
    if (!voice) return;
    const run = ++speechRun;
    speaking = face;
    speak(face === 'front' ? prompt : answer, voice, () => {
      if (run === speechRun) speaking = null;
    });
  }

  function stopReading() {
    if (speaking === null) return;
    speechRun++;
    speaking = null;
    stopSpeaking();
  }

  // Stop reading when the card flips or leaves (each card is a new component).
  $effect(() => {
    void flipped;
    return stopReading;
  });

  let pointerId: number | null = null;
  let start = { x: 0, y: 0, t: 0 };
  let axis: Axis | null = null;

  const knowAmount = $derived(Math.min(Math.max(dx / (width * 0.3), 0), 1));
  const missAmount = $derived(Math.min(Math.max(-dx / (width * 0.3), 0), 1));
  const editAmount = $derived(Math.min(Math.max(dy / (height * 0.25), 0), 1));

  function onDown(e: PointerEvent) {
    if (leaving || (e.pointerType === 'mouse' && e.button !== 0)) return;
    // Notes button and scrollable notes handle their own touches.
    if (e.target instanceof Element && e.target.closest('[data-nodrag]')) return;
    pointerId = e.pointerId;
    el.setPointerCapture(e.pointerId);
    start = { x: e.clientX, y: e.clientY, t: performance.now() };
    axis = null;
    dragging = true;
  }

  function onMove(e: PointerEvent) {
    if (!dragging || e.pointerId !== pointerId) return;
    const mx = e.clientX - start.x;
    const my = e.clientY - start.y;
    axis ??= lockAxis(mx, my);
    if (axis === 'x') {
      dx = mx;
      dy = 0;
    } else if (axis === 'y') {
      dx = 0;
      // Downward only, with a little resistance.
      dy = Math.max(0, my) * 0.6;
    }
  }

  function onUp(e: PointerEvent) {
    if (!dragging || e.pointerId !== pointerId) return;
    dragging = false;
    pointerId = null;
    const gesture = classifyGesture({
      dx: e.clientX - start.x,
      dy: e.clientY - start.y,
      dt: performance.now() - start.t,
      width,
      height,
      axis,
    });
    if (gesture === 'left' || gesture === 'right') {
      fly(gesture === 'right');
      return;
    }
    dx = 0;
    dy = 0;
    if (gesture === 'tap') flipped = !flipped;
    else if (gesture === 'down') onedit();
  }

  function onCancel() {
    // lostpointercapture also fires after a normal pointerup; ignore it then.
    if (!dragging) return;
    dragging = false;
    pointerId = null;
    dx = 0;
    dy = 0;
  }

  /** Animate the card off-screen, then report the grade. */
  export function fly(known: boolean) {
    if (leaving) return;
    leaving = true;
    onleave?.();
    dy = 0;
    dx = (known ? 1 : -1) * (window.innerWidth + width);
    setTimeout(() => ongrade(known), FLY_MS);
  }

  function sizeClass(text: string): string {
    const len = [...text].length;
    if (len <= 4) return 'xxl';
    if (len <= 12) return 'xl';
    if (len <= 40) return 'lg';
    if (len <= 120) return 'md';
    return 'sm';
  }
</script>

<!-- Shown on both faces; open/closed state is shared, so it survives a flip. -->
{#snippet notesBlock()}
  {#if notes}
    {#if notesOpen}
      <p class="notes" data-nodrag>{notes}</p>
    {/if}
    <button class="notes-btn" type="button" data-nodrag aria-expanded={notesOpen} onclick={() => (notesOpen = !notesOpen)}>
      {notesOpen ? t('run.hideNotes') : t('run.showNotes')}
    </button>
  {/if}
{/snippet}

{#snippet speakButton(face: 'front' | 'back')}
  {#if speechSupported && speechFor(face)}
    <button
      class="speak-btn"
      class:on={speaking === face}
      type="button"
      data-nodrag
      aria-pressed={speaking === face}
      aria-label={speaking === face ? t('run.stopSpeaking') : t('run.speak')}
      title={speaking === face ? t('run.stopSpeaking') : t('run.speak')}
      onclick={toggleSpeech}
    >
      <Icon name="volume" size={20} />
    </button>
  {/if}
{/snippet}

<div
  class="card"
  class:dragging
  bind:this={el}
  bind:clientWidth={width}
  bind:clientHeight={height}
  style:transform="translate({dx}px, {dy}px) rotate({dx / 18}deg)"
  style:--fly="{FLY_MS}ms"
  role="button"
  tabindex="0"
  aria-label={t('run.tapToFlip')}
  onpointerdown={onDown}
  onpointermove={onMove}
  onpointerup={onUp}
  onpointercancel={onCancel}
  onlostpointercapture={onCancel}
  onkeydown={(e) => {
    if (e.key === 'Enter' && e.target === e.currentTarget) flipped = !flipped;
  }}
>
  <div class="flipper tone{tone}" class:flipped>
    <div class="face front">
      <p class="text {sizeClass(prompt)}">{prompt}</p>
      {@render speakButton('front')}
      {@render notesBlock()}
      <span class="hint">{t('run.tapToFlip')}</span>
    </div>
    <div class="face back">
      <p class="prompt-small">{prompt}</p>
      <p class="text {sizeClass(answer)}">{answer}</p>
      {@render speakButton('back')}
      {#if tagLabels.length}
        <div class="tags">
          {#each tagLabels as label (label)}<span class="tag-pill">{label}</span>{/each}
        </div>
      {/if}
      {@render notesBlock()}
    </div>
  </div>
  <div class="stamp know" style:opacity={knowAmount}>{t('run.know')}</div>
  <div class="stamp miss" style:opacity={missAmount}>{t('run.dontKnow')}</div>
  <div class="stamp edit" style:opacity={editAmount}>{t('run.edit')}</div>
</div>

<style>
  .card {
    position: relative;
    width: 100%;
    height: 100%;
    perspective: 1400px;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    cursor: grab;
    transition: transform var(--fly) ease-out;
    outline: none;
  }
  .card.dragging {
    transition: none;
    cursor: grabbing;
  }
  .flipper {
    position: relative;
    width: 100%;
    height: 100%;
    transform-style: preserve-3d;
    transition: transform 0.38s cubic-bezier(0.3, 0.7, 0.3, 1);
  }
  .flipper.flipped {
    transform: rotateY(180deg);
  }
  .face {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 28px 22px;
    overflow: hidden;
    border-radius: 28px;
    background: var(--tile);
    box-shadow: 0 7px 0 var(--tile-edge);
    text-align: center;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
  }
  /* The same tones as the waiting cards in TestRun, so the one below can take this one's place. */
  .tone0 {
    --tile: var(--surface);
    --tile-edge: var(--surface-edge);
  }
  .tone1 {
    --tile: var(--accent-soft);
    --tile-edge: var(--accent-edge);
  }
  .tone2 {
    --tile: var(--butter);
    --tile-edge: var(--butter-edge);
  }
  /* The blank card below moved up into place; its words settle in. */
  .face > * {
    animation: settle 0.18s ease-out both;
  }
  @keyframes settle {
    from {
      opacity: 0;
    }
  }
  .card:focus-visible .face {
    outline: 3px solid var(--text);
    outline-offset: 3px;
  }
  .back {
    transform: rotateY(180deg);
  }
  /* Only the visible face takes taps. */
  .flipper:not(.flipped) .back,
  .flipper.flipped .front {
    pointer-events: none;
  }
  .text {
    margin: 0;
    max-width: 100%;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
    font-family: var(--font-card);
    font-weight: 700;
    line-height: 1.2;
  }
  .xxl {
    font-size: 4.4rem;
  }
  .xl {
    font-size: 2.6rem;
  }
  .lg {
    font-size: 1.7rem;
  }
  .md {
    font-size: 1.25rem;
  }
  .sm {
    font-size: 1.05rem;
    font-weight: 500;
    text-align: left;
  }
  .hint {
    position: absolute;
    bottom: 18px;
    color: var(--muted-2);
    font-size: 0.8rem;
  }
  .prompt-small {
    margin: 0;
    max-width: 100%;
    color: var(--muted-2);
    font-family: var(--font-card);
    font-size: 1.1rem;
    font-weight: 700;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .tags :global(.tag-pill) {
    background: color-mix(in srgb, var(--text) 10%, transparent);
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 4px;
  }
  .notes {
    flex: 0 1 auto;
    min-height: 0;
    max-width: 100%;
    margin: 0;
    padding: 12px 14px;
    overflow-y: auto;
    border-radius: 14px;
    background: color-mix(in srgb, var(--text) 7%, transparent);
    font-family: var(--font-card);
    font-size: 1rem;
    line-height: 1.5;
    text-align: left;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    touch-action: pan-y;
    user-select: text;
    -webkit-user-select: text;
  }
  .notes-btn {
    flex: none;
    padding: 7px 16px;
    border: 0;
    border-radius: 999px;
    background: color-mix(in srgb, var(--text) 10%, transparent);
    color: var(--text);
    font-size: 0.875rem;
    font-weight: 700;
    cursor: pointer;
  }
  .speak-btn {
    flex: none;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: color-mix(in srgb, var(--text) 10%, transparent);
    color: var(--text);
    cursor: pointer;
  }
  .speak-btn.on {
    background: var(--primary);
    color: var(--on-primary);
  }
  .stamp {
    position: absolute;
    top: 22px;
    padding: 6px 16px;
    border-radius: 999px;
    font-size: 1.15rem;
    font-weight: 800;
    opacity: 0;
    pointer-events: none;
  }
  .stamp.know {
    left: 20px;
    background: var(--mint);
    color: var(--on-mint);
    transform: rotate(-12deg);
  }
  .stamp.miss {
    right: 20px;
    background: var(--rose);
    color: var(--on-rose);
    transform: rotate(12deg);
  }
  @media (prefers-reduced-motion: reduce) {
    .face > * {
      animation: none;
    }
  }
  .stamp.edit {
    left: 50%;
    background: var(--primary);
    color: var(--on-primary);
    transform: translateX(-50%);
  }
</style>
