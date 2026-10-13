import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_DRIVE_SETTINGS, type DriveSettings } from '../settings';

interface SettingsState extends DriveSettings {
  safetyAccepted: boolean;
  acceptSafety(): void;
  set(patch: Partial<DriveSettings>): void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_DRIVE_SETTINGS,
      safetyAccepted: false,
      acceptSafety: () => set({ safetyAccepted: true }),
      set: (patch) => set(patch),
    }),
    { name: 'settings', storage: createJSONStorage(() => AsyncStorage) },
  ),
);

export function currentDriveSettings(): DriveSettings {
  const s = useSettingsStore.getState();
  return { voiceEnabled: s.voiceEnabled, leadSeconds: s.leadSeconds, minLeadM: s.minLeadM, speechRate: s.speechRate };
}
