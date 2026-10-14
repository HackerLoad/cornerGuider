import * as TaskManager from 'expo-task-manager';
import type { LocationObject } from 'expo-location';
import type { Fix } from '../tracking/routeTracker';

export const LOCATION_TASK = 'cornerguider-location';

type Listener = (fix: Fix) => void;
const listeners = new Set<Listener>();

export function addLocationListener(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function toFix(loc: LocationObject): Fix {
  const { latitude, longitude, speed, accuracy, heading } = loc.coords;
  return {
    lat: latitude,
    lon: longitude,
    speed: speed !== null && speed >= 0 ? speed : null,
    accuracy: accuracy ?? null,
    timestamp: loc.timestamp,
    heading: heading !== null && heading >= 0 ? heading : null,
  };
}

// Muss auf Modulebene definiert sein (wird in app/_layout importiert).
TaskManager.defineTask<{ locations?: LocationObject[] }>(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data?.locations) return;
  for (const loc of data.locations) {
    const fix = toFix(loc);
    listeners.forEach((l) => l(fix));
  }
});
