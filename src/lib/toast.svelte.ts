export interface ToastAction {
  label: string;
  run: () => void;
}

export const toast = $state({ message: '', id: 0, action: null as ToastAction | null });

let timer: ReturnType<typeof setTimeout> | undefined;

/** Show a short message, optionally with one button (for example Undo). */
export function showToast(message: string, ms = 2200, action: ToastAction | null = null): void {
  toast.message = message;
  toast.action = action;
  toast.id++;
  clearTimeout(timer);
  timer = setTimeout(hideToast, ms);
}

export function hideToast(): void {
  clearTimeout(timer);
  toast.message = '';
  toast.action = null;
}
