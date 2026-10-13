/** Geteilte/„Öffnen mit"-GPX-Dateien (file:// bzw. content://) auf den Import-Screen leiten. */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  if (/^(file|content):\/\//i.test(path)) {
    return `/import?uri=${encodeURIComponent(path)}`;
  }
  return path;
}
