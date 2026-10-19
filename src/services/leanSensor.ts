import { DeviceMotion } from 'expo-sensors';
import { GravityFilter, type LeanSource, type Vec3 } from '../tracking/leanAngle';

/**
 * Schwerkraftrichtung aus DeviceMotion (iOS und Android). Die Richtung entsteht aus der Beschleunigung mit
 * minus der ohne Schwerkraft; fehlt letztere, aus der Gesamtbeschleunigung. Alles bleibt auf dem Gerät.
 */
export function createLeanSource(): LeanSource {
  const filter = new GravityFilter(0.2);
  let sub: { remove: () => void } | null = null;
  return {
    async start() {
      try {
        if (!(await DeviceMotion.isAvailableAsync())) return false;
        DeviceMotion.setUpdateInterval(100);
        sub = DeviceMotion.addListener((m) => {
          const total = m.accelerationIncludingGravity;
          if (!total) return;
          const user = m.acceleration;
          const g: Vec3 = [total.x - (user?.x ?? 0), total.y - (user?.y ?? 0), total.z - (user?.z ?? 0)];
          filter.push(g);
        });
        return true;
      } catch {
        return false;
      }
    },
    stop() {
      sub?.remove();
      sub = null;
      filter.reset();
    },
    latest: () => filter.value(),
  };
}
