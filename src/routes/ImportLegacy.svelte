<script lang="ts">
  import { onMount } from 'svelte';
  import TopBar from '../components/TopBar.svelte';
  import { t } from '../lib/i18n/index.svelte';
  import { BackupError, parseBackup } from '../lib/io/json';
  import { loadPref, savePref } from '../lib/prefs';
  import { importMerge } from '../lib/repo/library';
  import { href } from '../lib/router.svelte';
  import { LEGACY_ORIGIN, prefsToApply, readBackupMessage, type TransferMessage } from '../lib/transfer';

  type Status = { name: 'waiting' } | { name: 'noOpener' } | { name: 'importing' } | { name: 'done'; decks: number; cards: number } | { name: 'failed'; error: string };
  let status = $state<Status>({ name: 'waiting' });

  const opener = window.opener as Window | null;

  function reply(msg: TransferMessage) {
    try {
      opener?.postMessage(msg, LEGACY_ORIGIN);
    } catch {
      /* the old tab is gone */
    }
  }

  async function receive(event: MessageEvent) {
    if (status.name !== 'waiting') return;
    const msg = readBackupMessage(event.origin, event.data);
    if (!msg) return;
    status = { name: 'importing' };
    try {
      const backup = parseBackup(msg.backup, Date.now(), { defaultCollectionName: t('collections.defaultName') });
      await importMerge(backup);
      const prefs = prefsToApply(msg.prefs, (key) => loadPref<unknown>(key, undefined) !== undefined);
      for (const [key, value] of Object.entries(prefs)) savePref(key, value);
      status = { name: 'done', decks: backup.decks.length, cards: backup.cards.length };
      reply({ type: 'karbka-transfer-done', decks: backup.decks.length, cards: backup.cards.length });
    } catch (err) {
      const error = err instanceof BackupError ? err.message : String(err);
      status = { name: 'failed', error };
      reply({ type: 'karbka-transfer-failed', error });
    }
  }

  onMount(() => {
    if (!opener) {
      status = { name: 'noOpener' };
      return;
    }
    window.addEventListener('message', receive);
    reply({ type: 'karbka-transfer-ready' });
    return () => window.removeEventListener('message', receive);
  });

  // A full load without a hash: the carried-over theme and language take effect, and the
  // collection used last at the old address opens.
  function openLibrary() {
    location.replace(import.meta.env.BASE_URL);
  }
</script>

<TopBar title={t('transfer.title')} />

<div class="page">
  <section class="panel" aria-live="polite">
    {#if status.name === 'waiting' || status.name === 'importing'}
      <p>{t('transfer.working')}</p>
    {:else if status.name === 'done'}
      <p class="big">{t('transfer.done')}</p>
      <p>{t('transfer.counts', { decks: status.decks, cards: status.cards })}</p>
      <button class="btn btn-primary" type="button" onclick={openLibrary}>{t('transfer.open')}</button>
    {:else if status.name === 'failed'}
      <p>{t('settings.importFailed', { error: status.error })}</p>
      <p>{t('transfer.fileFallback')}</p>
      <a class="btn" href={href('/settings')}>{t('nav.settings')}</a>
    {:else}
      <p>{t('transfer.noOpener')}</p>
      <p>{t('transfer.fileFallback')}</p>
      <a class="btn" href={href('/settings')}>{t('nav.settings')}</a>
    {/if}
  </section>
</div>

<style>
  .panel {
    display: grid;
    gap: 12px;
    padding: 16px;
  }
  p {
    margin: 0;
  }
  .big {
    font-size: 1.25rem;
    font-weight: 700;
  }
</style>
