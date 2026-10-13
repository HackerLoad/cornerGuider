import { Directory, File, Paths } from 'expo-file-system';
import type { StoredRoute } from '../routes/model';

const dir = () => new Directory(Paths.document, 'routes');
const fileFor = (id: string) => new File(dir(), `${id}.json`);

export function saveRoute(route: StoredRoute): void {
  const d = dir();
  if (!d.exists) d.create({ intermediates: true });
  const f = fileFor(route.id);
  if (!f.exists) f.create();
  f.write(JSON.stringify(route));
}

export async function loadRoute(id: string): Promise<StoredRoute | null> {
  const f = fileFor(id);
  if (!f.exists) return null;
  try {
    const route = JSON.parse(await f.text()) as StoredRoute;
    return route.version === 1 ? route : null;
  } catch {
    return null;
  }
}

export function deleteRouteFile(id: string): void {
  const f = fileFor(id);
  if (f.exists) f.delete();
}
