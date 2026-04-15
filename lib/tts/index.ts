// Text-to-Speech service with Azure Speech backend and Web Speech fallback

// Backend state
let useAzureBackend = false;
let azureHealthChecked = false;
let audioContext: AudioContext | null = null;

// TTS configuration state (for Web Speech API)
let currentVoice: SpeechSynthesisVoice | null = null;
let currentRate = 1.0;
let currentPitch = 1.0;
let currentVolume = 1.0;

// Azure Speech configuration state
let currentAzureVoice: string | null = null;

interface SpeakOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  voice?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: unknown) => void;
}

interface AzurePlaybackState {
  requestId: symbol | null;
  cacheKey: string | null;
  text: string | null;
  audioBuffer: AudioBuffer | null;
  sourceNode: AudioBufferSourceNode | null;
  gainNode: GainNode | null;
  startedAtTime: number;
  pausedOffset: number;
  isPaused: boolean;
  callbacks: Pick<SpeakOptions, 'onStart' | 'onEnd' | 'onError'>;
}

type ExtendedWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

// Client-side audio cache: Map<hash, decoded AudioBuffer>
const decodedAudioCache = new Map<string, AudioBuffer>();
const pendingDecodedAudio = new Map<string, Promise<{ cacheKey: string; audioBuffer: AudioBuffer }>>();
const requestHashCache = new Map<string, string>();
const MAX_CACHE_SIZE = 50;

// Track active audio request to ignore errors from superseded requests
let activeAudioRequestId: symbol | null = null;
let activeWebSpeechRequestId: symbol | null = null;

// Polish language code
const POLISH_LANG = 'pl-PL';
const WEB_SPEECH_START_DELAY_MS = 120;
const WEB_SPEECH_RETRY_DELAY_MS = 250;

const currentAzurePlayback: AzurePlaybackState = {
  requestId: null,
  cacheKey: null,
  text: null,
  audioBuffer: null,
  sourceNode: null,
  gainNode: null,
  startedAtTime: 0,
  pausedOffset: 0,
  isPaused: false,
  callbacks: {},
};

function isWebAudioSupported(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const extendedWindow = window as ExtendedWindow;
  return typeof window.AudioContext !== 'undefined' || typeof extendedWindow.webkitAudioContext !== 'undefined';
}

function getAudioContext(): AudioContext {
  if (typeof window === 'undefined') {
    throw new Error('Web Audio API is not available on the server');
  }

  if (audioContext && audioContext.state !== 'closed') {
    return audioContext;
  }

  const extendedWindow = window as ExtendedWindow;
  const AudioContextConstructor = window.AudioContext ?? extendedWindow.webkitAudioContext;

  if (!AudioContextConstructor) {
    throw new Error('Web Audio API is not supported in this browser');
  }

  audioContext = new AudioContextConstructor();
  return audioContext;
}

function touchDecodedAudioCache(cacheKey: string, audioBuffer: AudioBuffer): void {
  if (decodedAudioCache.has(cacheKey)) {
    decodedAudioCache.delete(cacheKey);
  } else if (decodedAudioCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = decodedAudioCache.keys().next().value;
    if (oldestKey) {
      decodedAudioCache.delete(oldestKey);
    }
  }

  decodedAudioCache.set(cacheKey, audioBuffer);
}

function getAzureRequestSignature(text: string, options?: Pick<SpeakOptions, 'rate' | 'voice'>): string {
  return JSON.stringify({
    text: text.trim(),
    rate: options?.rate ?? currentRate,
    voice: options?.voice ?? currentAzureVoice ?? 'default',
  });
}

function validateWavAudio(audioData: ArrayBuffer): void {
  if (audioData.byteLength === 0) {
    throw new Error('Empty audio file received from server');
  }

  if (audioData.byteLength < 4) {
    throw new Error('Invalid audio file received from server');
  }

  const headerString = String.fromCharCode(...new Uint8Array(audioData.slice(0, 4)));
  if (headerString !== 'RIFF') {
    throw new Error(`Invalid audio file format (expected RIFF, got ${headerString})`);
  }
}

function disconnectAzureNodes(
  sourceNode: AudioBufferSourceNode | null,
  gainNode: GainNode | null
): void {
  if (sourceNode) {
    try {
      sourceNode.disconnect();
    } catch {
      // Ignore disconnect errors during cleanup.
    }
  }

  if (gainNode) {
    try {
      gainNode.disconnect();
    } catch {
      // Ignore disconnect errors during cleanup.
    }
  }
}

