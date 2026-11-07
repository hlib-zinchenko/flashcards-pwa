<script lang="ts">
  import { t } from '../lib/i18n/index.svelte';
  import { savedRemaining } from '../lib/savedRun';
  import { clearSavedRun, resumeRun, savedRun } from '../lib/testState.svelte';
  import Icon from './Icon.svelte';

  const remaining = $derived(savedRun.run ? savedRemaining(savedRun.run) : 0);
</script>

{#if savedRun.run && remaining > 0}
  <aside class="resume panel" aria-label={t('resume.title')}>
    <div class="text">
      <strong>{t('resume.title')}</strong>
      <p>{t('resume.left', { n: remaining })}</p>
    </div>
    <button class="btn btn-mint" type="button" onclick={resumeRun}>
      <Icon name="play" size={16} />{t('resume.button')}
    </button>
    <button class="icon-btn" type="button" onclick={clearSavedRun} aria-label={t('resume.discard')} title={t('resume.discard')}>
      <Icon name="close" size={18} />
    </button>
  </aside>
{/if}

<style>
  .resume {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    padding: 12px 6px 12px 16px;
  }
  .text {
    flex: 1;
    min-width: 0;
  }
  .text p {
    margin: 2px 0 0;
    color: var(--muted);
    font-size: 0.9rem;
  }
  .btn {
    flex: none;
  }
</style>
