<script lang="ts">
  import { classifyGesture, lockAxis, type Axis } from '../lib/gestures';
  import { t } from '../lib/i18n/index.svelte';

  let {
    prompt,
    answer,
    notes = '',
    flipped = $bindable(false),
    tagLabels = [],
    ongrade,
    onedit,
  }: {
    prompt: string;
    answer: string;
    notes?: string;
    flipped?: boolean;
    tagLabels?: string[];
    ongrade: (known: boolean) => void;
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
  <div class="flipper" class:flipped>
    <div class="face front">
      <p class="text {sizeClass(prompt)}">{prompt}</p>
      {@render notesBlock()}
      <span class="hint">{t('run.tapToFlip')}</span>
    </div>
    <div class="face back">
      <p class="prompt-small">{prompt}</p>
      <p class="text {sizeClass(answer)}">{answer}</p>
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
    border: 1px solid var(--border);
    border-radius: 22px;
    background: var(--surface);
    box-shadow: var(--shadow-lg);
    text-align: center;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
  }
  .card:focus-visible .face {
    outline: 3px solid var(--accent);
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
    font-weight: 600;
    line-height: 1.25;
  }
  .xxl {
    font-size: 4.2rem;
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
    font-size: 1rem;
    font-weight: 500;
    text-align: left;
  }
  .hint {
    position: absolute;
    bottom: 16px;
    color: var(--muted);
    font-size: 0.8rem;
  }
  .prompt-small {
    margin: 0;
    max-width: 100%;
    color: var(--muted);
    font-size: 1rem;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
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
    padding: 10px 12px;
    overflow-y: auto;
    border-radius: 12px;
    background: var(--surface-2);
    font-size: 0.95rem;
    line-height: 1.4;
    text-align: left;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    touch-action: pan-y;
    user-select: text;
    -webkit-user-select: text;
  }
  .notes-btn {
    flex: none;
    padding: 6px 14px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--surface);
    color: var(--accent);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
  }
  .stamp {
    position: absolute;
    top: 22px;
    padding: 4px 12px;
    border: 3px solid currentColor;
    border-radius: 10px;
    font-size: 1.3rem;
    font-weight: 800;
    text-transform: uppercase;
    opacity: 0;
    pointer-events: none;
  }
  .stamp.know {
    left: 20px;
    color: var(--know);
    transform: rotate(-12deg);
  }
  .stamp.miss {
    right: 20px;
    color: var(--miss);
    transform: rotate(12deg);
  }
  .stamp.edit {
    left: 50%;
    color: var(--accent);
    transform: translateX(-50%);
  }
</style>
