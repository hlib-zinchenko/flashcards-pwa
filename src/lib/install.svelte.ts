import { loadPref, savePref } from './prefs';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const isIos =
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const standalone =
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const install = $state({
  standalone,
  prompt: null as BeforeInstallPromptEvent | null,
  hintDismissed: loadPref('installHintDismissed', false),
});

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  install.prompt = e as BeforeInstallPromptEvent;
});

window.addEventListener('appinstalled', () => {
  install.prompt = null;
});

export async function promptInstall(): Promise<void> {
  const p = install.prompt;
  if (!p) return;
  await p.prompt();
  await p.userChoice;
  install.prompt = null;
}

export function dismissInstallHint(): void {
  install.hintDismissed = true;
  savePref('installHintDismissed', true);
}
