import { readFileSync } from 'node:fs';
import { detectCurves, DEFAULT_CURVE_CONFIG } from '../src/curves';
import { isUncertain } from '../src/curves/confidence';
import { parseGpx } from '../src/gpx/parseGpx';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run curves -- <datei.gpx>');
  process.exit(1);
}

const gpx = parseGpx(readFileSync(file, 'utf8'));
const t0 = Date.now();
const res = detectCurves(gpx.points);
const ms = Date.now() - t0;

console.log(`${gpx.name ?? file} (${gpx.kind}, ${gpx.points.length} Punkte, ${(res.length / 1000).toFixed(2)} km)`);
console.log(`${res.curves.length} Kurven in ${ms} ms\n`);
console.log('  #   Start[m]  Länge[m]  Richtung  Stufe  Rmin[m]  Winkel  Form        Konf.  Folge');
for (const c of res.curves) {
  const dir = c.direction === 'left' ? 'Links ' : 'Rechts';
  const shape = { tightening: 'zieht zu ', opening: 'öffnet   ', constant: 'gleichm.  ' }[c.shape];
  console.log(
    `${String(c.index + 1).padStart(3)}  ${c.startDist.toFixed(0).padStart(8)}  ${c.length.toFixed(0).padStart(8)}  ` +
      `${dir}    ${String(c.grade).padStart(3)}    ${c.minRadius.toFixed(0).padStart(6)}  ${c.totalAngle.toFixed(0).padStart(5)}°  ` +
      `${shape}  ${c.confidence.toFixed(2)}${isUncertain(c.confidence, DEFAULT_CURVE_CONFIG) ? '*' : ' '}  ${c.followsPrevious ? `in ${c.gapToPrevious!.toFixed(0)} m` : ''}`,
  );
}
const hist = [1, 2, 3, 4, 5, 6].map((g) => `${g}:${res.curves.filter((c) => c.grade === g).length}`).join('  ');
console.log(`\nStufen  ${hist}`);

const uncertain = res.curves.filter((c) => isUncertain(c.confidence, DEFAULT_CURVE_CONFIG)).length;
console.log(`Unsicher (Konfidenz < ${DEFAULT_CURVE_CONFIG.uncertainBelow}, mit * markiert)  ${uncertain} von ${res.curves.length}`);
