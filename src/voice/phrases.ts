import type { Curve } from '../curves';

const dirWord = (c: Curve) => (c.direction === 'left' ? 'links' : 'rechts');
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Kurzform einer einzelnen Kurve: "Rechts 3, zieht zu" bzw. "Spitzkehre links". */
export function curvePhrase(c: Curve, withShape = true): string {
  const base = c.grade === 1 ? `Spitzkehre ${dirWord(c)}` : `${cap(dirWord(c))} ${c.grade}`;
  if (!withShape || c.shape === 'constant') return base;
  return `${base}, ${c.shape === 'tightening' ? 'zieht zu' : 'öffnet'}`;
}

/** Distanz sprechbar runden: < 300 m auf 10 m, sonst auf 50 m. */
export function spokenDistance(m: number): number {
  return m < 300 ? Math.max(10, Math.round(m / 10) * 10) : Math.round(m / 50) * 50;
}

/** Vollständige Ansage; `followUps` sind direkt anschließende Kurven (Folge). */
export function announcementText(curve: Curve, distanceTo: number, followUps: Curve[] = []): string {
  const head = `In ${spokenDistance(distanceTo)} Metern ${curvePhrase(curve)}`;
  if (followUps.length === 0) return head;
  return `${head}, danach ${followUps.map((c) => curvePhrase(c, false).toLowerCase()).join(', danach ')}`;
}
