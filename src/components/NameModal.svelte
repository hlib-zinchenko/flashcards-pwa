<script lang="ts">
  import { t } from '../lib/i18n/index.svelte';
  import Modal from './Modal.svelte';

  let {
    open = $bindable(false),
    title,
    label,
    value = '',
    placeholder = '',
    submitLabel,
    error = '',
    onsubmit,
  }: {
    open?: boolean;
    title: string;
    label: string;
    value?: string;
    placeholder?: string;
    submitLabel: string;
    error?: string;
    onsubmit: (name: string) => void | Promise<void>;
  } = $props();

  let name = $state('');
  let input: HTMLInputElement | undefined = $state();

  $effect(() => {
    if (open) {
      name = value;
      queueMicrotask(() => input?.focus());
    }
  });

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await onsubmit(name.trim());
  }
</script>

<Modal bind:open {title}>
  <form onsubmit={submit} id="name-form">
    <label class="field">
      <span>{label}</span>
      <input class="input" bind:this={input} bind:value={name} {placeholder} maxlength="120" enterkeyhint="done" />
    </label>
    {#if error}<p class="error small">{error}</p>{/if}
  </form>
  {#snippet footer()}
    <button class="btn" type="button" onclick={() => (open = false)}>{t('common.cancel')}</button>
    <button class="btn btn-primary" type="submit" form="name-form" disabled={!name.trim()}>{submitLabel}</button>
  {/snippet}
</Modal>

<style>
  .error {
    margin: 0;
    color: var(--danger);
  }
</style>
