import type { Curve } from '../curves';
import { announcementText } from './phrases';

export interface AnnounceSettings {
  /** Vorlaufzeit in Sekunden */
  leadSeconds: number;
  /** Mindestvorlauf in Metern */
  minLeadM: number;
  /** Kürzere Reststrecke als dies: Ansage verspätet, wird übersprungen (m) */
  minUsefulM: number;
}

export const DEFAULT_ANNOUNCE_SETTINGS: AnnounceSettings = { leadSeconds: 6, minLeadM: 80, minUsefulM: 30 };

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

  /** Gibt höchstens eine Ansage zurück (die nächste fällige Kurve). */
  next(dist: number, speedMs: number): Announcement | null {
    const lead = leadDistance(speedMs, this.settings);
    for (let i = 0; i < this.curves.length; i++) {
      const c = this.curves[i]!;
      if (c.endDist <= dist) continue;
      if (this.announced.has(c.index)) continue;
      const distanceTo = c.startDist - dist;
      if (distanceTo > lead) return null; // spätere Kurven sind noch weiter weg
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
      return { curveIndex: c.index, text: announcementText(c, distanceTo, followUps) };
    }
    return null;
  }
}
