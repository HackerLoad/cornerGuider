import { dist } from '../geo/polyline';
import type { XY } from '../geo/types';
import type { UpcomingCurve } from '../tracking/nextCurves';
import { DEFAULT_ANNOUNCE_SETTINGS, leadDistance, type AnnounceSettings } from './announceScheduler';
import { announcementText } from './phrases';

export interface FreeAnnouncement {
  text: string;
  /** Alle in dieser Ansage genannten Kurven (die erste und die direkt folgenden), mit Anfang in lokalen Metern */
  curves: { start: XY; grade: number; direction: 'left' | 'right' }[];
}

/**
 * Ansagen für die Freie Fahrt. Die Kurvenliste wird laufend neu berechnet, deshalb werden Kurven
 * über ihre Position wiedererkannt (nicht über einen Index) und jede nur einmal angesagt.
 */
export class FreeAnnouncer {
  private announced: XY[] = [];

  constructor(
    private settings: AnnounceSettings = DEFAULT_ANNOUNCE_SETTINGS,
    private readonly sameCurveM = 30,
  ) {}

  setSettings(s: AnnounceSettings): void {
    this.settings = s;
  }

  reset(): void {
    this.announced = [];
  }

  private seen(p: XY): boolean {
    return this.announced.some((a) => dist(a, p) <= this.sameCurveM);
  }

  /** `confident` = Straße sicher zugeordnet; sonst wird nichts angesagt. */
  next(upcoming: UpcomingCurve[], speedMs: number, confident: boolean): FreeAnnouncement | null {
    if (!confident) return null;
    const lead = leadDistance(speedMs, this.settings);
    for (let i = 0; i < upcoming.length; i++) {
      const u = upcoming[i]!;
      if (this.seen(u.curve.startXY)) continue;
      if (u.distanceTo > lead) return null;
      if (u.inside || u.distanceTo < this.settings.minUsefulM) {
        this.announced.push(u.curve.startXY); // zu spät, nicht mehr ansagen
        continue;
      }
      const followUps: UpcomingCurve[] = [];
      for (let j = i + 1; j < upcoming.length && upcoming[j]!.curve.followsPrevious && followUps.length < 2; j++) {
        followUps.push(upcoming[j]!);
      }
      this.announced.push(u.curve.startXY, ...followUps.map((f) => f.curve.startXY));
      return {
        text: announcementText(u.curve, u.distanceTo, followUps.map((f) => f.curve)),
        curves: [u, ...followUps].map((x) => ({ start: x.curve.startXY, grade: x.curve.grade, direction: x.curve.direction })),
      };
    }
    return null;
  }
}
