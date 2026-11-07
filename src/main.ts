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

installErrorHandlers();
document.documentElement.lang = i18n.lang;
applyTheme();

// Ask the browser not to evict our IndexedDB data under storage pressure.
navigator.storage?.persisted?.().then((ok) => {
  if (!ok) navigator.storage.persist?.();
});

// Items deleted over TRASH_DAYS ago leave "Recently deleted".
void purgeTrash();

export default mount(App, { target: document.getElementById('app')! });
