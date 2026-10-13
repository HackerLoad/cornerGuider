import * as Location from 'expo-location';
import type { LocationSource } from '../drive/locationSource';
import type { GpsProfile } from '../tracking/adaptiveGps';
import type { Fix } from '../tracking/routeTracker';
import { LOCATION_TASK, addLocationListener, toFix } from './locationTask';

const ACCURACY: Record<GpsProfile['accuracy'], Location.Accuracy> = {
  best: Location.Accuracy.BestForNavigation,
  balanced: Location.Accuracy.Balanced,
};

/** Echtes GPS: Hintergrund-Updates via TaskManager, Fallback auf Vordergrund-Watch. */
export class DeviceLocationSource implements LocationSource {
  private removeListener: (() => void) | null = null;
  private watch: Location.LocationSubscription | null = null;
  private background = false;
  private listener: ((fix: Fix) => void) | null = null;

  async start(listener: (fix: Fix) => void): Promise<void> {
    this.listener = listener;
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') throw new Error('Standortzugriff wurde nicht erlaubt.');
    const bg = await Location.requestBackgroundPermissionsAsync().catch(() => null);
    this.background = bg?.status === 'granted';
    await this.begin({ accuracy: 'best', timeIntervalMs: 1000, distanceIntervalM: 0 });
  }

  async setProfile(p: GpsProfile): Promise<void> {
    await this.halt();
    await this.begin(p);
  }

  async stop(): Promise<void> {
    await this.halt();
    this.listener = null;
  }

  private async begin(p: GpsProfile): Promise<void> {
    const listener = this.listener;
    if (!listener) return;
    if (this.background) {
      this.removeListener = addLocationListener(listener);
      await Location.startLocationUpdatesAsync(LOCATION_TASK, {
        accuracy: ACCURACY[p.accuracy],
        timeInterval: p.timeIntervalMs,
        distanceInterval: p.distanceIntervalM,
        activityType: Location.ActivityType.AutomotiveNavigation,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'cornerGuider',
          notificationBody: 'Kurvenführung aktiv',
          notificationColor: '#ffb300',
        },
      });
    } else {
      this.watch = await Location.watchPositionAsync(
        { accuracy: ACCURACY[p.accuracy], timeInterval: p.timeIntervalMs, distanceInterval: p.distanceIntervalM },
        (loc) => listener(toFix(loc)),
      );
    }
  }

  private async halt(): Promise<void> {
    this.removeListener?.();
    this.removeListener = null;
    this.watch?.remove();
    this.watch = null;
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false)) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    }
  }
}
