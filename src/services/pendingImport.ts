/**
 * Adresse einer von außen geöffneten Datei („Öffnen mit", Teilen-Menü).
 * Sie wird nicht als URL-Parameter weitergereicht: Der Router dekodiert Parameter mehrfach, und Android-Adressen
 * wie `content://…/primary%3ADownload%2Ffile.gpx` werden dabei ungültig.
 */
let pending: string | null = null;
let version = 0;

export function setPendingImportUri(uri: string): void {
  pending = uri;
  version++;
}

/** Holt die Adresse und leert den Speicher; `version` ändert sich bei jeder neuen Datei (für Effekte). */
export function takePendingImportUri(): string | null {
  const uri = pending;
  pending = null;
  return uri;
}

export function pendingImportVersion(): number {
  return version;
}
