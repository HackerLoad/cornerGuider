export interface DriveSettings {
  voiceEnabled: boolean;
  /** Vorwarnzeit in Sekunden */
  leadSeconds: number;
  /** Mindestvorwarnstrecke in Metern */
  minLeadM: number;
  /** Sprechgeschwindigkeit (1 = normal) */
  speechRate: number;
}

export const DEFAULT_DRIVE_SETTINGS: DriveSettings = {
  voiceEnabled: true,
  leadSeconds: 6,
  minLeadM: 80,
  speechRate: 1,
};
