// Text-to-Speech service with Azure Speech backend and Web Speech fallback

// Backend state
let useAzureBackend = false;
let azureHealthChecked = false;
let currentAudioElement: HTMLAudioElement | null = null;

// TTS configuration state (for Web Speech API)
let currentVoice: SpeechSynthesisVoice | null = null;
let currentRate = 1.0;
let currentPitch = 1.0;
let currentVolume = 1.0;

// Azure Speech configuration state
let currentAzureVoice: string | null = null;

// Client-side audio cache: Map<hash, AudioElement>
const audioCache = new Map<string, HTMLAudioElement>();
const MAX_CACHE_SIZE = 50; // Limit cache to 50 audio elements

// Track active audio request to ignore errors from superseded requests
let activeAudioRequestId: symbol | null = null;
let activeWebSpeechRequestId: symbol | null = null;

// Polish language code
const POLISH_LANG = 'pl-PL';
const AUDIO_SEEK_SETTLE_MS = 40;
const AUDIO_PLAYBACK_SETTLE_MS = 120;
const WEB_SPEECH_START_DELAY_MS = 120;
const WEB_SPEECH_RETRY_DELAY_MS = 250;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Get human-readable description of audio error codes
 */
function getAudioErrorDescription(code: number | null): string {
  if (code === null) return 'Unknown audio error';
  
  // MediaError constants
  const MEDIA_ERR_ABORTED = 1;
  const MEDIA_ERR_NETWORK = 2;
  const MEDIA_ERR_DECODE = 3;
  const MEDIA_ERR_SRC_NOT_SUPPORTED = 4;
  
  switch (code) {
    case MEDIA_ERR_ABORTED:
      return 'Audio playback was aborted';
    case MEDIA_ERR_NETWORK:
      return 'Network error while loading audio';
    case MEDIA_ERR_DECODE:
      return 'Audio decoding error (invalid or corrupted file)';
    case MEDIA_ERR_SRC_NOT_SUPPORTED:
      return 'Audio format not supported';
    default:
      return `Unknown audio error (code: ${code})`;
  }
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

/**
 * Speak using Azure backend
 */
async function speakWithAzure(
  text: string,
  options?: {
    rate?: number;
    voice?: string;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (error: unknown) => void;
  }
): Promise<SpeechSynthesisUtterance | HTMLAudioElement | null> {
  const audioRequestId = Symbol('audioRequest');

  // Stop any ongoing audio properly
  if (currentAudioElement) {
    try {
      // Remove error handlers to prevent error events when stopping
      currentAudioElement.onerror = null;
      currentAudioElement.pause();
      currentAudioElement.currentTime = 0;
      // Don't clear src immediately - let it finish cleanup naturally
      // Clearing src can trigger error events
    } catch {
      // Ignore errors when stopping
      console.log('Note: Error while stopping previous audio (ignored)');
    }
    // Clear the active request ID BEFORE clearing currentAudioElement
    // This ensures old error handlers know they're superseded
    activeAudioRequestId = null;
    currentAudioElement = null;
  }

  // Mark this request as the latest one before any network work starts.
  activeAudioRequestId = audioRequestId;
  
  try {
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
      if (errorData.fallback) {
        // Backend wants us to fallback to Web Speech API
        console.log('⚠️ Azure backend error, falling back to Web Speech API');
        useAzureBackend = false;
        return speakWithWebSpeech(text, options);
      }
      throw new Error(`TTS API error: ${response.statusText}`);
    }
    
    // Check content type
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('audio')) {
      console.error('❌ Invalid content type from TTS API:', contentType);
      throw new Error('Invalid audio response from server');
    }
    
    const audioBlob = await response.blob();
    
    // Validate blob
    if (!audioBlob || audioBlob.size === 0) {
      console.error('❌ Empty or invalid audio blob received');
      throw new Error('Empty audio file received from server');
    }
    
    // Validate WAV file header (first 4 bytes should be "RIFF")
    if (audioBlob.size >= 4) {
      const headerSlice = audioBlob.slice(0, 4);
      const headerArray = await headerSlice.arrayBuffer();
      const headerView = new Uint8Array(headerArray);
      const headerString = String.fromCharCode(...headerView);
      
      if (headerString !== 'RIFF') {
        console.error('❌ Invalid WAV file header:', headerString);
        throw new Error('Invalid audio file format (not a valid WAV file)');
      }
    }
    
    console.log(`🎵 Audio blob received: ${audioBlob.size} bytes, type: ${audioBlob.type}`);
    
    // Get cache key from API response header (server-generated hash)
    const cacheKey = response.headers.get('X-Audio-Hash') || 
      `${text}-${options?.rate ?? currentRate}-${options?.voice ?? currentAzureVoice ?? 'default'}`;
    
    // Check if we have a cached audio element for this text
    let audio: HTMLAudioElement | null = audioCache.get(cacheKey) ?? null;
    let audioUrl: string | null = null;
    if (activeAudioRequestId !== audioRequestId) {
      console.log('⚠️ Azure audio response ignored (superseded by a newer request)');
      return null;
    }
    
    // Create a reusable error handler
    const setupErrorHandler = (audioElement: HTMLAudioElement, url: string | null, isCached: boolean) => {
      audioElement.onerror = (error) => {
        // Ignore errors if this audio request was superseded by a new one
        if (activeAudioRequestId !== audioRequestId) {
          console.log('⚠️ Audio error ignored (audio was superseded by new request)');
          return;
        }
        
        // Ignore errors if this audio element is no longer the current one
        if (currentAudioElement !== audioElement) {
          console.log('⚠️ Audio error ignored (different audio is now active)');
          return;
        }
        
        const errorCode = audioElement.error?.code ?? null;
        
        // Ignore MEDIA_ERR_ABORTED (code 1) - this happens when audio is stopped
        if (errorCode === 1) {
          console.log('⚠️ Audio aborted (ignored - normal when stopping)');
          return;
        }
        
        const errorMessage = errorCode !== null
          ? `Code ${errorCode}: ${getAudioErrorDescription(errorCode)}`
          : 'Unknown audio error';
        console.error('❌ Azure audio playback error:', {
          error,
          errorMessage,
          errorCode,
          blobSize: audioBlob.size,
          blobType: audioBlob.type,
          audioError: audioElement.error,
          isCached,
          cacheKey,
          readyState: audioElement.readyState,
          networkState: audioElement.networkState,
        });
        
        // Remove from cache on error (only for real errors, not aborted)
        if (isCached && errorCode !== 1) {
          console.log('🗑️ Removing corrupted audio from cache');
          audioCache.delete(cacheKey);
          audioElement.pause();
          audioElement.currentTime = 0;
          // Don't clear src - it can cause additional errors
        } else {
          if (url) {
            URL.revokeObjectURL(url);
          }
        }
        
        if (currentAudioElement === audioElement) {
          currentAudioElement = null;
        }
        
        // Only fallback for real errors, not aborted
        if (errorCode !== 1) {
          // Fallback to Web Speech API on audio playback error
          console.log('⚠️ Audio playback failed, falling back to Web Speech API');
          useAzureBackend = false;
          speakWithWebSpeech(text, options);
          
          options?.onError?.(new Error(errorMessage));
        }
      };
    };
    
    if (audio) {
      // Reuse cached audio element
      console.log('♻️ Reusing cached audio element');

      // Check if cached audio is still valid
      if (audio.error || audio.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
        console.log('⚠️ Cached audio is invalid, creating new one');
        audioCache.delete(cacheKey);
        audio.pause();
        audio.src = '';
        audio = null;
      } else {
        // Reset to beginning
        audio.currentTime = 0;
        // Re-setup event handlers (they might have been cleared)
        setupErrorHandler(audio, null, true);
      }
    }
    
    if (!audio) {
      // Create new audio element
      audioUrl = URL.createObjectURL(audioBlob);
      audio = new Audio(audioUrl);
      
      // Preload the audio to ensure it's ready before playing
      audio.preload = 'auto';
      
      // Set up error handler
      setupErrorHandler(audio, audioUrl, false);
      
      // Set up event handlers
      audio.onplay = () => {
        console.log('▶️ Azure audio started');
        options?.onStart?.();
      };
      
      audio.onended = () => {
        console.log('⏹️ Azure audio ended');
        // Don't revoke URL or remove from cache - keep it for reuse
        if (currentAudioElement === audio && activeAudioRequestId === audioRequestId) {
          currentAudioElement = null;
          activeAudioRequestId = null;
        }
        options?.onEnd?.();
      };
      
      // Cache the audio element for future use
      // Limit cache size by removing oldest entries
      if (audioCache.size >= MAX_CACHE_SIZE) {
        const firstKey = audioCache.keys().next().value;
        if (firstKey) {
          const oldAudio = audioCache.get(firstKey);
          if (oldAudio) {
            oldAudio.pause();
            oldAudio.src = '';
          }
          audioCache.delete(firstKey);
        }
      }
      audioCache.set(cacheKey, audio);
    } else {
      // For cached audio, re-setup play/end handlers
      audio.onplay = () => {
        console.log('▶️ Azure audio started (cached)');
        options?.onStart?.();
      };
      
      audio.onended = () => {
        console.log('⏹️ Azure audio ended (cached)');
        if (currentAudioElement === audio && activeAudioRequestId === audioRequestId) {
          currentAudioElement = null;
          activeAudioRequestId = null;
        }
        options?.onEnd?.();
      };
    }
    
    currentAudioElement = audio;
    
    // Wait for audio to be fully ready before playing to prevent cut-off
    const waitForAudioReady = (): Promise<void> => {
      return new Promise((resolve, reject) => {
        // If already fully loaded, resolve immediately
        if (audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
          // Double-check by waiting a tiny bit for decode to complete
          setTimeout(() => resolve(), 10);
          return;
        }
        
        // Set up timeout to prevent infinite waiting
        const timeout = setTimeout(() => {
          reject(new Error('Audio loading timeout'));
        }, 10000); // Increased timeout for larger files
        
        // Wait for canplaythrough event (entire audio loaded and ready to play)
        // This is better than canplay as it ensures no buffering will occur
        const onCanPlayThrough = () => {
          clearTimeout(timeout);
          audio.removeEventListener('canplaythrough', onCanPlayThrough);
          audio.removeEventListener('error', onError);
          // Small delay to ensure decode is complete
          setTimeout(() => resolve(), 50);
        };
        
        // Fallback to canplay if canplaythrough doesn't fire
        const onCanPlay = () => {
          // If we have enough data, we can proceed
          if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
            clearTimeout(timeout);
            audio.removeEventListener('canplaythrough', onCanPlayThrough);
            audio.removeEventListener('canplay', onCanPlay);
            audio.removeEventListener('error', onError);
            setTimeout(() => resolve(), 100);
          }
        };
        
        const onError = () => {
          clearTimeout(timeout);
          audio.removeEventListener('canplaythrough', onCanPlayThrough);
          audio.removeEventListener('canplay', onCanPlay);
          audio.removeEventListener('error', onError);
          reject(new Error('Audio loading error'));
        };
        
        audio.addEventListener('canplaythrough', onCanPlayThrough, { once: true });
        audio.addEventListener('canplay', onCanPlay, { once: true });
        audio.addEventListener('error', onError, { once: true });
        
        // Force load if not already loading
        if (audio.readyState === HTMLMediaElement.HAVE_NOTHING) {
          audio.load();
        }
      });
    };
    
    // Attempt to play with error handling
    try {
      // Wait for audio to be fully ready before playing
      await waitForAudioReady();
      console.log('✅ Audio fully ready, starting playback');

      if (activeAudioRequestId !== audioRequestId) {
        console.log('⚠️ Audio playback skipped (superseded before play)');
        return null;
      }

      // Give the media element a moment to settle at the real start of the file.
      audio.pause();
      audio.currentTime = 0;
      await wait(AUDIO_SEEK_SETTLE_MS);

      if (activeAudioRequestId !== audioRequestId) {
        console.log('⚠️ Audio playback skipped (superseded during seek reset)');
        return null;
      }

      await wait(AUDIO_PLAYBACK_SETTLE_MS);

      if (activeAudioRequestId !== audioRequestId) {
        console.log('⚠️ Audio playback skipped (superseded during start delay)');
        return null;
      }

      // Play the audio
      await audio.play();
      return audio;
    } catch (playError) {
      console.error('❌ Failed to play audio:', playError);
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      audioCache.delete(cacheKey);
      if (currentAudioElement === audio) {
        currentAudioElement = null;
      }
      
      // Fallback to Web Speech API
      console.log('⚠️ Audio play() failed, falling back to Web Speech API');
      useAzureBackend = false;
      return speakWithWebSpeech(text, options);
    }
  } catch (error) {
    console.error('❌ Azure TTS error:', error);
    options?.onError?.(error);
    throw error;
  }
}

