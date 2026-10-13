import { detectCurves } from '../../src/curves';
import { AnnounceScheduler, leadDistance, DEFAULT_ANNOUNCE_SETTINGS } from '../../src/voice/announceScheduler';
import { announcementText, spokenDistance } from '../../src/voice/phrases';
import { TrackBuilder } from '../curves/helpers';

const t = new TrackBuilder()
  .straight(300)
  .arc('right', 60, 60)
  .arc('left', 60, 60) // direkte Folge
  .straight(400)
  .arc('left', 12, 150) // Spitzkehre
  .straight(200);
const { curves } = detectCurves(t.latLon());

describe('Vorlauf', () => {
  it('mindestens 80 m, sonst 6 s Geschwindigkeit', () => {
    expect(leadDistance(5, DEFAULT_ANNOUNCE_SETTINGS)).toBe(80);
    expect(leadDistance(25, DEFAULT_ANNOUNCE_SETTINGS)).toBe(150);
  });
});

describe('Phrasen', () => {
  it('rundet Distanzen sprechbar', () => {
    expect(spokenDistance(84)).toBe(80);
    expect(spokenDistance(237)).toBe(240);
    expect(spokenDistance(412)).toBe(400);
  });
  it('Spitzkehre und Folge', () => {
    expect(curves).toHaveLength(3);
    expect(announcementText(curves[2]!, 100)).toContain('Spitzkehre links');
    const txt = announcementText(curves[0]!, 150, [curves[1]!]);
    expect(txt).toMatch(/^In 150 Metern Rechts \d/);
    expect(txt).toContain('danach links');
  });
});

describe('AnnounceScheduler', () => {
  it('sagt erst innerhalb des Vorlaufs an, jede Kurve nur einmal', () => {
    const s = new AnnounceScheduler(curves);
    const start = curves[0]!.startDist;
    expect(s.next(start - 400, 15)).toBeNull();
    const a = s.next(start - 85, 15);
    expect(a?.curveIndex).toBe(curves[0]!.index);
    expect(s.next(start - 80, 15)).toBeNull();
  });

  it('fasst Kurvenfolgen in einer Ansage zusammen', () => {
    const s = new AnnounceScheduler(curves);
    const a = s.next(curves[0]!.startDist - 75, 10)!;
    expect(a.text).toContain('danach');
    // Folgekurve wird nicht noch einmal einzeln angesagt
    expect(s.next(curves[1]!.startDist - 60, 10)).toBeNull();
  });

  it('höhere Geschwindigkeit sagt früher an', () => {
    const slow = new AnnounceScheduler(curves).next(curves[2]!.startDist - 120, 10);
    const fast = new AnnounceScheduler(curves).next(curves[2]!.startDist - 120, 30);
    expect(slow).toBeNull();
    expect(fast).not.toBeNull();
  });

  it('überspringt Kurven, die zu spät erreicht werden', () => {
    const s = new AnnounceScheduler(curves);
    expect(s.next(curves[2]!.startDist - 10, 10)).toBeNull();
  });
});
