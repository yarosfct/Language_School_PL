// Global state management with Zustand

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserProfile } from '@/types/progress';

interface AppState {
  currentUser: UserProfile | null;
  currentLesson: string | null;
  reviewDueCount: number;
  soundEnabled: boolean;
  
  setCurrentUser: (user: UserProfile | null) => void;
  setCurrentLesson: (id: string | null) => void;
  updateReviewDueCount: (count: number) => void;
  toggleSound: () => void;
  resetStore: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      currentUser: null,
      currentLesson: null,
      reviewDueCount: 0,
      soundEnabled: true,
      
      setCurrentUser: (user) => set({ currentUser: user }),
      setCurrentLesson: (id) => set({ currentLesson: id }),
      updateReviewDueCount: (count) => set({ reviewDueCount: count }),
      toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
      resetStore: () => set({
        currentUser: null,
        currentLesson: null,
        reviewDueCount: 0,
        soundEnabled: true,
      }),
    }),
    {
      name: 'polskiOdZera-storage',
    }
  )
);
