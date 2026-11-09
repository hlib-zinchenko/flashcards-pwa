import { mount } from 'svelte';
import '@fontsource-variable/onest/wght.css';
import './fonts.css';
import '@fontsource/biz-udpgothic/japanese-700.css';
import './app.css';
import App from './App.svelte';
import { installErrorHandlers } from './lib/errors.svelte';
import { i18n } from './lib/i18n/index.svelte';
import { applyTheme } from './lib/theme.svelte';
import { purgeTrash } from './lib/repo/trash';
import { sendDailyCount } from './lib/usage.svelte';

installErrorHandlers();
document.documentElement.lang = i18n.lang;
applyTheme();

// Ask the browser not to evict our IndexedDB data under storage pressure.
navigator.storage?.persisted?.().then((ok) => {
  if (!ok) navigator.storage.persist?.();
});

// Items deleted over TRASH_DAYS ago leave "Recently deleted".
void purgeTrash();

const app = mount(App, { target: document.getElementById('app')! });

// The daily usage count (src/lib/usage.ts), after the first screen is up. An app left open
// overnight counts again when it's next brought back.
setTimeout(() => void sendDailyCount(), 3000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void sendDailyCount();
});

export default app;
