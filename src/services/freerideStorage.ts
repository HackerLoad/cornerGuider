import { Directory, File, Paths } from 'expo-file-system';
import type { FreerideRecording } from '../freeride/session';

const dir = () => new Directory(Paths.document, 'freeride');
const fileFor = (id: string) => new File(dir(), `${id}.json`);

export interface RecordingInfo {
  id: string;
  startedAt: number;
}

export function saveRecording(rec: FreerideRecording): void {
  const d = dir();
  if (!d.exists) d.create({ intermediates: true });
  const f = fileFor(rec.id);
  if (!f.exists) f.create();
  f.write(JSON.stringify(rec));
}

export async function loadRecording(id: string): Promise<FreerideRecording | null> {
  const f = fileFor(id);
  if (!f.exists) return null;
  try {
    const rec = JSON.parse(await f.text()) as FreerideRecording;
    return rec.version === 1 ? rec : null;
  } catch {
    return null;
  }
}

/** Aufzeichnungen, neueste zuerst. Der Zeitstempel steckt (base36) im Dateinamen. */
export function listRecordings(): RecordingInfo[] {
  const d = dir();
  if (!d.exists) return [];
  return d
    .list()
    .filter((e): e is File => e instanceof File && e.name.endsWith('.json'))
    .map((e) => {
      const id = e.name.replace(/\.json$/, '');
      return { id, startedAt: parseInt(id.split('-')[0] ?? '0', 36) };
    })
    .sort((a, b) => b.startedAt - a.startedAt);
}

export function deleteRecording(id: string): void {
  const f = fileFor(id);
  if (f.exists) f.delete();
}