function getCurrentAzurePlaybackOffset(): number {
  if (!currentAzurePlayback.audioBuffer) {
    return 0;
  }

  if (currentAzurePlayback.isPaused || !currentAzurePlayback.sourceNode) {
    return currentAzurePlayback.pausedOffset;
  }

  const context = getAudioContext();
  const elapsed = Math.max(0, context.currentTime - currentAzurePlayback.startedAtTime);
  return Math.min(
    currentAzurePlayback.pausedOffset + elapsed,
    currentAzurePlayback.audioBuffer.duration
  );
}

function stopCurrentAzureSource(resetOffset: boolean): void {
  const { sourceNode, gainNode } = currentAzurePlayback;

  if (sourceNode) {
    sourceNode.onended = null;
    try {
      sourceNode.stop();
    } catch {
      // Ignore stop errors if the source has already ended.
    }
  }

  disconnectAzureNodes(sourceNode, gainNode);
  currentAzurePlayback.sourceNode = null;
  currentAzurePlayback.gainNode = null;
  currentAzurePlayback.startedAtTime = 0;

  if (resetOffset) {
    currentAzurePlayback.pausedOffset = 0;
    currentAzurePlayback.isPaused = false;
  }
}

function resetAzurePlaybackState(): void {
  stopCurrentAzureSource(true);
  currentAzurePlayback.requestId = null;
  currentAzurePlayback.cacheKey = null;
  currentAzurePlayback.text = null;
  currentAzurePlayback.audioBuffer = null;
  currentAzurePlayback.callbacks = {};
}

/**
 * Check Azure backend availability
 */
async function checkAzureHealth(): Promise<boolean> {
  if (azureHealthChecked) return useAzureBackend;
  
  try {
    const response = await fetch('/api/tts/health');
    const data = await response.json();
    useAzureBackend = data.available && data.voiceCount > 0;
    azureHealthChecked = true;
    console.log('🎙️ Azure Speech backend:', useAzureBackend ? 'Available' : 'Unavailable');
    return useAzureBackend;
  } catch {
    console.log('⚠️ Azure backend not available, using Web Speech API');
    useAzureBackend = false;
    azureHealthChecked = true;
    return false;
  }
}

/**
 * Set the Azure voice to use
 */
export function setAzureVoice(voiceName: string | null): void {
  currentAzureVoice = voiceName;
}

/**
 * Get the current Azure voice
 */
export function getAzureVoice(): string | null {
  return currentAzureVoice;
}