/**
 * Speak using Web Speech API (original implementation)
 */
function speakWithWebSpeech(
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
  if (!isWebSpeechSupported()) {
    console.warn('❌ TTS is not supported in this browser');
    return null;
  }

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
  
  return utterance;
}

/**
 * Check if TTS is supported in the current browser
 */
export function isTTSSupported(): boolean {
  return typeof window !== 'undefined'
    && (typeof Audio !== 'undefined' || 'speechSynthesis' in window);
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
  options?: {
    lang?: string;
    rate?: number;
    pitch?: number;
    volume?: number;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (error: unknown) => void;
  }
): Promise<SpeechSynthesisUtterance | HTMLAudioElement | null> {
  // Check if Azure backend is available (only once)
  if (!azureHealthChecked) {
    await checkAzureHealth();
  }
  
  // Use Azure backend if available
  if (useAzureBackend) {
    try {
      return await speakWithAzure(text, options);
    } catch {
      // Fallback to Web Speech API on error
      console.log('⚠️ Azure Speech failed, falling back to Web Speech API');
      useAzureBackend = false;
      return speakWithWebSpeech(text, options);
    }
  }
  
  // Fallback to Web Speech API
  return speakWithWebSpeech(text, options);
}

/**
 * Speak Polish text with default settings
 */
