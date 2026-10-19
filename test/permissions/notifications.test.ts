import { ensureNotificationPermission, shouldWarn, type NotificationEnv } from '../../src/permissions/notifications';

function env(over: Partial<NotificationEnv> & { granted?: boolean; answer?: 'granted' | 'denied' | 'never_ask_again' } = {}) {
  const calls = { check: 0, request: 0 };
  const e: NotificationEnv = {
    os: 'android',
    apiLevel: 34,
    check: async () => {
      calls.check++;
      return over.granted ?? false;
    },
    request: async () => {
      calls.request++;
      return over.answer ?? 'granted';
    },
    ...Object.fromEntries(Object.entries(over).filter(([k]) => ['os', 'apiLevel', 'check', 'request'].includes(k))),
  };
  return { e, calls };
}

describe('POST_NOTIFICATIONS (Android 13+)', () => {
  it('Android 12 und älter: kein Laufzeitrecht nötig, es wird nichts angefragt', async () => {
    const { e, calls } = env({ apiLevel: 32 });
    expect(await ensureNotificationPermission(e)).toBe('notNeeded');
    expect(calls).toEqual({ check: 0, request: 0 });
  });

  it('API-Stufe als Text (z. B. „33“) wird erkannt', async () => {
    const { e, calls } = env({ apiLevel: '33', answer: 'granted' });
    expect(await ensureNotificationPermission(e)).toBe('granted');
    expect(calls.request).toBe(1);
  });

  it('iOS: nicht zuständig', async () => {
    const { e, calls } = env({ os: 'ios', apiLevel: '18.0' });
    expect(await ensureNotificationPermission(e)).toBe('notNeeded');
    expect(calls).toEqual({ check: 0, request: 0 });
  });

  it('Android 13 ist die erste Stufe mit Laufzeitrecht', async () => {
    const { e, calls } = env({ apiLevel: 33, answer: 'granted' });
    expect(await ensureNotificationPermission(e)).toBe('granted');
    expect(calls.request).toBe(1);
  });

  it('bereits erteilt: kein erneuter Dialog', async () => {
    const { e, calls } = env({ granted: true });
    expect(await ensureNotificationPermission(e)).toBe('granted');
    expect(calls.request).toBe(0);
  });

  it('abgelehnt → denied, Dauerhaft abgelehnt → blocked', async () => {
    expect(await ensureNotificationPermission(env({ answer: 'denied' }).e)).toBe('denied');
    expect(await ensureNotificationPermission(env({ answer: 'never_ask_again' }).e)).toBe('blocked');
  });

  it('Fehler beim Prüfen: trotzdem anfragen; Fehler beim Anfragen: als abgelehnt behandeln (Hinweis zeigen)', async () => {
    const calls = { request: 0 };
    const r1 = await ensureNotificationPermission({
      os: 'android',
      apiLevel: 34,
      check: async () => {
        throw new Error('boom');
      },
      request: async () => {
        calls.request++;
        return 'granted';
      },
    });
    expect(r1).toBe('granted');
    expect(calls.request).toBe(1);
    const r2 = await ensureNotificationPermission({
      os: 'android',
      apiLevel: 34,
      check: async () => false,
      request: async () => {
        throw new Error('boom');
      },
    });
    expect(r2).toBe('denied');
  });

  it('Hinweis nur bei Ablehnung', () => {
    expect(shouldWarn('denied')).toBe(true);
    expect(shouldWarn('blocked')).toBe(true);
    expect(shouldWarn('granted')).toBe(false);
    expect(shouldWarn('notNeeded')).toBe(false);
  });
});
