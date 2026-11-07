<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import Icon, { type IconName } from '../components/Icon.svelte';
  import Modal from '../components/Modal.svelte';
  import NameModal from '../components/NameModal.svelte';
  import TopBar from '../components/TopBar.svelte';
  import { i18n, LANGUAGES, setLang, sortTags, t, tagLabel, type Lang } from '../lib/i18n/index.svelte';
  import { install, isIos, promptInstall } from '../lib/install.svelte';
  import { dateStamp, pickFile, saveFile } from '../lib/io/file';
  import { BackupError, createBackup, parseBackup, type Backup } from '../lib/io/json';
  import { allTags } from '../lib/live';
  import { importMerge, importReplace, loadLibrary } from '../lib/repo/library';
  import { createTag, deleteTag, renameTag, TagExistsError } from '../lib/repo/tags';
  import type { ThemePref } from '../lib/theme';
  import { setTheme, theme } from '../lib/theme.svelte';
  import { backupDue, daysSince } from '../lib/backup';
  import { backupStatus, markBackedUp } from '../lib/backup.svelte';
  import { askConfirm } from '../lib/confirm.svelte';
  import { showToast } from '../lib/toast.svelte';
  import { openWhatsNew } from '../lib/whatsNew.svelte';
  import type { Tag } from '../lib/types';
  import { RATE_SAMPLE, SPEECH_RATE } from '../lib/speech';
  import { setRate, speak, speechPrefs, speechSupported, stopSpeaking } from '../lib/speech.svelte';

  const tags = $derived(sortTags($allTags ?? []));
  const REPO = 'https://github.com/hlib-zinchenko/flashcards-pwa';
  const links: { href: string; icon: IconName; label: () => string }[] = [
    { href: 'https://hzinchenko.com/', icon: 'globe', label: () => t('settings.madeBy', { name: 'Hlib Zinchenko' }) },
    { href: REPO, icon: 'code', label: () => t('settings.sourceCode') },
    { href: `${REPO}/issues`, icon: 'message', label: () => t('settings.feedback') },
  ];
  const themes: [ThemePref, () => string][] = [
    ['system', () => t('settings.themeSystem')],
    ['light', () => t('settings.themeLight')],
    ['dark', () => t('settings.themeDark')],
  ];

  // ---- Voice ----
  const rateLabel = $derived(`${new Intl.NumberFormat(i18n.lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(speechPrefs.rate)}×`);
  /** The sample is playing, so leaving the screen stops it. */
  let sampling = false;

  /** Let them hear the new speed: an English sentence, once the slider is let go. */
  function playRateSample() {
    sampling = true;
    speak(RATE_SAMPLE.text, { lang: RATE_SAMPLE.lang }, () => (sampling = false));
  }

  onDestroy(() => {
    if (sampling) stopSpeaking();
  });

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
    const ok = await askConfirm({ title: t('tags.delete'), message: t('tags.deleteConfirm', { name: tag.name }), confirmLabel: t('common.delete') });
    if (ok) await deleteTag(tag.id);
  }

  // ---- Backup ----
  // raw: deep $state proxies can't be structured-cloned into IndexedDB (DataCloneError)
  let pending = $state.raw<Backup | null>(null);
  let importOpen = $state(false);

  async function exportLibrary() {
    const backup = createBackup(await loadLibrary());
    await saveFile(`flashcards-${dateStamp()}.json`, JSON.stringify(backup), 'application/json');
    markBackedUp();
    showToast(t('settings.exported'));
  }

  const lastBackup = $derived(
    backupStatus.lastAt === null
      ? t('settings.lastBackupNever')
      : t('settings.lastBackup', {
          when: new Intl.RelativeTimeFormat(i18n.lang, { numeric: 'auto' }).format(-daysSince(backupStatus.lastAt, Date.now()), 'day'),
        }),
  );

  /** Only show the App section when there's an install action to offer. */
  const showInstall = $derived(!install.standalone && (!!install.prompt || isIos));

  async function chooseBackup() {
    const file = await pickFile('.json,application/json');
    if (!file) return;
    try {
      pending = parseBackup(await file.text(), Date.now(), { defaultCollectionName: t('collections.defaultName') });
      importOpen = true;
    } catch (err) {
      const msg = err instanceof BackupError ? err.message : String(err);
      showToast(t('settings.importFailed', { error: msg }), 4000);
    }
  }

  async function applyImport(mode: 'merge' | 'replace') {
    if (!pending) return;
    if (mode === 'replace') {
      const ok = await askConfirm({ title: t('settings.replace'), message: t('settings.replaceConfirm'), confirmLabel: t('settings.replace') });
      if (!ok) return;
    }
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
    const granted = await navigator.storage?.persist?.();
    await refreshStorage();
    // Chrome grants it silently or not at all (it decides by install and engagement), so say when it didn't.
    if (!granted && !persisted) showToast(t('settings.persistDenied'), 5000);
  }

  onMount(refreshStorage);
</script>

<TopBar title={t('settings.title')} />

