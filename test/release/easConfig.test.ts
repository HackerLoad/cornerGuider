import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '../..');
const eas = JSON.parse(readFileSync(join(root, 'eas.json'), 'utf8')) as {
  cli?: { appVersionSource?: string };
  build: Record<string, { developmentClient?: boolean; distribution?: string; autoIncrement?: boolean; extends?: string; env?: Record<string, string>; ios?: { image?: string; simulator?: boolean } }>;
};

describe('eas.json (Store-Builds nur über EAS-Cloud)', () => {
  it('hat die drei Profile development, preview (intern) und production', () => {
    expect(eas.build.development).toMatchObject({ developmentClient: true, distribution: 'internal' });
    expect(eas.build.preview).toMatchObject({ distribution: 'internal' });
    expect(eas.build.production).toBeDefined();
    expect(eas.build.production!.distribution ?? 'store').toBe('store');
  });

  it('Store-Builds laufen mit dem neuesten Build-Image (Xcode 26 / iOS-26-SDK, Pflicht seit 28.04.2026)', () => {
    expect(eas.build.production!.ios?.image).toBe('latest');
    expect(eas.build.preview!.ios?.image).toBe('latest');
  });

  it('Build-Nummern zählt EAS (remote) hoch', () => {
    expect(eas.cli?.appVersionSource).toBe('remote');
    expect(eas.build.production!.autoIncrement).toBe(true);
  });

  it('Produktion sperrt die öffentlichen Overpass-Server', () => {
    expect(eas.build.production!.env?.ROAD_DATA_ALLOW_PUBLIC).toBe('false');
  });

  it('Entwicklung und Vorschau sperren sie nicht (Tests brauchen Daten)', () => {
    expect(eas.build.development!.env?.ROAD_DATA_ALLOW_PUBLIC).toBeUndefined();
    expect(eas.build.preview!.env?.ROAD_DATA_ALLOW_PUBLIC).toBeUndefined();
  });
});

describe('native Ordner gehören nicht ins Repo', () => {
  it('ios/ und android/ stehen in .gitignore, damit EAS in der Cloud frisch per Prebuild baut', () => {
    const ignore = readFileSync(join(root, '.gitignore'), 'utf8').split('\n').map((l) => l.trim());
    expect(ignore).toContain('ios/');
    expect(ignore).toContain('android/');
  });

  it('alle Bilder der Live-Aktivität liegen im Repo (das Plugin kopiert sie beim Prebuild; in der Cloud gibt es nur getrackte Dateien)', () => {
    const names = [
      ...[1, 2, 3, 4, 5, 6].flatMap((g) => [`curve_left_${g}`, `curve_right_${g}`]),
      'finish',
      'gps',
      'offroute',
    ];
    for (const n of names) expect(existsSync(join(root, 'assets/liveActivity', `${n}.png`))).toBe(true);
    const tracked = execFileSync('git', ['ls-files', 'assets/liveActivity'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
    expect(tracked).toHaveLength(names.length);
  });
});
