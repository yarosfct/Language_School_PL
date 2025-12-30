// Text-to-Speech service using Web Speech API

// TTS configuration state
let currentVoice: SpeechSynthesisVoice | null = null;
let currentRate = 1.0;
let currentPitch = 1.0;
let currentVolume = 1.0;

// Polish language code
const POLISH_LANG = 'pl-PL';

/**
 * Check if TTS is supported in the current browser
 */
export function isTTSSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Get all available voices
 */
export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (!isTTSSupported()) return [];
  return window.speechSynthesis.getVoices();
}

/**
 * Get Polish voices only
 */
export function getPolishVoices(): SpeechSynthesisVoice[] {
  return getAvailableVoices().filter(
    voice => voice.lang.startsWith('pl')
  );
}

/**
 * Get the best available Polish voice
 */
export function getBestPolishVoice(): SpeechSynthesisVoice | null {
  const polishVoices = getPolishVoices();
  
  if (polishVoices.length === 0) {
    return null;
  }
  
  // Prefer local voices over remote
  const localVoice = polishVoices.find(v => v.localService);
  if (localVoice) return localVoice;
  
  // Otherwise return first Polish voice
  return polishVoices[0];
}

/**
 * Set the voice to use for TTS
 */
export function setVoice(voiceURI: string): boolean {
  const voices = getAvailableVoices();
  const voice = voices.find(v => v.voiceURI === voiceURI);
  
  if (voice) {
    currentVoice = voice;
    return true;
  }
  return false;
}

/**
 * Set the speaking rate (0.5 - 2.0)
 */
export function setRate(rate: number): void {
  currentRate = Math.max(0.5, Math.min(2.0, rate));
}

/**
 * Get the current speaking rate
 */
export function getRate(): number {
  return currentRate;
}

/**
 * Set the pitch (0.5 - 2.0)
 */
export function setPitch(pitch: number): void {
  currentPitch = Math.max(0.5, Math.min(2.0, pitch));
}

/**
 * Get the current pitch
 */
export function getPitch(): number {
  return currentPitch;
}

/**
 * Set the volume (0 - 1)
 */
export function setVolume(volume: number): void {
  currentVolume = Math.max(0, Math.min(1, volume));
}

/**
 * Get the current volume
 */
export function getVolume(): number {
  return currentVolume;
}

/**
 * Speak the given text
 */
export function speak(
  text: string, 
  options?: {
    lang?: string;
    rate?: number;
    pitch?: number;
    volume?: number;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (error: SpeechSynthesisErrorEvent) => void;
  }
): SpeechSynthesisUtterance | null {
  if (!isTTSSupported()) {
    console.warn('TTS is not supported in this browser');
    return null;
  }
  
  // Cancel any ongoing speech
  window.speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  
  // Set language
  utterance.lang = options?.lang ?? POLISH_LANG;
  
  // Set voice (try to find Polish voice if not set)
  if (currentVoice) {
    utterance.voice = currentVoice;
  } else {
    const polishVoice = getBestPolishVoice();
    if (polishVoice) {
      utterance.voice = polishVoice;
      currentVoice = polishVoice;
    }
  }
  
  // Set rate, pitch, and volume
  utterance.rate = options?.rate ?? currentRate;
  utterance.pitch = options?.pitch ?? currentPitch;
  utterance.volume = options?.volume ?? currentVolume;
  
  // Set event handlers
  if (options?.onStart) {
    utterance.onstart = options.onStart;
  }
  if (options?.onEnd) {
    utterance.onend = options.onEnd;
  }
  if (options?.onError) {
    utterance.onerror = options.onError;
  }
  
  // Speak!
  window.speechSynthesis.speak(utterance);
  
  return utterance;
}

/**
 * Speak Polish text with default settings
 */
export function speakPolish(
  text: string,
  onEnd?: () => void
): SpeechSynthesisUtterance | null {
  return speak(text, {
    lang: POLISH_LANG,
    onEnd,
  });
}

/**
 * Speak slowly (for learning)
 */
export function speakSlow(
  text: string,
  onEnd?: () => void
): SpeechSynthesisUtterance | null {
  return speak(text, {
    lang: POLISH_LANG,
    rate: 0.7,
    onEnd,
  });
}

/**
 * Stop any ongoing speech
 */
export function stopSpeaking(): void {
  if (isTTSSupported()) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Pause speech
 */
export function pauseSpeaking(): void {
  if (isTTSSupported()) {
    window.speechSynthesis.pause();
  }
}

/**
 * Resume speech
 */
export function resumeSpeaking(): void {
  if (isTTSSupported()) {
    window.speechSynthesis.resume();
  }
}

/**
 * Check if currently speaking
 */
export function isSpeaking(): boolean {
  if (!isTTSSupported()) return false;
  return window.speechSynthesis.speaking;
}

/**
 * Check if speech is paused
 */
export function isPaused(): boolean {
  if (!isTTSSupported()) return false;
  return window.speechSynthesis.paused;
}

/**
 * Initialize TTS (call on app load to populate voices)
 * Some browsers load voices asynchronously
 */
export function initializeTTS(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!isTTSSupported()) {
      resolve([]);
      return;
    }
    
    const voices = getAvailableVoices();
    
    if (voices.length > 0) {
      resolve(voices);
      return;
    }
    
    // Some browsers load voices asynchronously
    window.speechSynthesis.onvoiceschanged = () => {
      const loadedVoices = getAvailableVoices();
      resolve(loadedVoices);
    };
    
    // Timeout fallback
    setTimeout(() => {
      resolve(getAvailableVoices());
    }, 1000);
  });
}

/**
 * Apply saved preferences
 */
export function applyTTSPreferences(prefs: {
  voiceURI?: string;
  rate?: number;
  pitch?: number;
}): void {
  if (prefs.voiceURI) {
    setVoice(prefs.voiceURI);
  }
  if (prefs.rate !== undefined) {
    setRate(prefs.rate);
  }
  if (prefs.pitch !== undefined) {
    setPitch(prefs.pitch);
  }
}

/**
 * Get current TTS settings
 */
export function getTTSSettings(): {
  voiceURI: string | null;
  rate: number;
  pitch: number;
  volume: number;
  hasPolishVoice: boolean;
} {
  return {
    voiceURI: currentVoice?.voiceURI ?? null,
    rate: currentRate,
    pitch: currentPitch,
    volume: currentVolume,
    hasPolishVoice: getPolishVoices().length > 0,
  };
}

// Export a React hook-friendly version
export const tts = {
  speak,
  speakPolish,
  speakSlow,
  stop: stopSpeaking,
  pause: pauseSpeaking,
  resume: resumeSpeaking,
  isSpeaking,
  isPaused,
  isSupported: isTTSSupported,
  getVoices: getAvailableVoices,
  getPolishVoices,
  setVoice,
  setRate,
  getRate,
  setPitch,
  getPitch,
  setVolume,
  getVolume,
  initialize: initializeTTS,
  applyPreferences: applyTTSPreferences,
  getSettings: getTTSSettings,
};
