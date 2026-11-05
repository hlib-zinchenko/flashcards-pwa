export interface ConfirmOptions {
  title: string;
  message?: string;
  /** Label of the red confirm button. */
  confirmLabel: string;
}

interface ConfirmRequest extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

/** The open request, shown by <ConfirmDialog> in App.svelte. */
export const confirmState = $state({ request: null as ConfirmRequest | null });

/** Ask before a destructive action, in the app's own dialog instead of window.confirm(). */
export function askConfirm(options: ConfirmOptions): Promise<boolean> {
  settleConfirm(false);
  return new Promise((resolve) => (confirmState.request = { ...options, resolve }));
}

export function settleConfirm(ok: boolean): void {
  const request = confirmState.request;
  if (!request) return;
  confirmState.request = null;
  request.resolve(ok);
}
