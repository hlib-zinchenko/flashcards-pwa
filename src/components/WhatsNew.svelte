<script lang="ts">
  import { i18n, t } from '../lib/i18n/index.svelte';
  import { router } from '../lib/router.svelte';
  import { checkWhatsNew, whatsNew } from '../lib/whatsNew.svelte';
  import type { ChangelogEntry } from '../lib/changelog';
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
        {#each entry[i18n.lang] as line, i (i)}<li>{line}</li>{/each}
      </ul>
    </section>
  {/each}
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
  li {
    line-height: 1.4;
  }
</style>