<div class="page">
  <section class="section">
    <h2 class="section-title">{t('settings.language')}</h2>
    <select class="input" aria-label={t('settings.language')} value={i18n.lang} onchange={(e) => setLang(e.currentTarget.value as Lang)}>
      {#each LANGUAGES as { code, name } (code)}
        <option value={code}>{name}</option>
      {/each}
    </select>
  </section>

  <section class="section">
    <h2 class="section-title">{t('settings.appearance')}</h2>
    <div class="seg">
      {#each themes as [value, label] (value)}
        <button type="button" aria-pressed={theme.pref === value} onclick={() => setTheme(value)}>{label()}</button>
      {/each}
    </div>
  </section>

  <section class="section">
    <h2 class="section-title">{t('settings.voice')}</h2>
    {#if !speechSupported}
      <p class="muted small">{t('collection.speechUnsupported')}</p>
    {:else}
      <p class="muted small lead">{t('settings.voicePerCollection')}</p>
      <div class="rate-head">
        <label class="sub-title" for="speech-rate">{t('settings.speechRate')}</label>
        <span class="rate-value">{rateLabel}</span>
      </div>
      <div class="panel rate">
        <input
          id="speech-rate"
          type="range"
          min={SPEECH_RATE.min}
          max={SPEECH_RATE.max}
          step={SPEECH_RATE.step}
          value={speechPrefs.rate}
          aria-valuetext={rateLabel}
          oninput={(e) => setRate(e.currentTarget.valueAsNumber)}
          onchange={playRateSample}
        />
        <div class="rate-ends muted small" aria-hidden="true">
          <span>{t('settings.speechSlow')}</span>
          <span>{t('settings.speechFast')}</span>
        </div>
      </div>
      <p class="muted small hint">{t('settings.voiceHint')}</p>
    {/if}
  </section>

  <section class="section">
    <h2 class="section-title">{t('settings.tags')}</h2>
    <div class="panel list">
      {#each tags as tag (tag.id)}
        <div class="item">
          <Icon name="tag" size={18} />
          <span class="grow">{tagLabel(tag)}</span>
          {#if tag.preset}
            <span class="preset muted small">{t('tags.preset')}</span>
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
      {#if backupDue(backupStatus)}
        <p class="nudge small" role="status">{lastBackup}. {t('settings.backupNudge', { n: backupStatus.sessionsSince })}</p>
      {:else}
        <p class="small">{lastBackup}</p>
      {/if}
      <div class="buttons">
        <button class="btn" type="button" onclick={exportLibrary}><Icon name="download" size={18} />{t('settings.export')}</button>
        <button class="btn" type="button" onclick={chooseBackup}><Icon name="upload" size={18} />{t('settings.import')}</button>
      </div>
    </div>
  </section>

  {#if showInstall}
    <section class="section">
      <h2 class="section-title">{t('settings.install')}</h2>
      <div class="panel box">
        {#if install.prompt}
          <p class="muted small">{t('install.steps')}</p>
          <button class="btn btn-primary" type="button" onclick={promptInstall}>{t('install.button')}</button>
        {:else}
          <p><strong>{t('install.iosTitle')}</strong></p>
          <p class="muted small">{t('install.iosSteps')}</p>
          <p class="muted small">{t('install.storageWarning')}</p>
        {/if}
      </div>
    </section>
  {/if}

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
    <div class="panel list">
      <div class="box">
        <p>{t('settings.offline')}</p>
        <p class="muted small">{t('settings.version', { v: __APP_VERSION__ })}</p>
      </div>
      <ul class="links">
        <li>
          <button type="button" onclick={openWhatsNew}>
            <Icon name="sparkle" size={18} />
            <span class="grow">{t('whatsNew.title')}</span>
          </button>
        </li>
        {#each links as link (link.href)}
          <li>
            <a href={link.href} target="_blank" rel="noopener">
              <Icon name={link.icon} size={18} />
              <span class="grow">{link.label()}</span>
              <Icon name="external" size={16} />
            </a>
          </li>
        {/each}
      </ul>
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
  /* Ends where the Add button below does. */
  .preset {
    padding-right: 4px;
  }
  .grow {
    flex: 1;
    min-width: 0;
    color: var(--text);
  }
  .danger {
    color: var(--danger);
  }
  .lead {
    margin: 0 4px;
  }
  .rate-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }
  .rate-head .sub-title {
    display: block;
  }
  .rate-value {
    margin: 16px 4px 8px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .rate {
    padding: 12px 16px 10px;
  }
  .rate input {
    display: block;
    width: 100%;
    height: 32px;
    margin: 0;
    accent-color: var(--selected);
    cursor: pointer;
  }
  .rate-ends {
    display: flex;
    justify-content: space-between;
  }
  .sub-title {
    margin: 16px 4px 8px;
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--muted);
  }
  .hint {
    margin: 10px 4px 0;
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
  .nudge {
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--danger) 12%, transparent);
    color: var(--text);
  }
  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .links {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .links a,
  .links button {
    display: flex;
    width: 100%;
    align-items: center;
    gap: 10px;
    min-height: 52px;
    padding: 4px 16px;
    border-top: 1px solid var(--border);
    border-width: 1px 0 0;
    background: none;
    color: var(--muted);
    font: inherit;
    text-align: left;
    text-decoration: none;
  }
  .links a:active,
  .links button:active {
    background: var(--surface-2);
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
