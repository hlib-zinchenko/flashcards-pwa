import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { i18n } from './lib/i18n/index.svelte';

document.documentElement.lang = i18n.lang;

// Ask the browser not to evict our IndexedDB data under storage pressure.
navigator.storage?.persisted?.().then((ok) => {
  if (!ok) navigator.storage.persist?.();
});

export default mount(App, { target: document.getElementById('app')! });
