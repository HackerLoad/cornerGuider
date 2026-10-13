import type { GpsProfile } from '../tracking/adaptiveGps';
import type { Fix } from '../tracking/routeTracker';

/** Quelle von Positionen: echtes GPS oder Simulation. */
export interface LocationSource {
  start(listener: (fix: Fix) => void): Promise<void>;
  stop(): Promise<void>;
  /** Optional: Orten an Geschwindigkeit anpassen (Akku). */
  setProfile?(profile: GpsProfile): Promise<void>;
}
