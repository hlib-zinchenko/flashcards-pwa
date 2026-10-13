<script lang="ts">
  import { useRegisterSW } from 'virtual:pwa-register/svelte';
  import { t } from '../lib/i18n/index.svelte';
  import { showToast } from '../lib/toast.svelte';

  const HOUR = 60 * 60 * 1000;

  const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => registration.update(), HOUR);
    },
  });

  $effect(() => {
    if ($offlineReady) {
      showToast(t('update.offlineReady'));
      offlineReady.set(false);
    }
  });
</script>

{#if $needRefresh}
  <div class="update panel" role="alert">
    <span>{t('update.available')}</span>
    <button class="btn btn-primary" type="button" onclick={() => updateServiceWorker(true)}>{t('update.reload')}</button>
  </div>
{/if}

<style>
  .update {
    position: fixed;
    left: 50%;
    top: calc(var(--safe-top) + 10px);
    z-index: 90;
    display: flex;
    align-items: center;
    gap: 12px;
    width: max-content;
    max-width: calc(100% - 24px);
    padding: 8px 8px 8px 16px;
    font-weight: 600;
    transform: translateX(-50%);
    box-shadow: var(--shadow-lg);
  }
</style>
