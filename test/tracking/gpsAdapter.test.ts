import { GpsAdapter, gpsProfileForSpeed } from '../../src/tracking/adaptiveGps';

describe('GpsAdapter: Ortung im Stand sparsamer', () => {
  it('liefert beim ersten Aufruf das Fahrprofil, danach nur bei Wechsel', () => {
    const a = new GpsAdapter();
    expect(a.update(15, 0)).toEqual(gpsProfileForSpeed(15));
    expect(a.update(16, 1000)).toBeNull();
    expect(a.update(14, 2000)).toBeNull();
  });

  it('wechselt erst nach 20 s Stand ins sparsame Profil und zurück sofort bei Bewegung', () => {
    const a = new GpsAdapter();
    a.update(15, 0);
    expect(a.update(0, 1000)).toBeNull();
    expect(a.update(0, 15_000)).toBeNull();
    const eco = a.update(0, 21_500);
    expect(eco).not.toBeNull();
    expect(eco!.accuracy).toBe('balanced');
    expect(a.update(0, 30_000)).toBeNull();
    const back = a.update(8, 31_000);
    expect(back).toEqual(gpsProfileForSpeed(8));
    expect(back!.accuracy).toBe('best');
  });

  it('kurzer Halt (Ampel) setzt den Zähler bei erneuter Bewegung zurück', () => {
    const a = new GpsAdapter();
    a.update(15, 0);
    a.update(0, 1000);
    a.update(10, 15_000);
    expect(a.update(0, 16_000)).toBeNull();
    expect(a.update(0, 30_000)).toBeNull(); // erst 14 s seit dem neuen Halt
    expect(a.update(0, 37_000)).not.toBeNull();
  });

  it('die Fahrgeschwindigkeit wird nicht gedrosselt (Vorschau braucht 1 Hz)', () => {
    for (const v of [1, 5, 15, 30, 45]) {
      const p = gpsProfileForSpeed(v);
      expect(p.accuracy).toBe('best');
      expect(p.timeIntervalMs).toBe(1000);
    }
  });
});
