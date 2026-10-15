import { buildRoadGraphic } from '../../src/components/curveGraphicMath';
import type { Curve } from '../../src/curves';
import { colors } from '../../src/theme';

const ASPHALT = '#262b31';
const EDGE = '#8b949c';
const LINE = '#00e5ff';

/** Dieselbe Zeichnung wie die Kurvengrafik der App (src/components/CurveGraphic.tsx), als SVG-Text. */
export function curveSvg(
  curve: Curve,
  w: number,
  h: number,
  opts: { progressM?: number; driveSide?: 'right' | 'left'; showLine?: boolean } = {},
): string {
  const g = buildRoadGraphic(curve, w, h, 36, opts.progressM, 5, opts.driveSide ?? 'right');
  const color = colors.grade[curve.grade - 1];
  const rw = g.roadWidth;
  const line =
    opts.showLine === false
      ? ''
      : `<path d="${g.line}" stroke="#000" stroke-width="${g.lineWidth + 3.5}" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.6"/>
         <path d="${g.line}" stroke="${LINE}" stroke-width="${g.lineWidth}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
         <circle cx="${g.rider.x}" cy="${g.rider.y}" r="${g.riderRadius}" fill="${LINE}" stroke="#000" stroke-width="2"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Kurvengrafik: ${curve.direction === 'left' ? 'Links' : 'Rechts'} ${curve.grade}">
    <path d="${g.center}" stroke="${EDGE}" stroke-width="${rw + 4}" stroke-linejoin="round" fill="none"/>
    <path d="${g.curve}" stroke="${color}" stroke-width="${rw + 4}" stroke-linejoin="round" fill="none"/>
    <path d="${g.center}" stroke="${ASPHALT}" stroke-width="${rw - 5}" stroke-linejoin="round" fill="none"/>
    <path d="${g.center}" stroke="#e8e8e8" stroke-width="2" stroke-dasharray="10 9" stroke-linejoin="round" fill="none"/>
    <line x1="${g.start.x - rw / 2}" x2="${g.start.x + rw / 2}" y1="${g.start.y}" y2="${g.start.y}" stroke="#fff" stroke-width="3"/>
    ${line}
    <text x="${g.numberAnchor.x}" y="${g.numberAnchor.y}" fill="${color}" font-size="96" font-weight="900" text-anchor="middle" font-family="-apple-system, Helvetica, Arial, sans-serif">${curve.grade}</text>
  </svg>`;
}
