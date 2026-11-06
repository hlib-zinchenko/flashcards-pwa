<script lang="ts">
  import { i18n, t } from '../lib/i18n/index.svelte';
  import { router } from '../lib/router.svelte';
  import { checkWhatsNew, whatsNew } from '../lib/whatsNew.svelte';
  import { RELEASES_URL, type ChangelogEntry } from '../lib/changelog';
  import Modal from './Modal.svelte';

  let open = $state(false);
  // Keep the entries on screen while the dialog closes.
  let shown = $state.raw<ChangelogEntry[]>([]);

  checkWhatsNew();

  $effect(() => {
    // Don't cover a test in progress; the sheet waits until the test ends.
    if (whatsNew.entries.length && router.route.name !== 'run') {
      shown = whatsNew.entries;
      open = true;
    }
  });

  function close() {
    whatsNew.entries = [];
  }
</script>

<Modal bind:open title={t('whatsNew.title')} onclose={close}>
  {#each shown as entry (entry.version)}
    <section>
      <h3>{t('settings.version', { v: entry.version })}</h3>
      <ul>
        {#each ((entry as unknown as Record<string, string[] | undefined>)[i18n.lang] ?? entry.en) as line, i (i)}<li>{line}</li>{/each}
      </ul>
    </section>
  {/each}
  <p class="history"><a href={RELEASES_URL} target="_blank" rel="noopener noreferrer">{t('whatsNew.history')}</a></p>
  {#snippet footer()}
    <button class="btn btn-primary" type="button" onclick={() => (open = false)}>{t('whatsNew.ok')}</button>
  {/snippet}
</Modal>

<style>
  section + section {
    margin-top: 16px;
  }
  h3 {
    margin-bottom: 6px;
    color: var(--muted);
    font-size: 0.85rem;
    font-weight: 700;
  }
  ul {
    display: grid;
    gap: 8px;
    padding-left: 1.2em;
  }
  .history {
    margin-top: 16px;
    font-size: 0.9rem;
  }
  li {
    line-height: 1.4;
  }
</style>