export async function speakPolish(
  text: string,
  options?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (error: unknown) => void;
    rate?: number;
    pitch?: number;
    volume?: number;
  } | (() => void)
): Promise<SpeechSynthesisUtterance | HTMLAudioElement | null> {
  const resolvedOptions = typeof options === 'function' ? { onEnd: options } : options;

  return speak(text, {
    lang: POLISH_LANG,
    ...resolvedOptions,
  });
}

/**
 * Speak slowly (for learning)
 */
export async function speakSlow(
  text: string,
  options?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (error: unknown) => void;
    rate?: number;
    pitch?: number;
    volume?: number;
  } | (() => void)
): Promise<SpeechSynthesisUtterance | HTMLAudioElement | null> {
  const resolvedOptions = typeof options === 'function' ? { onEnd: options } : options;

  return speak(text, {
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
  if (currentAudioElement) {
    currentAudioElement.pause();
    currentAudioElement.currentTime = 0;
    currentAudioElement = null;
  }
  
  // Stop Web Speech API
  if (isWebSpeechSupported()) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Clear the client-side audio cache
 */
export function clearAudioCache(): void {
  for (const audio of audioCache.values()) {
    audio.pause();
    audio.src = '';
  }
  audioCache.clear();
  console.log('🗑️ Audio cache cleared');
}

/**
 * Pause speech
 */
export function pauseSpeaking(): void {
  // Pause Azure audio
  if (currentAudioElement) {
    currentAudioElement.pause();
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
  if (currentAudioElement && currentAudioElement.paused) {
    currentAudioElement.play();
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
  if (currentAudioElement && !currentAudioElement.paused) {
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
  if (currentAudioElement) {
    return currentAudioElement.paused;
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
