/**
 * Browser TTS fallback (from original voice.js)
 */

let isSpeaking = false;
let lastSpeakTime = 0;
const MIN_INTERVAL = 4500;

export function speakFallback(text) {
  const now = Date.now();
  if (isSpeaking || now - lastSpeakTime < MIN_INTERVAL) return;

  isSpeaking = true;
  lastSpeakTime = now;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.05;
  utterance.pitch = 0.95;
  utterance.onend = () => { isSpeaking = false; };
  utterance.onerror = () => { isSpeaking = false; };
  speechSynthesis.speak(utterance);
}

export function cancelFallback() {
  speechSynthesis.cancel();
  isSpeaking = false;
}
