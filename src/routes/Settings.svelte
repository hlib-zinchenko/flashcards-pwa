<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from '../components/Icon.svelte';
  import Modal from '../components/Modal.svelte';
  import NameModal from '../components/NameModal.svelte';
  import TopBar from '../components/TopBar.svelte';
  import { i18n, setLang, sortTags, t, tagLabel, type Lang } from '../lib/i18n/index.svelte';
  import { install, isIos, promptInstall } from '../lib/install.svelte';
  import { dateStamp, pickFile, saveFile } from '../lib/io/file';
  import { BackupError, createBackup, parseBackup, type Backup } from '../lib/io/json';
  import { allTags } from '../lib/live';
  import { importMerge, importReplace, loadLibrary } from '../lib/repo/library';
  import { createTag, deleteTag, renameTag, TagExistsError } from '../lib/repo/tags';
  import { showToast } from '../lib/toast.svelte';
  import type { Tag } from '../lib/types';

  const tags = $derived(sortTags($allTags ?? []));
  const languages: [Lang, string][] = [
    ['en', 'English'],
    ['uk', 'Українська'],
  ];

  // ---- Tags ----
  let newTag = $state('');
  let renaming = $state<Tag | null>(null);
  let renameOpen = $state(false);
  let renameError = $state('');

  async function addTag(e: SubmitEvent) {
    e.preventDefault();
    if (!newTag.trim()) return;
    await createTag(newTag);
    newTag = '';
  }

  async function doRename(name: string) {
    if (!renaming) return;
    try {
      await renameTag(renaming.id, name);
      renameOpen = false;
    } catch (err) {
      if (err instanceof TagExistsError) renameError = t('tags.exists');
      else throw err;
    }
  }

  async function removeTag(tag: Tag) {
    if (confirm(t('tags.deleteConfirm', { name: tag.name }))) await deleteTag(tag.id);
  }

  // ---- Backup ----
  let pending = $state<Backup | null>(null);
  let importOpen = $state(false);

  async function exportLibrary() {
    const backup = createBackup(await loadLibrary());
    await saveFile(`flashcards-${dateStamp()}.json`, JSON.stringify(backup), 'application/json');
    showToast(t('settings.exported'));
  }

  async function chooseBackup() {
    const file = await pickFile('.json,application/json');
    if (!file) return;
    try {
      pending = parseBackup(await file.text());
      importOpen = true;
    } catch (err) {
      const msg = err instanceof BackupError ? err.message : String(err);
      showToast(t('settings.importFailed', { error: msg }), 4000);
    }
  }

  async function applyImport(mode: 'merge' | 'replace') {
    if (!pending) return;
    if (mode === 'replace' && !confirm(t('settings.replaceConfirm'))) return;
    try {
      if (mode === 'merge') await importMerge(pending);
      else await importReplace(pending);
      importOpen = false;
      pending = null;
      showToast(t('settings.imported'));
    } catch (err) {
      showToast(t('settings.importFailed', { error: String(err) }), 4000);
    }
  }

  // ---- Storage ----
  let persisted = $state<boolean | null>(null);
  let usage = $state('');

  function formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  }

  async function refreshStorage() {
    if (!navigator.storage) return;
    persisted = (await navigator.storage.persisted?.()) ?? null;
    const est = await navigator.storage.estimate?.();
    if (est?.usage !== undefined) usage = formatBytes(est.usage);
  }

  async function requestPersist() {
    await navigator.storage?.persist?.();
    await refreshStorage();
  }

  onMount(refreshStorage);
</script>

<TopBar title={t('settings.title')} />

