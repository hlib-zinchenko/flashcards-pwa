<script lang="ts">
  import { backupDue } from '../lib/backup';
  import { backupStatus } from '../lib/backup.svelte';
  import { t } from '../lib/i18n/index.svelte';
  import { decksHome } from '../lib/collections';
  import { lastCollection, router, href } from '../lib/router.svelte';
  import Icon, { type IconName } from './Icon.svelte';

  const tabs: { path: () => string; name: 'decks' | 'test' | 'settings'; icon: IconName; label: () => string }[] = [
    { path: () => decksHome(lastCollection.id), name: 'decks', icon: 'decks', label: () => t('nav.decks') },
    { path: () => '/test', name: 'test', icon: 'play', label: () => t('nav.test') },
    { path: () => '/settings', name: 'settings', icon: 'settings', label: () => t('nav.settings') },
  ];

  /** Dot on the Settings tab when a backup is overdue; Settings explains it. */
  const nudge = $derived(backupDue(backupStatus));
  const active = $derived(router.route.name === 'deck' || router.route.name === 'collection' ? 'decks' : router.route.name);
</script>

<!-- Floating card-stock pill. Icons only, in equal fixed slots, so nothing moves when the tab changes;
     each screen's heading says where you are. -->
<nav class="tabbar">
  <div class="pill">
    {#each tabs as tab (tab.name)}
      {@const on = active === tab.name}
      <a
        href={href(tab.path())}
        class:active={on}
        aria-current={on ? 'page' : undefined}
        aria-label={tab.label()}
        title={tab.label()}
      >
        <span class="icon">
          <Icon name={tab.icon} size={22} />
          {#if tab.name === 'settings' && nudge}<span class="dot" title={t('nav.backupDue')}></span>{/if}
        </span>
        {#if tab.name === 'settings' && nudge}<span class="visually-hidden">{t('nav.backupDue')}</span>{/if}
      </a>
    {/each}
  </div>
</nav>

<style>
  .tabbar {
    position: fixed;
    inset: auto 0 0;
    z-index: 20;
    display: flex;
    justify-content: center;
    padding: 0 16px calc(var(--safe-bottom) + 14px);
    pointer-events: none;
  }
  .pill {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    width: 100%;
    max-width: 420px;
    padding: 6px;
    border-radius: 999px;
    background: var(--nav);
    box-shadow: 0 var(--edge) 0 var(--nav-edge), 0 14px 30px -16px rgb(20 12 36 / 0.45);
    pointer-events: auto;
  }
  a {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    height: 44px;
    border-radius: 999px;
    color: var(--on-nav);
    text-decoration: none;
  }
  a.active {
    background: var(--pill);
    color: var(--on-pill);
  }
  .icon {
    position: relative;
    display: grid;
  }
  .dot {
    position: absolute;
    top: -3px;
    right: -5px;
    width: 10px;
    height: 10px;
    border: 2px solid var(--nav);
    border-radius: 50%;
    background: var(--danger);
  }
</style>
