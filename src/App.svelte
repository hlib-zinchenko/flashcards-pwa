<script lang="ts">
  import ConfirmDialog from './components/ConfirmDialog.svelte';
  import TabBar from './components/TabBar.svelte';
  import Toast from './components/Toast.svelte';
  import UpdatePrompt from './components/UpdatePrompt.svelte';
  import WhatsNew from './components/WhatsNew.svelte';
  import { router } from './lib/router.svelte';
  import Collection from './routes/Collection.svelte';
  import Deck from './routes/Deck.svelte';
  import ImportLegacy from './routes/ImportLegacy.svelte';
  import MovedNotice from './components/MovedNotice.svelte';
  import { IS_LEGACY } from './lib/transfer';
  import Decks from './routes/Decks.svelte';
  import Settings from './routes/Settings.svelte';
  import TestRun from './routes/TestRun.svelte';
  import TestSetup from './routes/TestSetup.svelte';

  const route = $derived(router.route);
</script>

{#if route.name === 'decks'}
  <Decks />
{:else if route.name === 'collection'}
  {#key route.id}<Collection id={route.id} />{/key}
{:else if route.name === 'deck'}
  {#key route.id}<Deck id={route.id} />{/key}
{:else if route.name === 'test'}
  <TestSetup />
{:else if route.name === 'run'}
  <TestRun />
{:else if route.name === 'settings'}
  <Settings />
{:else if route.name === 'importLegacy'}
  <ImportLegacy />
{/if}

{#if route.name !== 'run' && route.name !== 'importLegacy'}
  <TabBar />
{/if}
<Toast />
<ConfirmDialog />
<UpdatePrompt />
{#if route.name === 'importLegacy'}{:else if IS_LEGACY}<MovedNotice />{:else}<WhatsNew />{/if}
