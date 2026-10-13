<script lang="ts">
  import { t } from '../lib/i18n/index.svelte';
  import { router, href } from '../lib/router.svelte';
  import Icon, { type IconName } from './Icon.svelte';

  const tabs: { path: string; name: 'decks' | 'test' | 'settings'; icon: IconName; label: () => string }[] = [
    { path: '/', name: 'decks', icon: 'decks', label: () => t('nav.decks') },
    { path: '/test', name: 'test', icon: 'play', label: () => t('nav.test') },
    { path: '/settings', name: 'settings', icon: 'settings', label: () => t('nav.settings') },
  ];

  const active = $derived(router.route.name === 'deck' ? 'decks' : router.route.name);
</script>

<nav class="tabbar">
  {#each tabs as tab (tab.name)}
    <a href={href(tab.path)} class:active={active === tab.name} aria-current={active === tab.name ? 'page' : undefined}>
      <Icon name={tab.icon} size={22} />
      <span>{tab.label()}</span>
    </a>
  {/each}
</nav>

<style>
  .tabbar {
    position: fixed;
    inset: auto 0 0;
    z-index: 20;
    display: flex;
    justify-content: center;
    padding-bottom: var(--safe-bottom);
    border-top: 1px solid var(--border);
    background: color-mix(in srgb, var(--surface) 90%, transparent);
    backdrop-filter: saturate(1.6) blur(14px);
    -webkit-backdrop-filter: saturate(1.6) blur(14px);
  }
  a {
    display: flex;
    flex: 1;
    max-width: 200px;
    height: var(--tabbar-h);
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    color: var(--muted);
    font-size: 0.72rem;
    font-weight: 600;
    text-decoration: none;
  }
  a.active {
    color: var(--accent);
  }
</style>
