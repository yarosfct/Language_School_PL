'use client';

import { useEffect } from 'react';
import { useStore } from '@/lib/store/useStore';
import { applyTTSPreferences } from '@/lib/tts';

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
      piperVoice: ttsPreferences.piperVoice,
      rate: ttsPreferences.rate,
    });
  }, []); // Only run once on mount

  return null; // This component doesn't render anything
}
