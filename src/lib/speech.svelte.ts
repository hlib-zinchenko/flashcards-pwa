/** Reading card text aloud with the device's built-in voices (Web Speech API, works offline). */
import { loadPref, savePref } from './prefs';
import { detectLang, normalizeSpeechPrefs, pickVoice, SPEECH_RATES, type SpeechLang, type SpeechRate } from './speech';

export const speechSupported =
  typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

/** Voice choices from Settings; remembered across launches. */
export const speechPrefs = $state(normalizeSpeechPrefs(loadPref('speech', {})));

function savePrefs(): void {
  savePref('speech', $state.snapshot(speechPrefs));
}

/** null = pick automatically. */
export function setVoice(lang: SpeechLang, voiceURI: string | null): void {
  if (voiceURI) speechPrefs.voices[lang] = voiceURI;
  else delete speechPrefs.voices[lang];
  savePrefs();
}

export function setRate(rate: SpeechRate): void {
  speechPrefs.rate = rate;
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
 * Read `text` aloud, stopping anything already playing. `onend` runs once,
 * when this text finishes or is interrupted. The language is guessed from the text unless given.
 */
export function speak(text: string, onend?: () => void, lang: SpeechLang = detectLang(text)): void {
  if (!speechSupported || !text.trim()) {
    onend?.();
    return;
  }
  const synth = window.speechSynthesis;
  if (synth.speaking || synth.pending) synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = SPEECH_RATES[speechPrefs.rate];
  const voice = pickVoice(synth.getVoices(), lang, speechPrefs.voices[lang]);
  if (voice) utterance.voice = voice;
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