async function fetchDecodedAzureAudio(
  text: string,
  options?: Pick<SpeakOptions, 'rate' | 'voice'>
): Promise<{ cacheKey: string; audioBuffer: AudioBuffer }> {
  const requestSignature = getAzureRequestSignature(text, options);
  const cachedHash = requestHashCache.get(requestSignature);

  if (cachedHash) {
    const cachedBuffer = decodedAudioCache.get(cachedHash);
    if (cachedBuffer) {
      touchDecodedAudioCache(cachedHash, cachedBuffer);
      return { cacheKey: cachedHash, audioBuffer: cachedBuffer };
    }
  }

  const pendingRequest = pendingDecodedAudio.get(requestSignature);
  if (pendingRequest) {
    return pendingRequest;
  }

  const requestPromise = (async () => {
    const response = await fetch('/api/tts/speak', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        rate: options?.rate ?? currentRate,
        voice: options?.voice ?? currentAzureVoice ?? undefined,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.details || errorData.error || `TTS API error: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('audio')) {
      throw new Error(`Invalid audio response from server (${contentType || 'missing content-type'})`);
    }

    const cacheKey = response.headers.get('X-Audio-Hash') || requestSignature;
    requestHashCache.set(requestSignature, cacheKey);

    const cachedBuffer = decodedAudioCache.get(cacheKey);
    if (cachedBuffer) {
      void response.body?.cancel();
      touchDecodedAudioCache(cacheKey, cachedBuffer);
      return { cacheKey, audioBuffer: cachedBuffer };
    }

    const audioData = await response.arrayBuffer();
    validateWavAudio(audioData);

    const context = getAudioContext();
    const audioBuffer = await context.decodeAudioData(audioData.slice(0));
    touchDecodedAudioCache(cacheKey, audioBuffer);

    return { cacheKey, audioBuffer };
  })();

  pendingDecodedAudio.set(requestSignature, requestPromise);

  try {
    return await requestPromise;
  } finally {
    pendingDecodedAudio.delete(requestSignature);
  }
}

async function startAzureBufferPlayback(
  text: string,
  cacheKey: string,
  audioBuffer: AudioBuffer,
  requestId: symbol,
  callbacks: Pick<SpeakOptions, 'onStart' | 'onEnd' | 'onError'>,
  startOffset = 0,
  notifyStart = true
): Promise<void> {
  const context = getAudioContext();
  await context.resume();

  if (activeAudioRequestId !== requestId) {
    return;
  }

  const safeOffset = Math.max(0, Math.min(startOffset, Math.max(audioBuffer.duration - 0.001, 0)));

  if (safeOffset >= audioBuffer.duration) {
    activeAudioRequestId = null;
    resetAzurePlaybackState();
    callbacks.onEnd?.();
    return;
  }

  const sourceNode = context.createBufferSource();
  const gainNode = context.createGain();
  gainNode.gain.value = currentVolume;

  sourceNode.buffer = audioBuffer;
  sourceNode.connect(gainNode);
  gainNode.connect(context.destination);

  currentAzurePlayback.requestId = requestId;
  currentAzurePlayback.cacheKey = cacheKey;
  currentAzurePlayback.text = text;
  currentAzurePlayback.audioBuffer = audioBuffer;
  currentAzurePlayback.sourceNode = sourceNode;
  currentAzurePlayback.gainNode = gainNode;
  currentAzurePlayback.startedAtTime = context.currentTime;
  currentAzurePlayback.pausedOffset = safeOffset;
  currentAzurePlayback.isPaused = false;
  currentAzurePlayback.callbacks = callbacks;

  sourceNode.onended = () => {
    disconnectAzureNodes(sourceNode, gainNode);

    if (currentAzurePlayback.sourceNode !== sourceNode || currentAzurePlayback.requestId !== requestId) {
      return;
    }

    currentAzurePlayback.sourceNode = null;
    currentAzurePlayback.gainNode = null;
    currentAzurePlayback.startedAtTime = 0;
    currentAzurePlayback.pausedOffset = 0;
    currentAzurePlayback.isPaused = false;
    currentAzurePlayback.requestId = null;
    activeAudioRequestId = null;
    callbacks.onEnd?.();
  };

  sourceNode.start(0, safeOffset);

  if (notifyStart) {
    callbacks.onStart?.();
  }
}

async function resumeAzurePlayback(): Promise<void> {
  const {
    requestId,
    cacheKey,
    text,
    audioBuffer,
    callbacks,
    pausedOffset,
  } = currentAzurePlayback;

  if (!requestId || !cacheKey || !text || !audioBuffer || !currentAzurePlayback.isPaused) {
    return;
  }

  try {
    await startAzureBufferPlayback(text, cacheKey, audioBuffer, requestId, callbacks, pausedOffset, false);
  } catch (error) {
    console.error('❌ Failed to resume Azure audio:', error);
    activeAudioRequestId = null;
    resetAzurePlaybackState();
    callbacks.onError?.(error);
  }
}

/**
 * Speak using Azure backend
 */
async function speakWithAzure(text: string, options?: SpeakOptions): Promise<void> {
  const audioRequestId = Symbol('audioRequest');

  activeAudioRequestId = null;
  resetAzurePlaybackState();

  if (isWebSpeechSupported()) {
    activeWebSpeechRequestId = null;
    window.speechSynthesis.cancel();
  }

  activeAudioRequestId = audioRequestId;

  try {
    const { cacheKey, audioBuffer } = await fetchDecodedAzureAudio(text, options);

    if (activeAudioRequestId !== audioRequestId) {
      console.log('⚠️ Azure audio response ignored (superseded by a newer request)');
      return;
    }

    await startAzureBufferPlayback(
      text,
      cacheKey,
      audioBuffer,
      audioRequestId,
      {
        onStart: options?.onStart,
        onEnd: options?.onEnd,
        onError: options?.onError,
      }
    );
  } catch (error) {
    if (activeAudioRequestId !== audioRequestId) {
      return;
    }

    console.error('❌ Azure TTS error:', error);
    activeAudioRequestId = null;
    resetAzurePlaybackState();

    if (isWebSpeechSupported()) {
      console.log('⚠️ Azure playback failed, falling back to Web Speech API');
      useAzureBackend = false;
      speakWithWebSpeech(text, options);
      return;
    }

    options?.onError?.(error);
  }
}

/**
 * Speak using Web Speech API (original implementation)
 */
function speakWithWebSpeech(
  text: string,
  options?: SpeakOptions
): void {
  if (!isWebSpeechSupported()) {
    console.warn('❌ TTS is not supported in this browser');
    options?.onError?.(new Error('Text-to-speech is not supported in this browser'));
    return;
  }

  activeAudioRequestId = null;
  resetAzurePlaybackState();

  const webSpeechRequestId = Symbol('webSpeech');
  activeWebSpeechRequestId = webSpeechRequestId;
  
  // Firefox workaround: Force load voices
  window.speechSynthesis.getVoices();
  
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
  utterance.onstart = () => {
    console.log('▶️ Web Speech started');
    options?.onStart?.();
  };
  
  utterance.onend = () => {
    console.log('⏹️ Web Speech ended');
    if (activeWebSpeechRequestId === webSpeechRequestId) {
      activeWebSpeechRequestId = null;
    }
    options?.onEnd?.();
  };
  
  utterance.onerror = (error) => {
    console.error('❌ Web Speech error:', error);
    if (activeWebSpeechRequestId === webSpeechRequestId) {
      activeWebSpeechRequestId = null;
    }
    options?.onError?.(error);
  };
  
  // Firefox fix: Need to call getVoices() to wake up the speech synthesis
  window.speechSynthesis.getVoices();

  const queueSpeech = () => {
    if (activeWebSpeechRequestId !== webSpeechRequestId) {
      return;
    }

    window.speechSynthesis.speak(utterance);
    window.speechSynthesis.resume();
  };

  // A short delay after cancel() helps avoid clipped first syllables.
  setTimeout(queueSpeech, WEB_SPEECH_START_DELAY_MS);

  // Firefox sometimes needs one follow-up nudge to start speaking.
  setTimeout(() => {
    if (activeWebSpeechRequestId !== webSpeechRequestId) {
      return;
    }

    if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
      queueSpeech();
    }
  }, WEB_SPEECH_START_DELAY_MS + WEB_SPEECH_RETRY_DELAY_MS);
}

/**
 * Check if TTS is supported in the current browser
 */
export function isTTSSupported(): boolean {
  return typeof window !== 'undefined'
    && (isWebAudioSupported() || isWebSpeechSupported());
}

function isWebSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Check if Azure backend is being used
 */
export function isAzureBackend(): boolean {
  return useAzureBackend;
}

/**
 * Get all available voices (Web Speech API)
 */
export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (!isWebSpeechSupported()) return [];
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

  if (currentAzurePlayback.gainNode) {
    currentAzurePlayback.gainNode.gain.value = currentVolume;
  }
}

/**
 * Get the current volume
 */
export function getVolume(): number {
  return currentVolume;
}

/**
 * Speak the given text (automatically chooses backend)
 */
export async function speak(
  text: string, 
  options?: SpeakOptions
): Promise<void> {
  // Check if Azure backend is available (only once)
  if (!azureHealthChecked) {
    await checkAzureHealth();
  }
  
  // Use Azure backend if available
  if (useAzureBackend) {
    try {
      await speakWithAzure(text, options);
      return;
    } catch {
      // Fallback to Web Speech API on error
      console.log('⚠️ Azure Speech failed, falling back to Web Speech API');
      useAzureBackend = false;
      speakWithWebSpeech(text, options);
      return;
    }
  }
  
  // Fallback to Web Speech API
  speakWithWebSpeech(text, options);
}

/**
 * Speak Polish text with default settings
 */
export async function speakPolish(
  text: string,
  options?: Omit<SpeakOptions, 'lang'> | (() => void)
): Promise<void> {
  const resolvedOptions = typeof options === 'function' ? { onEnd: options } : options;

  await speak(text, {
    lang: POLISH_LANG,
    ...resolvedOptions,
  });
}

/**
 * Speak slowly (for learning)
 */
export async function speakSlow(
  text: string,
  options?: Omit<SpeakOptions, 'lang'> | (() => void)
): Promise<void> {
  const resolvedOptions = typeof options === 'function' ? { onEnd: options } : options;

  await speak(text, {
    ...resolvedOptions,
    lang: POLISH_LANG,
    rate: resolvedOptions?.rate ?? 0.7,
  });
}

/**
 * Stop any ongoing speech
 */
export function stopSpeaking(): void {
  activeAudioRequestId = null;
  activeWebSpeechRequestId = null;

  // Stop Azure audio
  resetAzurePlaybackState();
  
  // Stop Web Speech API
  if (isWebSpeechSupported()) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Clear the client-side audio cache
 */
export function clearAudioCache(): void {
  decodedAudioCache.clear();
  pendingDecodedAudio.clear();
  requestHashCache.clear();
  console.log('🗑️ Audio cache cleared');
}

/**
 * Pause speech
 */
export function pauseSpeaking(): void {
  // Pause Azure audio
  if (currentAzurePlayback.sourceNode && currentAzurePlayback.audioBuffer) {
    currentAzurePlayback.pausedOffset = getCurrentAzurePlaybackOffset();
    currentAzurePlayback.isPaused = true;
    stopCurrentAzureSource(false);
    return;
  }
  
  // Pause Web Speech API
  if (isWebSpeechSupported()) {
    window.speechSynthesis.pause();
  }
}

/**
 * Resume speech
 */
export function resumeSpeaking(): void {
  // Resume Azure audio
  if (currentAzurePlayback.isPaused) {
    void resumeAzurePlayback();
    return;
  }
  
  // Resume Web Speech API
  if (isWebSpeechSupported()) {
    window.speechSynthesis.resume();
  }
}

/**
 * Check if currently speaking
 */
export function isSpeaking(): boolean {
  // Check Azure audio
  if (currentAzurePlayback.sourceNode && !currentAzurePlayback.isPaused) {
    return true;
  }
  
  // Check Web Speech API
  if (!isWebSpeechSupported()) return false;
  return window.speechSynthesis.speaking;
}

/**
 * Check if speech is paused
 */
export function isPaused(): boolean {
  // Check Azure audio
  if (currentAzurePlayback.isPaused) {
    return true;
  }
  
  // Check Web Speech API
  if (!isWebSpeechSupported()) return false;
  return window.speechSynthesis.paused;
}

/**
 * Initialize TTS (call on app load to populate voices)
 * Some browsers load voices asynchronously
 */
export async function initializeTTS(): Promise<SpeechSynthesisVoice[]> {
  console.log('🎙️ Initializing TTS...');
  
  // Check Azure backend availability
  await checkAzureHealth();
  
  if (!isWebSpeechSupported()) {
    console.warn('❌ Web Speech is not supported');
    return [];
  }
  
  return new Promise((resolve) => {
    const voices = getAvailableVoices();
    console.log('🎤 Initial voices loaded:', voices.length);
    
    if (voices.length > 0) {
      console.log('✅ Voices available immediately');
      const polishVoices = voices.filter(v => v.lang.startsWith('pl'));
      console.log('🇵🇱 Polish voices found:', polishVoices.length, polishVoices.map(v => v.name));
      resolve(voices);
      return;
    }
    
    console.log('⏳ Waiting for voices to load asynchronously...');
    
    // Some browsers load voices asynchronously
    window.speechSynthesis.onvoiceschanged = () => {
      const loadedVoices = getAvailableVoices();
      console.log('🎤 Voices loaded asynchronously:', loadedVoices.length);
      const polishVoices = loadedVoices.filter(v => v.lang.startsWith('pl'));
      console.log('🇵🇱 Polish voices found:', polishVoices.length, polishVoices.map(v => v.name));
      resolve(loadedVoices);
    };
    
    // Timeout fallback
    setTimeout(() => {
      const finalVoices = getAvailableVoices();
      console.log('⏱️ Timeout fallback - voices:', finalVoices.length);
      resolve(finalVoices);
    }, 1000);
  });
}

/**
 * Apply saved preferences
 */
export function applyTTSPreferences(prefs: {
  voiceURI?: string;
  azureVoice?: string;
  rate?: number;
  pitch?: number;
}): void {
  if (prefs.voiceURI) {
    setVoice(prefs.voiceURI);
  }
  if (prefs.azureVoice !== undefined) {
    setAzureVoice(prefs.azureVoice);
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
  azureVoice: string | null;
  rate: number;
  pitch: number;
  volume: number;
  hasPolishVoice: boolean;
  backend: 'azure' | 'webspeech';
} {
  return {
    voiceURI: currentVoice?.voiceURI ?? null,
    azureVoice: currentAzureVoice,
    rate: currentRate,
    pitch: currentPitch,
    volume: currentVolume,
    hasPolishVoice: getPolishVoices().length > 0,
    backend: useAzureBackend ? 'azure' : 'webspeech',
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
  isAzureBackend,
  getVoices: getAvailableVoices,
  getPolishVoices,
  setVoice,
  setRate,
  getRate,
  setPitch,
  getPitch,
  setVolume,
  getVolume,
  setAzureVoice,
  getAzureVoice,
  initialize: initializeTTS,
  applyPreferences: applyTTSPreferences,
  getSettings: getTTSSettings,
};
