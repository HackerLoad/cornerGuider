export type AnnounceStyle = 'long' | 'short';
export type VoiceLanguage = 'de' | 'en';
export type Units = 'metric' | 'imperial';
export type DriveSide = 'right' | 'left';
export type OrientationMode = 'auto' | 'portrait' | 'landscape';
export type UiLanguage = 'auto' | 'de' | 'en';

/** Einstellungen, die die Ansagen beeinflussen (reines TS, wird auch von den Tests benutzt). */
export interface DriveSettings {
  voiceEnabled: boolean;
  /** Vorwarnzeit in Sekunden */
  leadSeconds: number;
  /** Mindestvorwarnstrecke in Metern */
  minLeadM: number;
  /** Sprechgeschwindigkeit (1 = normal) */
  speechRate: number;
  /**
   * Kurven dieser Stufe und enger (1 = Spitzkehre) werden angesagt. Leichtere nur, wenn sie
   * direkt auf eine angesagte Kurve folgen („…, danach links 5").
   */
  minAnnounceGrade: number;
  /** long: „In 240 Metern Rechts 3, zieht zu"; short: „Rechts 3" */
  announceStyle: AnnounceStyle;
  /** „zieht zu" / „öffnet" mitsprechen (nur im langen Stil) */
  announceShape: boolean;
  voiceLanguage: VoiceLanguage;
  /** Kennung der gewählten Systemstimme (null = Standardstimme der Sprache) */
  voiceId: string | null;
  units: Units;
}

/** Einstellungen der Anzeige. */
export interface DisplaySettings {
  /** Rechtsverkehr: eigene Spur rechts der Mittellinie */
  driveSide: DriveSide;
  showRidingLine: boolean;
  /** Anzahl der weiteren Kurven in der Liste unter der Grafik (0–4) */
  listCount: number;
  orientation: OrientationMode;
  /** Sprache der Bedienoberfläche (auto = Gerätesprache) */
  uiLanguage: UiLanguage;
  /** Rückmeldeknöpfe (Falsch / Fehlt) im Fahrmodus, für den Beifahrer */
  showFeedbackButtons: boolean;
}

/** Einstellungen zu den Straßendaten der Freien Fahrt. */
export interface DataSettings {
  /** Eigener Overpass-Server (leer = nur die öffentlichen Server) */
  overpassUrl: string;
}

export const DEFAULT_DATA_SETTINGS: DataSettings = { overpassUrl: '' };

export const DEFAULT_DRIVE_SETTINGS: DriveSettings = {
  voiceEnabled: true,
  leadSeconds: 6,
  minLeadM: 80,
  speechRate: 1,
  minAnnounceGrade: 4,
  announceStyle: 'long',
  announceShape: true,
  voiceLanguage: 'de',
  voiceId: null,
  units: 'metric',
};

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  driveSide: 'right',
  showRidingLine: true,
  listCount: 3,
  orientation: 'auto',
  uiLanguage: 'auto',
  showFeedbackButtons: false,
};
