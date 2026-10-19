import { isStrongTightening } from '../curves/classify';
import { DEFAULT_CURVE_CONFIG } from '../curves/config';
import { dist } from '../geo/polyline';
import type { XY } from '../geo/types';
import type { UpcomingCurve } from '../tracking/nextCurves';
import { DEFAULT_ANNOUNCE_SETTINGS, leadDistance, type AnnounceSettings } from './announceScheduler';
import type { RecordedCurve } from '../freeride/recordingFormat';
import { announcementText } from './phrases';

export interface FreeAnnouncement {
  text: string;
  /** Alle in dieser Ansage genannten Kurven (die erste und die direkt folgenden), mit Anfang in lokalen Metern */
  curves: RecordedCurve[];
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
      if (u.curve.grade > this.settings.minAnnounceGrade && !u.inside && !isStrongTightening(u.curve, DEFAULT_CURVE_CONFIG)) {
        this.announced.push(u.curve.startXY); // leichte Kurve: nur in der Ansage der vorigen Kurve
        continue;
      }
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
        text: announcementText(u.curve, u.distanceTo, followUps.map((f) => f.curve), this.settings.phrase),
        curves: [u, ...followUps].map((x) => ({
          start: x.curve.startXY,
          grade: x.curve.grade,
          direction: x.curve.direction,
          minRadius: Math.round(x.curve.minRadius * 10) / 10,
          shape: x.curve.shape,
          confidence: Math.round(x.curve.confidence * 100) / 100,
        })),
      };
    }
    return null;
  }
}
