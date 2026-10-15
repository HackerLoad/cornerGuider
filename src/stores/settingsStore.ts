import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  DEFAULT_DATA_SETTINGS,
  DEFAULT_DISPLAY_SETTINGS,
  DEFAULT_DRIVE_SETTINGS,
  type DataSettings,
  type DisplaySettings,
  type DriveSettings,
} from '../settings';

export type GoMode = 'route' | 'free';

interface AppState {
  safetyAccepted: boolean;
  /** Was der große Go-Knopf startet: die gewählte Strecke oder die Freie Fahrt */
  goMode: GoMode;
  /** Strecke, die der Go-Knopf fährt */
  activeRouteId: string | null;
}

interface SettingsState extends DriveSettings, DisplaySettings, DataSettings, AppState {
  acceptSafety(): void;
  set(patch: Partial<DriveSettings & DisplaySettings & DataSettings & AppState>): void;
  reset(): void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_DRIVE_SETTINGS,
      ...DEFAULT_DISPLAY_SETTINGS,
      ...DEFAULT_DATA_SETTINGS,
      safetyAccepted: false,
      goMode: 'route',
      activeRouteId: null,
      acceptSafety: () => set({ safetyAccepted: true }),
      set: (patch) => set(patch),
      reset: () => set({ ...DEFAULT_DRIVE_SETTINGS, ...DEFAULT_DISPLAY_SETTINGS, ...DEFAULT_DATA_SETTINGS }),
    }),
    { name: 'settings', storage: createJSONStorage(() => AsyncStorage) },
  ),
);

export const useUnits = () => useSettingsStore((s) => s.units);

/** Aktuelle Ansage-Einstellungen (außerhalb von React, z. B. für die Sessions). */
export function currentDriveSettings(): DriveSettings {
  const s = useSettingsStore.getState();
  return {
    voiceEnabled: s.voiceEnabled,
    leadSeconds: s.leadSeconds,
    minLeadM: s.minLeadM,
    speechRate: s.speechRate,
    minAnnounceGrade: s.minAnnounceGrade,
    announceStyle: s.announceStyle,
    announceShape: s.announceShape,
    voiceLanguage: s.voiceLanguage,
    voiceId: s.voiceId,
    units: s.units,
  };
}
