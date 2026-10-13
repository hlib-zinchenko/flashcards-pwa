<script lang="ts">
  import TabBar from './components/TabBar.svelte';
  import Toast from './components/Toast.svelte';
  import UpdatePrompt from './components/UpdatePrompt.svelte';
  import { router } from './lib/router.svelte';
  import Deck from './routes/Deck.svelte';
  import Decks from './routes/Decks.svelte';
  import Settings from './routes/Settings.svelte';
  import TestRun from './routes/TestRun.svelte';
  import TestSetup from './routes/TestSetup.svelte';

  const route = $derived(router.route);
</script>

{#if route.name === 'decks'}
  <Decks />
{:else if route.name === 'deck'}
  {#key route.id}<Deck id={route.id} />{/key}
{:else if route.name === 'test'}
  <TestSetup />
{:else if route.name === 'run'}
  <TestRun />
{:else if route.name === 'settings'}
  <Settings />
{/if}

{#if route.name !== 'run'}
  <TabBar />
{/if}
<Toast />
<UpdatePrompt />
