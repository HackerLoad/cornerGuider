import type { Shape } from '../curves/types';
import type { LatLon, XY } from '../geo/types';
import type { Vec3 } from '../tracking/leanAngle';
import type { CurveRating } from '../feedback/model';

/** Aktuelles Format der Aufzeichnung; Beschreibung in docs/recording-format.md. */
export const RECORDING_SCHEMA_VERSION = 2;

export interface RecordedFix {
  t: number;
  lat: number;
  lon: number;
  /** m/s, null wenn unbekannt */
  speed: number | null;
  /** GPS-Genauigkeit (m) */
  accuracy: number | null;
  /** Fahrtrichtung laut GPS (Grad) */
  heading: number | null;
  /** Radius der gefahrenen Kurve aus den letzten Positionen (m); null bei Gerade/Stand */
  radiusM: number | null;
  /** Rechnerische Schräglage atan(v²/(r·g)) in Grad aus `speed` und `radiusM` (0 bei Gerade) */
  leanCalcDeg: number | null;
  /** Geglättete Schwerkraftrichtung im Gerätesystem (DeviceMotion), normiert; null ohne Sensor */
  gravity: Vec3 | null;
  /** Neigung gegenüber dem Nullpunkt im Stand (Grad, ≥ 0); null ohne Sensor oder ohne Nullpunkt */
  tiltDeg: number | null;
}

export interface RecordedCurve {
  start: XY;
  grade: number;
  direction: 'left' | 'right';
  /** Vorhergesagter Mindestradius (m) */
  minRadius: number | null;
  shape: Shape | null;
  confidence: number | null;
}

export interface RecordedAnnouncement {
  t: number;
  text: string;
  curves: RecordedCurve[];
}

export interface FreerideStats {
  steps: number;
  ok: number;
  uncertain: number;
  noRoad: number;
  loading: number;
  /** Wie der vorhergesagte Pfad endete (nur Schritte mit Straße) */
  endReasons: Record<string, number>;
}

export interface LeanHeader {
  /** Ein Bewegungssensor war beim Start verfügbar */
  sensor: boolean;
  /** Schwerkraftrichtung im Stand (Nullpunkt) */
  zero: Vec3 | null;
  /** Zeitpunkt, an dem der Nullpunkt aufgenommen wurde (ms, epoch) */
  zeroAt: number | null;
}

/** Aufzeichnung einer Fahrt für die spätere Auswertung und Kalibrierung. */
export interface FreerideRecording {
  schemaVersion: typeof RECORDING_SCHEMA_VERSION;
  id: string;
  startedAt: number;
  endedAt: number;
  /** Ursprung der lokalen Meter, in denen `announcements` angegeben sind */
  origin: LatLon;
  fixes: RecordedFix[];
  announcements: RecordedAnnouncement[];
  stats: FreerideStats;
  lean: LeanHeader;
  /** Bewertungen der angesagten Kurven nach der Fahrt (Schlüssel siehe feedback/model.ts) */
  ratings?: Record<string, CurveRating>;
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/**
 * Liest eine gespeicherte oder exportierte Aufzeichnung (Format 1 oder 2, auch als Export-Paket
 * `ride-feedback`) und liefert das aktuelle Format; Unbrauchbares und unbekannte neuere Versionen ergeben null.
 */
export function parseRecording(input: unknown): FreerideRecording | null {
  let raw: unknown = input;
  if (isObj(raw) && raw.kind === 'ride-feedback' && isObj(raw.recording)) raw = raw.recording;
  if (!isObj(raw)) return null;
  if (!Array.isArray(raw.fixes) || !Array.isArray(raw.announcements)) return null;
  if (typeof raw.id !== 'string' || typeof raw.startedAt !== 'number' || typeof raw.endedAt !== 'number') return null;
  if (!isObj(raw.origin) || !isObj(raw.stats)) return null;

  if (raw.schemaVersion !== undefined) {
    return raw.schemaVersion === RECORDING_SCHEMA_VERSION ? (raw as unknown as FreerideRecording) : null;
  }
  if (raw.version !== 1) return null;

  // Format 1: es fehlen Genauigkeit, Radius, Schräglage und die Eigenschaften der angesagten Kurven
  const num = (x: unknown): number | null => (typeof x === 'number' ? x : null);
  return {
    schemaVersion: RECORDING_SCHEMA_VERSION,
    id: raw.id,
    startedAt: raw.startedAt,
    endedAt: raw.endedAt,
    origin: raw.origin as unknown as LatLon,
    fixes: (raw.fixes as Record<string, unknown>[]).map((f) => ({
      t: f.t as number,
      lat: f.lat as number,
      lon: f.lon as number,
      speed: num(f.speed),
      accuracy: null,
      heading: null,
      radiusM: null,
      leanCalcDeg: null,
      gravity: null,
      tiltDeg: null,
    })),
    announcements: (raw.announcements as Record<string, unknown>[]).map((a) => ({
      t: a.t as number,
      text: a.text as string,
      curves: (a.curves as Record<string, unknown>[]).map((c) => ({
        start: c.start as XY,
        grade: c.grade as number,
        direction: c.direction as 'left' | 'right',
        minRadius: null,
        shape: null,
        confidence: null,
      })),
    })),
    stats: raw.stats as unknown as FreerideStats,
    lean: { sensor: false, zero: null, zeroAt: null },
    ...(isObj(raw.ratings) ? { ratings: raw.ratings as unknown as Record<string, CurveRating> } : {}),
  };
}
