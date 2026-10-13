import { cumulativeLengths } from '../geo/polyline';
import { makeProjection, type Projection } from '../geo/projection';
import type { XY } from '../geo/types';
import type { Fix, TrackerRoute } from '../tracking/routeTracker';
import type { LocationSource } from './locationSource';

export interface SimulatorOptions {
  /** Startgeschwindigkeit in km/h */
  speedKmh?: number;
  /** Start entlang der Route (m) */
  startDist?: number;
  /** Intervall der Positionen (ms) */
  tickMs?: number;
  now?: () => number;
}

/** Spielt eine Fahrt entlang der Route ab (gleiche Schnittstelle wie das echte GPS). */
export class SimulatedLocationSource implements LocationSource {
  private readonly proj: Projection;
  private readonly cum: number[];
  private readonly length: number;
  private readonly tickMs: number;
  private readonly now: () => number;
  private listener: ((fix: Fix) => void) | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  private speedMs: number;
  private dist: number;
  private paused = false;
  private side = 0;

  constructor(private readonly route: Pick<TrackerRoute, 'path' | 'projectionOrigin'>, opts: SimulatorOptions = {}) {
    this.proj = makeProjection(route.projectionOrigin);
    this.cum = cumulativeLengths(route.path);
    this.length = this.cum[this.cum.length - 1] ?? 0;
    this.tickMs = opts.tickMs ?? 1000;
    this.now = opts.now ?? Date.now;
    this.speedMs = (opts.speedKmh ?? 60) / 3.6;
    this.dist = Math.min(Math.max(0, opts.startDist ?? 0), this.length);
  }

  get speedKmh(): number {
    return this.speedMs * 3.6;
  }
  get position(): number {
    return this.dist;
  }
  get isPaused(): boolean {
    return this.paused;
  }

  setSpeedKmh(kmh: number): void {
    this.speedMs = Math.max(0, kmh) / 3.6;
  }
  setPaused(p: boolean): void {
    this.paused = p;
  }
  /** Seitlicher Versatz in m, um Off-Route zu testen (0 = auf der Route). */
  setSideOffset(m: number): void {
    this.side = m;
  }
  jump(deltaM: number): void {
    this.dist = Math.min(Math.max(0, this.dist + deltaM), this.length);
  }

  async start(listener: (fix: Fix) => void): Promise<void> {
    this.listener = listener;
    this.emit();
    this.timer = setInterval(() => this.tick(this.tickMs), this.tickMs);
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.listener = null;
  }

  /** Einen Zeitschritt voranschreiten (auch für Tests nutzbar). */
  tick(dtMs: number): void {
    if (!this.paused) this.dist = Math.min(this.length, this.dist + (this.speedMs * dtMs) / 1000);
    this.emit();
  }

  private pointAt(d: number): { p: XY; nx: number; ny: number } {
    const path = this.route.path;
    let i = 0;
    while (i < path.length - 2 && this.cum[i + 1]! < d) i++;
    const a = path[i]!;
    const b = path[i + 1]!;
    const segLen = this.cum[i + 1]! - this.cum[i]! || 1;
    const f = Math.min(1, Math.max(0, (d - this.cum[i]!) / segLen));
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return {
      p: { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f },
      nx: -(b.y - a.y) / len,
      ny: (b.x - a.x) / len,
    };
  }

  private emit(): void {
    if (!this.listener) return;
    const { p, nx, ny } = this.pointAt(this.dist);
    const ll = this.proj.toLatLon({ x: p.x + nx * this.side, y: p.y + ny * this.side });
    this.listener({
      ...ll,
      speed: this.paused ? 0 : this.speedMs,
      accuracy: 5,
      timestamp: this.now(),
    });
  }
}
