import type { Curve } from '../curves';
import { isStrongTightening } from '../curves/classify';
import { DEFAULT_CURVE_CONFIG } from '../curves/config';
import { gpsAccuracyFactor, withConfidenceFactor } from '../curves/confidence';
import type { DriveSettings } from '../settings';
import { DEFAULT_PHRASE_OPTIONS, announcementText, type PhraseOptions } from './phrases';

export interface AnnounceSettings {
  /** Vorlaufzeit in Sekunden */
  leadSeconds: number;
  /** Mindestvorlauf in Metern */
  minLeadM: number;
  /** Kürzere Reststrecke als dies: Ansage verspätet, wird übersprungen (m) */
  minUsefulM: number;
  /** Kurven dieser Stufe und enger werden angesagt; leichtere nur direkt nach einer angesagten Kurve */
  minAnnounceGrade: number;
  phrase: PhraseOptions;
}

export const DEFAULT_ANNOUNCE_SETTINGS: AnnounceSettings = {
  leadSeconds: 6,
  minLeadM: 80,
  minUsefulM: 30,
  minAnnounceGrade: 6,
  phrase: DEFAULT_PHRASE_OPTIONS,
};

/** Leitet die Ansage-Einstellungen aus den Benutzereinstellungen ab. */
export function announceSettingsFrom(s: DriveSettings): AnnounceSettings {
  return {
    leadSeconds: s.leadSeconds,
    minLeadM: s.minLeadM,
    minUsefulM: 30,
    minAnnounceGrade: s.minAnnounceGrade,
    phrase: { language: s.voiceLanguage, style: s.announceStyle, shape: s.announceShape, units: s.units },
  };
}

export function leadDistance(speedMs: number, s: AnnounceSettings): number {
  return Math.max(s.minLeadM, speedMs * s.leadSeconds);
}

export interface Announcement {
  curveIndex: number;
  text: string;
}

/**
 * Entscheidet, wann welche Kurve angesagt wird. Jede Kurve höchstens einmal;
 * Kurvenfolgen werden in einer Ansage zusammengefasst.
 */
export class AnnounceScheduler {
  private announced = new Set<number>();

  constructor(
    private readonly curves: Curve[],
    private settings: AnnounceSettings = DEFAULT_ANNOUNCE_SETTINGS,
  ) {}

  setSettings(s: AnnounceSettings): void {
    this.settings = s;
  }

  reset(): void {
    this.announced.clear();
  }

  /**
   * Gibt höchstens eine Ansage zurück (die nächste fällige Kurve).
   * `gpsAccuracyM`: schlechte Ortung senkt die Konfidenz (die Position auf der Route ist dann unsicher).
   */
  next(dist: number, speedMs: number, gpsAccuracyM?: number | null): Announcement | null {
    const accuracy = gpsAccuracyFactor(gpsAccuracyM, DEFAULT_CURVE_CONFIG);
    const lead = leadDistance(speedMs, this.settings);
    for (let i = 0; i < this.curves.length; i++) {
      const c = this.curves[i]!;
      if (c.endDist <= dist) continue;
      if (this.announced.has(c.index)) continue;
      const distanceTo = c.startDist - dist;
      if (distanceTo > lead) return null; // spätere Kurven sind noch weiter weg
      if (c.grade > this.settings.minAnnounceGrade && !isStrongTightening(c, DEFAULT_CURVE_CONFIG)) {
        // leichte Kurve: nicht für sich ansagen (folgt sie auf eine angesagte Kurve, steht sie in deren Ansage)
        this.announced.add(c.index);
        continue;
      }
      if (distanceTo < this.settings.minUsefulM) {
        // zu spät (z. B. Start mitten auf der Route) → nicht mehr ansagen
        this.announced.add(c.index);
        continue;
      }
      const followUps: Curve[] = [];
      let j = i + 1;
      while (j < this.curves.length && this.curves[j]!.followsPrevious && followUps.length < 2) {
        followUps.push(this.curves[j]!);
        j++;
      }
      this.announced.add(c.index);
      followUps.forEach((f) => this.announced.add(f.index));
      const sure = (x: Curve) => withConfidenceFactor(x, accuracy);
      return { curveIndex: c.index, text: announcementText(sure(c), distanceTo, followUps.map(sure), this.settings.phrase) };
    }
    return null;
  }
}
