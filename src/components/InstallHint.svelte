<script lang="ts">
  import { t } from '../lib/i18n/index.svelte';
  import { dismissInstallHint, install, isIos, promptInstall } from '../lib/install.svelte';
  import Icon from './Icon.svelte';

  const visible = $derived(!install.standalone && !install.hintDismissed && (isIos || install.prompt !== null));
</script>

{#if visible}
  <aside class="hint panel">
    <div class="text">
      {#if isIos}
        <strong>{t('install.iosTitle')}</strong>
        <p>
          <span class="share"><Icon name="share" size={16} /></span>
          {t('install.iosSteps')}
        </p>
        <p class="warn">{t('install.storageWarning')}</p>
      {:else}
        <strong>{t('install.title')}</strong>
        <p>{t('install.steps')}</p>
        <button class="btn btn-primary" type="button" onclick={promptInstall}>{t('install.button')}</button>
      {/if}
    </div>
    <button class="icon-btn" type="button" onclick={dismissInstallHint} aria-label={t('install.dismiss')}>
      <Icon name="close" size={18} />
    </button>
  </aside>
{/if}

<style>
  .hint {
    display: flex;
    gap: 4px;
    margin-top: 12px;
    padding: 14px 6px 14px 16px;
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .text {
    flex: 1;
  }
  p {
    margin: 4px 0 0;
    font-size: 0.92rem;
  }
  .share {
    vertical-align: -3px;
    color: var(--accent);
  }
  .warn {
    color: var(--muted);
    font-size: 0.85rem;
  }
  .btn {
    margin-top: 10px;
  }
</style>
