import { DEFAULT_CURVE_CONFIG } from '../curves/config';
import { gpsAccuracyFactor, withConfidenceFactor } from '../curves/confidence';
import { buildMark, type FeedbackMark, type MarkKind } from '../feedback/model';
import type { DriveSettings } from '../settings';
import { GpsAdapter } from '../tracking/adaptiveGps';
import { nextCurves, type UpcomingCurve } from '../tracking/nextCurves';
import { RouteTracker, type Fix, type TrackStatus, type TrackerRoute } from '../tracking/routeTracker';
import { AnnounceScheduler, announceSettingsFrom } from '../voice/announceScheduler';
import { systemPhrase } from '../voice/phrases';
import type { LocationSource } from './locationSource';

export interface DriveSnapshot {
  status: TrackStatus;
  dist: number;
  remaining: number;
  speed: number;
  offset: number;
  upcoming: UpcomingCurve[];
}

export interface DriveSessionOptions {
  route: TrackerRoute;
  source: LocationSource;
  speak: (text: string) => void;
  getSettings: () => DriveSettings;
  now?: () => number;
  /** Anzahl angezeigter kommender Kurven */
  upcomingCount?: number;
}

/** Verbindet Positionsquelle, Tracker, Ansagen und UI-Snapshot (ohne RN-Abhängigkeit). */
export class DriveSession {
  private readonly tracker: RouteTracker;
  private readonly scheduler: AnnounceScheduler;
  private readonly now: () => number;
  private listeners = new Set<(s: DriveSnapshot) => void>();
  private readonly gps = new GpsAdapter();
  private lastStatus: TrackStatus = 'acquiring';
  private running = false;
  private lastFix: Fix | null = null;

  snapshot: DriveSnapshot = { status: 'acquiring', dist: 0, remaining: 0, speed: 0, offset: 0, upcoming: [] };

  constructor(private readonly o: DriveSessionOptions) {
    this.tracker = new RouteTracker(o.route);
    this.scheduler = new AnnounceScheduler(o.route.curves);
    this.now = o.now ?? Date.now;
    this.snapshot = { ...this.snapshot, remaining: this.tracker.length };
  }

  subscribe(cb: (s: DriveSnapshot) => void): () => void {
    this.listeners.add(cb);
    cb(this.snapshot);
    return () => this.listeners.delete(cb);
  }

  async start(): Promise<void> {
    this.running = true;
    await this.o.source.start((fix) => this.onFix(fix));
  }

  async stop(): Promise<void> {
    this.running = false;
    await this.o.source.stop();
  }

  /** Markierung (falsch / fehlt) an der letzten Position, mit Entfernung auf der Strecke. */
  makeMark(kind: MarkKind, routeId: string): FeedbackMark | null {
    if (!this.lastFix) return null;
    const first = this.snapshot.status === 'onRoute' ? this.snapshot.upcoming[0] : undefined;
    return buildMark(kind, 'route', this.lastFix, {
      routeId,
      distAlongM: this.snapshot.dist,
      curve: first ? { direction: first.curve.direction, grade: first.curve.grade } : undefined,
    });
  }

  onFix(fix: Fix): void {
    if (!this.running) return;
    this.lastFix = fix;
    const now = this.now();
    const st = this.tracker.update(fix, now);
    const settings = this.o.getSettings();
    const say = (t: string) => settings.voiceEnabled && this.o.speak(t);

    if (st.status === 'offRoute') {
      if (this.lastStatus !== 'offRoute') say(systemPhrase('offRoute', settings.voiceLanguage));
    } else if (st.status === 'finished') {
      if (this.lastStatus !== 'finished') say(systemPhrase('finished', settings.voiceLanguage));
    } else if (st.status === 'onRoute') {
      if (this.lastStatus === 'offRoute') say(systemPhrase('backOnRoute', settings.voiceLanguage));
      this.scheduler.setSettings(announceSettingsFrom(settings));
      const a = this.scheduler.next(st.dist, st.speed, fix.accuracy);
      if (a) say(a.text);
    }
    this.lastStatus = st.status;

    this.snapshot = {
      status: st.status,
      dist: st.dist,
      remaining: Math.max(0, this.tracker.length - st.dist),
      speed: st.speed,
      offset: st.offset,
      upcoming:
        st.status === 'onRoute'
          ? nextCurves(this.o.route.curves, st.dist, this.o.upcomingCount ?? 5).map((u) => ({
              ...u,
              curve: withConfidenceFactor(u.curve, gpsAccuracyFactor(fix.accuracy, DEFAULT_CURVE_CONFIG)),
            }))
          : [],
    };
    this.listeners.forEach((l) => l(this.snapshot));
    void this.adaptGps(st.speed, now);
  }

  private async adaptGps(speed: number, now: number): Promise<void> {
    if (!this.o.source.setProfile) return;
    const next = this.gps.update(speed, now);
    if (next) await this.o.source.setProfile(next).catch(() => undefined);
  }
}
