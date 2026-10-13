export const toast = $state({ message: '', id: 0 });

let timer: ReturnType<typeof setTimeout> | undefined;

export function showToast(message: string, ms = 2200): void {
  toast.message = message;
  toast.id++;
  clearTimeout(timer);
  timer = setTimeout(() => (toast.message = ''), ms);
}
