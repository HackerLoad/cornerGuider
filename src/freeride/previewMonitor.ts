export type PreviewEvent = 'lost' | 'back';

export interface PreviewInput {
  /** Straße sicher zugeordnet */
  ok: boolean;
  /** Länge des vorhergesagten Pfads voraus (m) */
  aheadM: number;
  /** Vorlaufdistanz der Ansage bei der aktuellen Geschwindigkeit (m) */
  leadM: number;
  /** m/s */
  speedMs: number;
}

export interface PreviewMonitorConfig {
  /** So viele schlechte Schritte in Folge, bis „Vorschau endet" gemeldet wird */
  lostAfter: number;
  /** So viele gute Schritte in Folge, bis „Vorschau wieder da" gemeldet wird */
  backAfter: number;
  /** Unter dieser Geschwindigkeit (m/s) wird nichts gezählt (Ampel, Kreuzung im Stand) */
  minSpeedMs: number;
}

const DEFAULTS: PreviewMonitorConfig = { lostAfter: 3, backAfter: 3, minSpeedMs: 2 };

/**
 * Erkennt, wann die Vorschau der Freien Fahrt ausfällt (Kreuzung, keine Daten, unsichere Straße) und
 * wann sie zurückkommt. Meldet jeden Wechsel genau einmal, damit Stille nicht als „gerade" missverstanden wird.
 */
export class PreviewMonitor {
  private readonly cfg: PreviewMonitorConfig;
  private active = false;
  private everActive = false;
  private streak = 0;

  constructor(cfg: Partial<PreviewMonitorConfig> = {}) {
    this.cfg = { ...DEFAULTS, ...cfg };
  }

  /** Vorschau war da und ist (nach Entprellung) ausgefallen */
  get lost(): boolean {
    return this.everActive && !this.active;
  }

  reset(): void {
    this.active = false;
    this.everActive = false;
    this.streak = 0;
  }

  update(i: PreviewInput): PreviewEvent | null {
    if (i.speedMs < this.cfg.minSpeedMs) return null;
    const good = i.ok && i.aheadM >= i.leadM;

    if (!this.everActive) {
      if (good) {
        this.everActive = true;
        this.active = true;
      }
      return null;
    }
    if (good === this.active) {
      this.streak = 0;
      return null;
    }
    this.streak++;
    if (this.streak < (good ? this.cfg.backAfter : this.cfg.lostAfter)) return null;
    this.streak = 0;
    this.active = good;
    return good ? 'back' : 'lost';
  }
}
