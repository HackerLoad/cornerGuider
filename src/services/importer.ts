import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { buildStoredRoute, summarize, type RouteSummary } from '../routes/model';
import { saveRoute } from './routeStorage';

function nameFromUri(uri: string): string {
  const last = decodeURIComponent(uri.split('?')[0]!.split('/').pop() ?? 'Route');
  return last.replace(/\.gpx$/i, '') || 'Route';
}

/** Liest eine GPX-Datei, berechnet die Kurven und speichert die Route. */
export async function importGpxFromUri(uri: string): Promise<RouteSummary> {
  const text = await new File(uri).text();
  const route = buildStoredRoute(text, nameFromUri(uri));
  saveRoute(route);
  return summarize(route);
}

/** Öffnet die Dateiauswahl; null bei Abbruch. */
export async function pickAndImportGpx(): Promise<RouteSummary | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  const asset = res.canceled ? null : res.assets[0];
  return asset ? importGpxFromUri(asset.uri) : null;
}
