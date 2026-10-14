import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import type { Curve } from '../curves';
import { colors } from '../theme';
import { buildRoadGraphic } from './curveGraphicMath';

interface Props {
  curve: Curve;
  width: number;
  height: number;
  /** Position des Fahrers relativ zum Kurvenanfang in m (negativ = noch davor) */
  progressM?: number;
}

const ASPHALT = '#262b31';
const EDGE = '#8b949c';
const LINE = '#00e5ff';

/**
 * Zweispurige Straße in Fahrtrichtung (oben): eigene Spur rechts, Gegenspur links, gestrichelte
 * Mittellinie, Kurvenabschnitt am Rand in der Farbe der Stufe, dazu die Fahrlinie in der eigenen Spur.
 */
export function CurveGraphic({ curve, width, height, progressM }: Props) {
  const g = buildRoadGraphic(curve, width, height, 36, progressM);
  const color = colors.grade[curve.grade - 1];
  const w = g.roadWidth;
  return (
    <Svg width={width} height={height}>
      {/* Fahrbahnrand */}
      <Path d={g.center} stroke={EDGE} strokeWidth={w} strokeLinejoin="round" fill="none" />
      {/* Kurvenabschnitt: Rand in Stufenfarbe */}
      <Path d={g.curve} stroke={color} strokeWidth={w + 4} strokeLinejoin="round" fill="none" />
      {/* Asphalt */}
      <Path d={g.center} stroke={ASPHALT} strokeWidth={w - 5} strokeLinejoin="round" fill="none" />
      {/* Mittellinie, trennt Gegenspur und eigene Spur */}
      <Path d={g.center} stroke="#e8e8e8" strokeWidth={2} strokeDasharray="10 9" strokeLinejoin="round" fill="none" />
      {/* Kurvenanfang */}
      <Line x1={g.start.x - w / 2} x2={g.start.x + w / 2} y1={g.start.y} y2={g.start.y} stroke={colors.text} strokeWidth={3} />
      {/* Fahrlinie (mit dunkler Kontur) */}
      <Path d={g.line} stroke="#000" strokeWidth={g.lineWidth + 3.5} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.6} />
      <Path d={g.line} stroke={LINE} strokeWidth={g.lineWidth} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Circle cx={g.rider.x} cy={g.rider.y} r={g.riderRadius} fill={LINE} stroke="#000" strokeWidth={2} />
      <SvgText x={g.numberAnchor.x} y={g.numberAnchor.y} fill={color} fontSize={96} fontWeight="900" textAnchor="middle">
        {curve.grade}
      </SvgText>
    </Svg>
  );
}
