'use client';

import { useEffect } from 'react';
import { useStore } from '@/lib/store/useStore';
import { applyTTSPreferences, initializeTTS } from '@/lib/tts';

/**
 * Client component that initializes TTS preferences from the store
 * on app load. This ensures saved preferences are applied globally.
 */
export function TTSInitializer() {
  const { ttsPreferences } = useStore();

  useEffect(() => {
    // Apply saved TTS preferences on app load
    applyTTSPreferences({
      voiceURI: ttsPreferences.voiceURI,
      azureVoice: ttsPreferences.azureVoice,
      rate: ttsPreferences.rate,
    });

    // Warm up backend health check and browser voices early so the first click
    // doesn't have to pay that setup cost.
    void initializeTTS();
  }, [ttsPreferences.azureVoice, ttsPreferences.rate, ttsPreferences.voiceURI]);

  return null; // This component doesn't render anything
}
