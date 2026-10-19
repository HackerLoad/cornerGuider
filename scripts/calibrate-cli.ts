import { readFileSync } from 'node:fs';
import { calibrate, formatCalibration } from '../src/freeride/calibration';
import { parseRecording } from '../src/freeride/recordingFormat';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run calibrate -- <aufzeichnung.json>   (Aufzeichnung oder Export-Paket der App)');
  process.exit(1);
}

const rec = parseRecording(JSON.parse(readFileSync(file, 'utf8')));
if (!rec) {
  console.error('Keine gültige Aufzeichnung (erwartet: Format 1 oder 2, siehe docs/recording-format.md).');
  process.exit(1);
}

const minutes = ((rec.endedAt - rec.startedAt) / 60_000).toFixed(1);
console.log(`${rec.id}  (Format ${rec.schemaVersion}, ${minutes} min)`);
console.log(formatCalibration(calibrate(rec)));
