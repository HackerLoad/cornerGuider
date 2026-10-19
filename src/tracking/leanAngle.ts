/** Schwerkraftrichtung im Gerätekoordinatensystem (nur die Richtung zählt, Einheit egal). */
export type Vec3 = [number, number, number];

export const GRAVITY = 9.80665;

const len = (v: Vec3) => Math.hypot(v[0], v[1], v[2]);

function unit(v: Vec3): Vec3 | null {
  const n = len(v);
  return n > 1e-9 ? [v[0] / n, v[1] / n, v[2] / n] : null;
}

/**
 * Rechnerische Schräglage (Grad) aus Geschwindigkeit (m/s) und Kurvenradius (m): atan(v² / (r·g)).
 * Gilt für ein starres Motorrad im stationären Kreis; die Rückfallgröße, wenn der Sensorwert unbrauchbar ist.
 * Gerade (kein Radius), Stand und fehlende Werte ergeben 0.
 */
export function calcLeanDeg(speedMs: number | null | undefined, radiusM: number | null | undefined): number {
  if (!speedMs || speedMs <= 0 || !radiusM || !Number.isFinite(radiusM) || radiusM <= 0) return 0;
  return (Math.atan((speedMs * speedMs) / (radiusM * GRAVITY)) * 180) / Math.PI;
}

/** Winkel (Grad) zwischen zwei Schwerkraftrichtungen. Unabhängig davon, wie das Handy am Lenker sitzt. */
export function tiltDeg(zero: Vec3, g: Vec3): number {
  const a = unit(zero);
  const b = unit(g);
  if (!a || !b) return 0;
  const cross: Vec3 = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return (Math.atan2(len(cross), dot) * 180) / Math.PI;
}

/** Glättet die Schwerkraftrichtung (Vibrationen) mit einem exponentiellen Mittel. */
export class GravityFilter {
  private v: Vec3 | null = null;

  constructor(private readonly alpha = 0.2) {}

  push(g: Vec3): void {
    const u = unit(g);
    if (!u) return;
    if (!this.v) {
      this.v = u;
      return;
    }
    const a = this.alpha;
    this.v = unit([this.v[0] + a * (u[0] - this.v[0]), this.v[1] + a * (u[1] - this.v[1]), this.v[2] + a * (u[2] - this.v[2])]) ?? this.v;
  }

  /** Normierte, geglättete Richtung oder null, solange keine Messung vorliegt. */
  value(): Vec3 | null {
    return this.v;
  }

  reset(): void {
    this.v = null;
  }
}

export interface LeanReading {
  /** Normierte Schwerkraftrichtung im Gerätesystem (Rohwert für die spätere Auswertung) */
  gravity: Vec3 | null;
  /** Neigung gegenüber dem Nullpunkt (Grad, ≥ 0); null, solange es keinen Nullpunkt gibt */
  tiltDeg: number | null;
}

export interface LeanTrackerOptions {
  /** So viele Messungen im Stand ergeben den Nullpunkt */
  zeroSamples: number;
  /** Unter dieser Geschwindigkeit (m/s) gilt das Motorrad als stehend */
  standingSpeedMs: number;
}

/**
 * Nimmt im Stand einen Nullpunkt auf (aufrechtes Motorrad, Halterung beliebig ausgerichtet) und meldet
 * danach die Neigung dagegen. Gelingt das nicht beim Start, wird es beim ersten späteren Halt nachgeholt.
 * Der Nullpunkt wird danach nicht mehr verändert.
 */
export class LeanTracker {
  private readonly opt: LeanTrackerOptions;
  private zeroG: Vec3 | null = null;
  private buffer: Vec3[] = [];

  constructor(opt: Partial<LeanTrackerOptions> = {}) {
    this.opt = { zeroSamples: 3, standingSpeedMs: 1, ...opt };
  }

  get zero(): Vec3 | null {
    return this.zeroG;
  }

  update(g: Vec3 | null, speedMs: number | null): LeanReading {
    const u = g ? unit(g) : null;
    if (!u) return { gravity: null, tiltDeg: null };
    if (!this.zeroG) {
      if (speedMs !== null && speedMs < this.opt.standingSpeedMs) {
        this.buffer.push(u);
        if (this.buffer.length >= this.opt.zeroSamples) {
          const n = this.buffer.length;
          const sum = this.buffer.reduce<Vec3>((s, b) => [s[0] + b[0], s[1] + b[1], s[2] + b[2]], [0, 0, 0]);
          this.zeroG = unit([sum[0] / n, sum[1] / n, sum[2] / n]);
          this.buffer = [];
        }
      } else {
        this.buffer = [];
      }
    }
    return { gravity: u, tiltDeg: this.zeroG ? tiltDeg(this.zeroG, u) : null };
  }
}

/** Quelle der Schwerkraftrichtung (DeviceMotion); austauschbar für Tests. */
export interface LeanSource {
  /** Startet den Sensor; false, wenn keiner verfügbar ist */
  start(): Promise<boolean>;
  stop(): Promise<void> | void;
  /** Letzte geglättete Schwerkraftrichtung im Gerätesystem */
  latest(): Vec3 | null;
}
