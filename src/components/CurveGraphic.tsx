import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';
import type { Curve } from '../curves';
import { colors } from '../theme';
import { fitGeometry } from './curveGraphicMath';

interface Props {
  curve: Curve;
  width: number;
  height: number;
}

/** Kurvengeometrie in Fahrtrichtung (oben), Kurvenabschnitt farbig nach Stufe, große Stufenzahl. */
export function CurveGraphic({ curve, width, height }: Props) {
  const fit = fitGeometry(curve.geometry, curve.geometryCurveStart, curve.geometryCurveEnd, width, height, 28);
  const color = colors.grade[curve.grade - 1];
  const sw = Math.max(8, Math.min(20, fit.scale * 5));
  // Position der Zahl auf der Innenseite der Kurve, weg vom Straßenverlauf
  const numX = curve.direction === 'left' ? width - 56 : 56;
  return (
    <Svg width={width} height={height}>
      <Path d={fit.full} stroke="#3a4046" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d={fit.curve} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Line
        x1={fit.start.x - sw}
        x2={fit.start.x + sw}
        y1={fit.start.y}
        y2={fit.start.y}
        stroke={colors.text}
        strokeWidth={3}
      />
      <SvgText x={numX} y={height - 20} fill={color} fontSize={96} fontWeight="900" textAnchor="middle">
        {curve.grade}
      </SvgText>
    </Svg>
  );
}
