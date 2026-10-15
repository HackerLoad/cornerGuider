import type { Units, VoiceLanguage, AnnounceStyle } from '../settings';

export interface CurveInfo {
  direction: 'left' | 'right';
  grade: number;
  shape: 'tightening' | 'opening' | 'constant';
}

export interface PhraseOptions {
  language: VoiceLanguage;
  style: AnnounceStyle;
  /** „zieht zu" / „öffnet" nennen (nur im langen Stil) */
  shape: boolean;
  units: Units;
}

export const DEFAULT_PHRASE_OPTIONS: PhraseOptions = { language: 'de', style: 'long', shape: true, units: 'metric' };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const WORDS = {
  de: {
    left: 'links', right: 'rechts', hairpin: 'Spitzkehre', tightening: 'zieht zu', opening: 'öffnet',
    then: 'danach', in: 'In', meters: 'Metern', feet: 'Fuß', miles: 'Meilen',
  },
  en: {
    left: 'left', right: 'right', hairpin: 'Hairpin', tightening: 'tightening', opening: 'opening',
    then: 'then', in: 'In', meters: 'meters', feet: 'feet', miles: 'miles',
  },
} as const;

/** Einzelne Kurve: „Rechts 3, zieht zu", „Spitzkehre links" bzw. englisch „Right 3, tightening", „Hairpin left". */
export function curvePhrase(c: CurveInfo, withShape = true, language: VoiceLanguage = 'de'): string {
  const w = WORDS[language];
  const dir = c.direction === 'left' ? w.left : w.right;
  const base = c.grade === 1 ? `${w.hairpin} ${dir}` : `${cap(dir)} ${c.grade}`;
  if (!withShape || c.shape === 'constant') return base;
  return `${base}, ${c.shape === 'tightening' ? w.tightening : w.opening}`;
}

/** Distanz sprechbar runden: < 300 m auf 10 m, sonst auf 50 m. */
export function spokenDistance(m: number): number {
  return m < 300 ? Math.max(10, Math.round(m / 10) * 10) : Math.round(m / 50) * 50;
}

/** „In 240 Metern" / „In 800 Fuß" / „In 800 feet" / „In 0.3 miles". */
export function distancePhrase(m: number, units: Units, language: VoiceLanguage): string {
  const w = WORDS[language];
  if (units === 'metric') return `${w.in} ${spokenDistance(m)} ${w.meters}`;
  const feet = m * 3.28084;
  if (feet < 1000) {
    const rounded = Math.max(50, Math.round(feet / 50) * 50);
    return `${w.in} ${rounded} ${w.feet}`;
  }
  const miles = (Math.round((feet / 5280) * 10) / 10).toFixed(1);
  return `${w.in} ${language === 'de' ? miles.replace('.', ',') : miles} ${w.miles}`;
}

/** Vollständige Ansage; `followUps` sind direkt anschließende Kurven (Folge). */
export function announcementText(
  curve: CurveInfo,
  distanceTo: number,
  followUps: CurveInfo[] = [],
  opts: PhraseOptions = DEFAULT_PHRASE_OPTIONS,
): string {
  const w = WORDS[opts.language];
  const long = opts.style === 'long';
  const head = long
    ? `${distancePhrase(distanceTo, opts.units, opts.language)} ${curvePhrase(curve, opts.shape, opts.language)}`
    : curvePhrase(curve, false, opts.language);
  if (followUps.length === 0) return head;
  const tail = followUps.map((c) => curvePhrase(c, false, opts.language).toLowerCase());
  return `${head}, ${w.then} ${tail.join(`, ${w.then} `)}`;
}

/** Beispielansage für den Test-Knopf in den Einstellungen. */
export function exampleAnnouncement(opts: PhraseOptions): string {
  return announcementText(
    { direction: 'right', grade: 3, shape: 'tightening' },
    240,
    [{ direction: 'left', grade: 4, shape: 'constant' }],
    opts,
  );
}
