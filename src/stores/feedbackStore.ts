import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { FeedbackMark } from '../feedback/model';

const MAX_MARKS = 500;

interface FeedbackState {
  marks: FeedbackMark[];
  add(mark: FeedbackMark): void;
  remove(id: string): void;
  clear(): void;
}

/** Markierungen („falsch" / „fehlt"), die während der Fahrten gesetzt wurden; bleiben auf dem Gerät. */
export const useFeedbackStore = create<FeedbackState>()(
  persist(
    (set) => ({
      marks: [],
      add: (mark) => set((s) => ({ marks: [...s.marks, mark].slice(-MAX_MARKS) })),
      remove: (id) => set((s) => ({ marks: s.marks.filter((m) => m.id !== id) })),
      clear: () => set({ marks: [] }),
    }),
    { name: 'feedback-marks', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
