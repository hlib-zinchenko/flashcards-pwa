<script lang="ts">
  // Shown by a legacy build (VITE_LEGACY=1) at the old address on every launch:
  // the app moved, and this is how the cards get there.
  import { onDestroy } from 'svelte';
  import { markBackedUp } from '../lib/backup.svelte';
  import { t } from '../lib/i18n/index.svelte';
  import { install, isIos } from '../lib/install.svelte';
  import { dateStamp, saveFile } from '../lib/io/file';
  import { createBackup } from '../lib/io/json';
  import { allCards, allDecks } from '../lib/live';
  import { loadPref } from '../lib/prefs';
  import { loadLibrary } from '../lib/repo/library';
  import { NEW_ORIGIN, readReply, TRANSFER_PREFS, type TransferMessage } from '../lib/transfer';
  import Modal from './Modal.svelte';

  let open = $state(true);
  const host = new URL(NEW_ORIGIN).host;
  // A home-screen app on iPhone keeps its storage apart from Safari, so a page it opens can't
  // reach the new home-screen app. There the cards go by file.
  const byFile = isIos && install.standalone;

  type Status = { name: 'idle' } | { name: 'waiting' } | { name: 'done'; decks: number; cards: number } | { name: 'failed'; error: string } | { name: 'blocked' };
  let status = $state<Status>({ name: 'idle' });
  let target: Window | null = null;

  async function onMessage(event: MessageEvent) {
    const msg = readReply(event.origin, event.data);
    if (!msg || !target || event.source !== target) return;
    if (msg.type === 'karbka-transfer-ready') {
      const prefs = Object.fromEntries(TRANSFER_PREFS.map((key) => [key, loadPref<unknown>(key, null)]));
      const backup = JSON.stringify(createBackup(await loadLibrary()));
      const out: TransferMessage = { type: 'karbka-transfer-backup', backup, prefs };
      target.postMessage(out, NEW_ORIGIN);
    } else if (msg.type === 'karbka-transfer-done') {
      status = { name: 'done', decks: msg.decks, cards: msg.cards };
    } else {
      status = { name: 'failed', error: msg.error };
    }
  }

  window.addEventListener('message', onMessage);
  onDestroy(() => window.removeEventListener('message', onMessage));

  function move() {
    // Not noopener: the new page answers through window.opener.
    target = window.open(`${NEW_ORIGIN}/#/import-legacy`, '_blank');
    status = target ? { name: 'waiting' } : { name: 'blocked' };
  }

  async function saveBackup() {
    const backup = createBackup(await loadLibrary());
    await saveFile(`karbka-${dateStamp()}.json`, JSON.stringify(backup), 'application/json');
    markBackedUp();
  }
</script>

<Modal bind:open title={t('moved.title')}>
  <div class="body" aria-live="polite">
    <p>{t('moved.text', { host })}</p>
    {#if $allDecks && $allCards}
      <p class="muted">{t('moved.here')} {t('transfer.counts', { decks: $allDecks.length, cards: $allCards.length })}</p>
    {/if}

    {#if byFile}
      <ol>
        <li>{t('moved.ios1')}</li>
        <li>{t('moved.ios2', { host })}</li>
        <li>{t('moved.ios3')}</li>
      </ol>
      <button class="btn btn-primary" type="button" onclick={saveBackup}>{t('moved.save')}</button>
    {:else if status.name === 'done'}
      <p class="big">{t('transfer.done')}</p>
      <p>{t('transfer.counts', { decks: status.decks, cards: status.cards })}</p>
      <a class="btn btn-primary" href={NEW_ORIGIN}>{t('moved.open', { host })}</a>
    {:else}
      {#if status.name === 'waiting'}
        <p>{t('moved.waiting')}</p>
      {:else if status.name === 'blocked'}
        <p>{t('moved.blocked')}</p>
      {:else if status.name === 'failed'}
        <p>{t('settings.importFailed', { error: status.error })}</p>
      {/if}
      <button class="btn btn-primary" type="button" onclick={move}>{t('moved.move')}</button>
      <button class="btn" type="button" onclick={saveBackup}>{t('moved.save')}</button>
    {/if}
    <p class="muted">{t('moved.stillWorks')}</p>
  </div>
  {#snippet footer()}
    <button class="btn btn-ghost" type="button" onclick={() => (open = false)}>{t('moved.later')}</button>
  {/snippet}
</Modal>

<style>
  .body {
    display: grid;
    gap: 12px;
  }
  p,
  ol {
    margin: 0;
    line-height: 1.4;
  }
  ol {
    display: grid;
    gap: 6px;
    padding-left: 1.4em;
  }
  .muted {
    color: var(--muted);
    font-size: 0.9rem;
  }
  .big {
    font-size: 1.15rem;
    font-weight: 700;
  }
</style>
