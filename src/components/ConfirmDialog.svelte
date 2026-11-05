<script lang="ts">
  import { confirmState, settleConfirm } from '../lib/confirm.svelte';
  import { t } from '../lib/i18n/index.svelte';
  import Modal from './Modal.svelte';

  let open = $state(false);
  // Keep the last request's text while the dialog closes.
  let shown = $state({ title: '', message: '', confirmLabel: '' });

  $effect(() => {
    const request = confirmState.request;
    if (request) shown = { title: request.title, message: request.message ?? '', confirmLabel: request.confirmLabel };
    open = !!request;
  });
</script>

<Modal bind:open title={shown.title} onclose={() => settleConfirm(false)}>
  {#if shown.message}<p class="message">{shown.message}</p>{/if}
  {#snippet footer()}
    <button class="btn" type="button" onclick={() => settleConfirm(false)}>{t('common.cancel')}</button>
    <button class="btn btn-destructive" type="button" onclick={() => settleConfirm(true)}>{shown.confirmLabel}</button>
  {/snippet}
</Modal>

<style>
  .message {
    margin: 0;
  }
</style>
