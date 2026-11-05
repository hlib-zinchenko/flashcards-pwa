/** Reading card text aloud with the device's built-in voices (Web Speech API, works offline). */
import { loadPref, savePref } from './prefs';
import { clampRate, normalizeSpeechPrefs, pickVoice } from './speech';
import type { CollectionLanguage } from './types';

export const speechSupported =
  typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

/** Device-wide reading speed from Settings; remembered across launches. */
export const speechPrefs = $state(normalizeSpeechPrefs(loadPref('speech', {})));

function savePrefs(): void {
  savePref('speech', $state.snapshot(speechPrefs));
}

export function setRate(rate: number): void {
  speechPrefs.rate = clampRate(rate);
  savePrefs();
}

// raw: native SpeechSynthesisVoice objects, replaced as a whole when the list changes.
let voiceList = $state.raw<SpeechSynthesisVoice[]>([]);

/** Voices installed on this device. Reactive: browsers load the list lazily and it can change. */
export function deviceVoices(): SpeechSynthesisVoice[] {
  return voiceList;
}

if (speechSupported) {
  const refresh = () => (voiceList = window.speechSynthesis.getVoices());
  refresh();
  window.speechSynthesis.addEventListener?.('voiceschanged', refresh);
}

/**
 * Read `text` aloud in `voice.lang`, with `voice.voiceURI` if this device has it (else the best fit),
 * stopping anything already playing. `onend` runs once, when this text finishes or is interrupted.
 */
export function speak(text: string, voice: CollectionLanguage, onend?: () => void): void {
  if (!speechSupported || !text.trim()) {
    onend?.();
    return;
  }
  const synth = window.speechSynthesis;
  if (synth.speaking || synth.pending) synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = voice.lang;
  utterance.rate = speechPrefs.rate;
  const native = pickVoice(synth.getVoices(), voice.lang, voice.voiceURI);
  if (native) utterance.voice = native;
  let ended = false;
  const done = () => {
    if (ended) return;
    ended = true;
    onend?.();
  };
  utterance.onend = done;
  utterance.onerror = done;
  synth.speak(utterance);
}

export function stopSpeaking(): void {
  if (speechSupported) window.speechSynthesis.cancel();
}
