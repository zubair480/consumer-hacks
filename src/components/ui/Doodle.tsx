import Svg, { Circle, Path } from "react-native-svg";
import { palette } from "../../theme";

export type DoodleKind = "star" | "burst" | "squiggle" | "circle" | "arrow";

const PATHS: Record<Exclude<DoodleKind, "circle">, string> = {
  star: "M24 4 L29 18 L44 19 L32 28 L36 43 L24 34 L12 43 L16 28 L4 19 L19 18 Z",
  burst: "M24 2 V12 M24 36 V46 M2 24 H12 M36 24 H46 M8 8 L15 15 M33 33 L40 40 M40 8 L33 15 M15 33 L8 40",
  squiggle: "M3 30 C 9 14, 15 14, 18 26 S 27 40, 31 24 S 41 10, 45 22",
  arrow: "M6 38 C 14 18, 26 10, 40 12 M32 5 L41 12 L33 19",
};

/** Hand-drawn accent (refA/refB): ink stroke 2.5, no fill or one pastel fill. */
export function Doodle({ kind, size = 40, fill, color = palette.ink }: { kind: DoodleKind; size?: number; fill?: string; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" pointerEvents="none">
      {kind === "circle" ? (
        <Circle cx={24} cy={24} r={18} stroke={color} strokeWidth={2.5} fill={fill ?? "none"} />
      ) : (
        <Path d={PATHS[kind]} stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill={kind === "star" ? (fill ?? "none") : "none"} />
      )}
    </Svg>
  );
}