<div class="page">
  <section class="section">
    <h2 class="section-title">{t('settings.language')}</h2>
    <div class="seg">
      {#each languages as [code, name] (code)}
        <button type="button" aria-pressed={i18n.lang === code} onclick={() => setLang(code)}>{name}</button>
      {/each}
    </div>
  </section>

  <section class="section">
    <h2 class="section-title">{t('settings.tags')}</h2>
    <div class="panel list">
      {#each tags as tag (tag.id)}
        <div class="item">
          <Icon name="tag" size={18} />
          <span class="grow">{tagLabel(tag)}</span>
          {#if tag.preset}
            <span class="muted small">{t('tags.preset')}</span>
          {:else}
            <button
              class="icon-btn"
              type="button"
              aria-label={t('tags.rename')}
              onclick={() => {
                renaming = tag;
                renameError = '';
                renameOpen = true;
              }}
            >
              <Icon name="edit" size={18} />
            </button>
            <button class="icon-btn danger" type="button" aria-label={t('common.delete')} onclick={() => removeTag(tag)}>
              <Icon name="trash" size={18} />
            </button>
          {/if}
        </div>
      {/each}
      <form class="item" onsubmit={addTag}>
        <input class="input grow" bind:value={newTag} placeholder={t('tags.newPlaceholder')} maxlength="40" enterkeyhint="done" />
        <button class="btn" type="submit" disabled={!newTag.trim()}><Icon name="plus" size={18} />{t('common.add')}</button>
      </form>
    </div>
  </section>

  <section class="section">
    <h2 class="section-title">{t('settings.backup')}</h2>
    <div class="panel box">
      <p class="muted small">{t('settings.backupHint')}</p>
      <div class="buttons">
        <button class="btn" type="button" onclick={exportLibrary}><Icon name="download" size={18} />{t('settings.export')}</button>
        <button class="btn" type="button" onclick={chooseBackup}><Icon name="upload" size={18} />{t('settings.import')}</button>
      </div>
    </div>
  </section>

  <section class="section">
    <h2 class="section-title">{t('settings.install')}</h2>
    <div class="panel box">
      {#if install.standalone}
        <p>{t('settings.installed')}</p>
      {:else if install.prompt}
        <p class="muted small">{t('install.steps')}</p>
        <button class="btn btn-primary" type="button" onclick={promptInstall}>{t('install.button')}</button>
      {:else if isIos}
        <p><strong>{t('install.iosTitle')}</strong></p>
        <p class="muted small">{t('install.iosSteps')}</p>
        <p class="muted small">{t('install.storageWarning')}</p>
      {:else}
        <p class="muted small">{t('install.steps')}</p>
      {/if}
    </div>
  </section>

  <section class="section">
    <h2 class="section-title">{t('settings.storage')}</h2>
    <div class="panel box">
      {#if persisted}
        <p>{t('settings.persisted')}</p>
      {:else}
        <p class="muted small">{t('settings.notPersisted')}</p>
        {#if persisted === false}
          <button class="btn" type="button" onclick={requestPersist}>{t('settings.persist')}</button>
        {/if}
      {/if}
      {#if usage}<p class="muted small">{t('settings.usage', { used: usage })}</p>{/if}
    </div>
  </section>

  <section class="section">
    <h2 class="section-title">{t('settings.about')}</h2>
    <div class="panel box">
      <p>{t('settings.offline')}</p>
      <p class="muted small">{t('settings.version', { v: __APP_VERSION__ })}</p>
    </div>
  </section>
</div>

<NameModal
  bind:open={renameOpen}
  title={t('tags.rename')}
  label={t('tags.newPlaceholder')}
  value={renaming?.name ?? ''}
  error={renameError}
  submitLabel={t('common.save')}
  onsubmit={doRename}
/>

<Modal bind:open={importOpen} title={t('settings.import')} onclose={() => (pending = null)}>
  {#if pending}
    <p>{t('settings.importSummary', { decks: pending.decks.length, cards: pending.cards.length })}</p>
    <div class="choices">
      <button class="choice panel" type="button" onclick={() => applyImport('merge')}>
        <strong>{t('settings.merge')}</strong>
        <span class="muted small">{t('settings.mergeHint')}</span>
      </button>
      <button class="choice panel" type="button" onclick={() => applyImport('replace')}>
        <strong class="danger">{t('settings.replace')}</strong>
        <span class="muted small">{t('settings.replaceHint')}</span>
      </button>
    </div>
  {/if}
</Modal>

<style>
  .list {
    overflow: hidden;
  }
  .item {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 52px;
    padding: 4px 6px 4px 14px;
    border-bottom: 1px solid var(--border);
    color: var(--muted);
  }
  .item:last-child {
    border-bottom: 0;
    padding: 10px;
  }
  .grow {
    flex: 1;
    min-width: 0;
    color: var(--text);
  }
  .danger {
    color: var(--danger);
  }
  .box {
    padding: 14px 16px;
  }
  .box p {
    margin: 0 0 10px;
  }
  .box p:last-child {
    margin-bottom: 0;
  }
  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .choices {
    display: grid;
    gap: 10px;
  }
  .choice {
    display: grid;
    gap: 4px;
    padding: 14px 16px;
    text-align: left;
    cursor: pointer;
  }
</style>
