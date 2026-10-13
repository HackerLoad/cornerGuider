import { makeProjection } from '../../src/geo/projection';
import type { LatLon, XY } from '../../src/geo/types';

const proj = makeProjection({ lat: 47.0, lon: 11.0 });

/** Baut eine Polyline mit 1-m-Schritten aus Geraden und Kreisbögen (Start nach Norden). */
export class TrackBuilder {
  private pts: XY[] = [{ x: 0, y: 0 }];
  private heading = Math.PI / 2; // rad, 0 = Ost, π/2 = Nord

  straight(lengthM: number): this {
    return this.arcInternal(Infinity, lengthM, 1);
  }

  /** Kreisbogen: dir 'left'|'right', Radius in m, Winkel in Grad. */
  arc(dir: 'left' | 'right', radiusM: number, angleDeg: number): this {
    const arcLen = (radiusM * angleDeg * Math.PI) / 180;
    return this.arcInternal(radiusM, arcLen, dir === 'left' ? 1 : -1);
  }

  private arcInternal(radius: number, length: number, sign: 1 | -1): this {
    const n = Math.max(1, Math.round(length));
    const ds = length / n;
    for (let i = 0; i < n; i++) {
      const last = this.pts[this.pts.length - 1]!;
      const dTheta = radius === Infinity ? 0 : (sign * ds) / radius;
      const mid = this.heading + dTheta / 2;
      this.pts.push({ x: last.x + ds * Math.cos(mid), y: last.y + ds * Math.sin(mid) });
      this.heading += dTheta;
    }
    return this;
  }

  xy(): XY[] {
    return this.pts;
  }

  latLon(): LatLon[] {
    return this.pts.map((p) => proj.toLatLon(p));
  }
}
