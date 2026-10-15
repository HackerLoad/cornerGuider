import { formatDistance } from '../format';
import type { Units } from '../settings';
import { curvePhrase } from '../voice/phrases';

export type LiveKind = 'curve' | 'offRoute' | 'searching' | 'finished' | 'noData' | 'uncertain';

/** Was die Live-Aktivität (Sperrbildschirm / Dynamic Island) gerade zeigen soll, unabhängig von iOS. */
export interface LiveInput {
  kind: LiveKind;
  direction?: 'left' | 'right';
  grade?: number;
  distanceM?: number;
  inside?: boolean;
}

export interface LiveContent {
  title: string;
  subtitle: string;
  /** Name des Bilds in assets/liveActivity (ohne .png) */
  imageName: string;
  /** 0…1, wächst beim Näherkommen; undefined = kein Balken */
  progress?: number;
  /** Ändert sich genau dann, wenn sich die Anzeige ändert (für das Drosseln) */
  key: string;
}

/** Ab dieser Entfernung beginnt der Fortschrittsbalken zu wachsen (m). */
const PROGRESS_RANGE_M = 500;

const roundDistance = (m: number) => (m < 300 ? Math.max(10, Math.round(m / 10) * 10) : Math.round(m / 50) * 50);

export function toLiveContent(i: LiveInput, units: Units = 'metric'): LiveContent {
  let c: Omit<LiveContent, 'key'>;
  switch (i.kind) {
    case 'curve': {
      const dir = i.direction ?? 'right';
      const grade = Math.min(6, Math.max(1, i.grade ?? 6));
      const title = curvePhrase({ direction: dir, grade, shape: 'constant' }, false, 'de');
      const dist = Math.max(0, i.distanceM ?? 0);
      c = {
        title,
        subtitle: i.inside ? 'Jetzt in der Kurve' : `In ${formatDistance(roundDistance(dist), units)}`,
        imageName: `curve_${dir}_${grade}`,
        progress: i.inside ? 1 : Math.round((1 - Math.min(1, dist / PROGRESS_RANGE_M)) * 20) / 20,
      };
      break;
    }
    case 'offRoute':
      c = { title: 'Abseits der Route', subtitle: 'Keine Kurvenansagen, bis du zurück bist', imageName: 'offroute' };
      break;
    case 'finished':
      c = { title: 'Ziel erreicht', subtitle: '', imageName: 'finish' };
      break;
    case 'noData':
      c = { title: 'Keine Straßendaten', subtitle: 'Verbindung prüfen', imageName: 'offroute' };
      break;
    case 'uncertain':
      c = { title: 'Straße unsicher', subtitle: 'Keine Ansagen', imageName: 'gps' };
      break;
    default:
      c = { title: 'GPS wird gesucht …', subtitle: '', imageName: 'gps' };
  }
  return { ...c, key: `${c.title}|${c.subtitle}|${c.imageName}|${c.progress ?? ''}` };
}

/**
 * Drosselt Aktualisierungen: nur senden, wenn sich der Inhalt geändert hat und seit dem letzten Senden
 * mindestens `minIntervalMs` vergangen sind. Das Ende-Ereignis geht immer durch (siehe reset).
 */
export class LiveThrottle {
  private lastKey: string | null = null;
  private lastAt = -Infinity;

  constructor(private readonly minIntervalMs = 2000) {}

  shouldSend(key: string, now: number): boolean {
    if (key === this.lastKey) return false;
    if (now - this.lastAt < this.minIntervalMs) return false;
    this.lastKey = key;
    this.lastAt = now;
    return true;
  }

  reset(): void {
    this.lastKey = null;
    this.lastAt = -Infinity;
  }
}
