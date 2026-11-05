<script lang="ts">
  import { useRegisterSW } from 'virtual:pwa-register/svelte';
  import { t } from '../lib/i18n/index.svelte';
  import { showToast } from '../lib/toast.svelte';

  const HOUR = 60 * 60 * 1000;
  const MINUTE = 60 * 1000;

  const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      let lastCheck = Date.now();
      const check = () => {
        if (!navigator.onLine || registration.installing) return;
        lastCheck = Date.now();
        registration.update().catch(() => {});
      };
      setInterval(check, HOUR);
      // An installed app is usually resumed from the background rather than reloaded, and iOS pauses
      // timers there, so also check whenever the app comes back on screen (at most once a minute).
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && Date.now() - lastCheck > MINUTE) check();
      });
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
