// Global state management with Zustand

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserProfile } from '@/types/progress';

export interface TTSPreferences {
  autoPlay: boolean;
  defaultSpeed: 'normal' | 'slow';
  showVisualFeedback: boolean;
  voiceURI?: string; // Web Speech API voice
  piperVoice?: string; // Piper TTS voice name
  rate?: number; // Speech rate (0.5 - 2.0)
}

interface AppState {
  currentUser: UserProfile | null;
  currentLesson: string | null;
  reviewDueCount: number;
  soundEnabled: boolean;
  ttsPreferences: TTSPreferences;
  
  setCurrentUser: (user: UserProfile | null) => void;
  setCurrentLesson: (id: string | null) => void;
  updateReviewDueCount: (count: number) => void;
  toggleSound: () => void;
  updateTTSPreferences: (prefs: Partial<TTSPreferences>) => void;
  resetStore: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      currentUser: null,
      currentLesson: null,
      reviewDueCount: 0,
      soundEnabled: true,
      ttsPreferences: {
        autoPlay: false,
        defaultSpeed: 'normal',
        showVisualFeedback: true,
        rate: 1.0,
      },
      
      setCurrentUser: (user) => set({ currentUser: user }),
      setCurrentLesson: (id) => set({ currentLesson: id }),
      updateReviewDueCount: (count) => set({ reviewDueCount: count }),
      toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
      updateTTSPreferences: (prefs) => set((state) => ({
        ttsPreferences: { ...state.ttsPreferences, ...prefs }
      })),
      resetStore: () => set({
        currentUser: null,
        currentLesson: null,
        reviewDueCount: 0,
        soundEnabled: true,
        ttsPreferences: {
          autoPlay: false,
          defaultSpeed: 'normal',
          showVisualFeedback: true,
          rate: 1.0,
        },
      }),
    }),
    {
      name: 'polskiOdZera-storage',
    }
  )
);
