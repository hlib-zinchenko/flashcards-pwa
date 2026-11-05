<script lang="ts">
  import { onDestroy } from 'svelte';
  import { languageOptions } from '../lib/collections';
  import { i18n, languageName, t } from '../lib/i18n/index.svelte';
  import { setCollectionLanguages } from '../lib/repo/collections';
  import { normLang, sampleText, voicesFor } from '../lib/speech';
  import { deviceVoices, speak, speechSupported, stopSpeaking } from '../lib/speech.svelte';
  import type { Collection, CollectionLanguage } from '../lib/types';
  import Icon from './Icon.svelte';

  /** Reading-aloud languages of a collection, each with a voice; changes are saved right away. */
  let { collection }: { collection: Collection } = $props();

  const regionOf = (lang: string) => lang.replace('_', '-').split('-')[1]?.toUpperCase() ?? '';

  function voiceLabel(voice: SpeechSynthesisVoice, withRegion: boolean): string {
    const region = regionOf(voice.lang);
    if (!withRegion || !region) return voice.name;
    return `${voice.name} · ${new Intl.DisplayNames([i18n.lang], { type: 'region' }).of(region) ?? region}`;
  }

  const rows = $derived(
    collection.languages.map((l) => {
      const voices = voicesFor(deviceVoices(), l.lang);
      return {
        lang: l.lang,
        voices,
        // Region only matters when the list mixes them (English: US, UK, Australia…).
        withRegion: new Set(voices.map((v) => regionOf(v.lang))).size > 1,
        value: l.voiceURI && voices.some((v) => v.voiceURI === l.voiceURI) ? l.voiceURI : '',
      };
    }),
  );

  /** Languages this device can read that the collection doesn't have yet, by name. */
  const addable = $derived.by(() => {
    const have = new Set(collection.languages.map((l) => normLang(l.lang)));
    return languageOptions(deviceVoices())
      .filter((lang) => !have.has(normLang(lang)))
      .map((lang) => ({ lang, name: languageName(lang) }))
      .sort((a, b) => a.name.localeCompare(b.name, i18n.lang));
  });

  function save(languages: CollectionLanguage[]) {
    return setCollectionLanguages(collection.id, languages);
  }

  async function add(lang: string) {
    if (!lang) return;
    await save([...$state.snapshot(collection.languages), { lang }]);
  }

  async function remove(lang: string) {
    if (trying === lang) stop();
    await save($state.snapshot(collection.languages).filter((l) => l.lang !== lang));
  }

  async function chooseVoice(lang: string, voiceURI: string) {
    await save($state.snapshot(collection.languages).map((l) => (l.lang === lang ? { lang, voiceURI: voiceURI || undefined } : l)));
    // Let them hear what they picked.
    trying = null;
    tryVoice(lang, voiceURI);
  }

  /** Language whose sample is playing. */
  let trying = $state<string | null>(null);

  function stop() {
    trying = null;
    stopSpeaking();
  }

  function tryVoice(lang: string, voiceURI?: string) {
    if (trying === lang) {
      stop();
      return;
    }
    trying = lang;
    speak(sampleText(lang), { lang, voiceURI }, () => {
      if (trying === lang) trying = null;
    });
  }

  onDestroy(() => {
    if (trying) stopSpeaking();
  });
</script>

{#if !speechSupported}
  <p class="muted small">{t('collection.speechUnsupported')}</p>
{:else}
  {#if rows.length}
    <div class="panel list">
      {#each rows as row (row.lang)}
        <div class="item">
          <label class="lang" for="voice-{row.lang}">{languageName(row.lang)}</label>
          <div class="controls">
            <select
              id="voice-{row.lang}"
              class="input"
              disabled={row.voices.length === 0}
              value={row.value}
              onchange={(e) => chooseVoice(row.lang, e.currentTarget.value)}
            >
              {#if row.voices.length}
                <option value="">{t('settings.voiceAuto')}</option>
                {#each row.voices as voice (voice.voiceURI)}
                  <option value={voice.voiceURI}>{voiceLabel(voice, row.withRegion)}</option>
                {/each}
              {:else}
                <option value="">{t('settings.voiceNone')}</option>
              {/if}
            </select>
            <button
              class="icon-btn try"
              class:on={trying === row.lang}
              type="button"
              disabled={row.voices.length === 0}
              aria-pressed={trying === row.lang}
              aria-label={t('settings.voiceTry', { lang: languageName(row.lang) })}
              title={t('settings.voiceTry', { lang: languageName(row.lang) })}
              onclick={() => tryVoice(row.lang, row.value)}
            >
              <Icon name="volume" size={20} />
            </button>
            <button
              class="icon-btn"
              type="button"
              aria-label={t('collection.removeLanguage', { lang: languageName(row.lang) })}
              title={t('collection.removeLanguage', { lang: languageName(row.lang) })}
              onclick={() => remove(row.lang)}
            >
              <Icon name="close" size={18} />
            </button>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <p class="muted small">{t('collection.noLanguages')}</p>
  {/if}

  {#if addable.length}
    <label class="add">
      <span class="visually-hidden">{t('collection.addLanguage')}</span>
      <select class="input" value="" onchange={(e) => { add(e.currentTarget.value); e.currentTarget.value = ''; }}>
        <option value="" disabled>＋ {t('collection.addLanguage')}</option>
        {#each addable as option (option.lang)}
          <option value={option.lang}>{option.name}</option>
        {/each}
      </select>
    </label>
  {:else if deviceVoices().length === 0}
    <p class="muted small">{t('settings.voiceNone')}</p>
  {/if}
  <p class="muted small hint">{t('settings.voiceHint')}</p>
{/if}

<style>
  .list {
    overflow: hidden;
  }
  .item {
    display: grid;
    gap: 6px;
    padding: 10px 8px 10px 14px;
    border-bottom: 1px solid var(--border);
  }
  .item:last-child {
    border-bottom: 0;
  }
  .lang {
    font-weight: 600;
  }
  .controls {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .controls select {
    flex: 1;
    min-width: 0;
  }
  .try.on {
    background: var(--primary);
    color: var(--on-primary);
  }
  .try:disabled {
    opacity: 0.4;
  }
  .add {
    display: block;
    margin-top: 10px;
  }
  .hint {
    margin: 10px 2px 0;
  }
</style>
