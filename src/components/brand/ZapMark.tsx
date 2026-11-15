import type { ComponentProps, ReactNode } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";

type LayerStyle = ComponentProps<typeof Animated.View>["style"];
type LayerProps = { size: number; style?: LayerStyle };

function Layer({ size, style, children }: LayerProps & { children: ReactNode }) {
  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 0, left: 0, width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 120 120">
        {children}
      </Svg>
    </Animated.View>
  );
}

export function ZapDisc({ size, style }: LayerProps) {
  return (
    <Layer size={size} style={style}>
      <Defs>
        <LinearGradient id="zapHolo" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFD1E3" />
          <Stop offset="0.35" stopColor="#FFF2B3" />
          <Stop offset="0.7" stopColor="#BFF0E6" />
          <Stop offset="1" stopColor="#D3DAFF" />
        </LinearGradient>
      </Defs>
      <Circle cx="60" cy="60" r="58" fill="#FFFFFF" />
      <Circle cx="60" cy="60" r="53.5" fill="url(#zapHolo)" stroke="#111111" strokeWidth="5" />
    </Layer>
  );
}

export function ZapBolt({ size, style }: LayerProps) {
  return (
    <Layer size={size} style={style}>
      <Path d="M38 36 H82 L54 60 H68 L38 84 H82" stroke="#111111" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Layer>
  );
}

export function ZapSparkle({ size, style }: LayerProps) {
  return (
    <Layer size={size} style={style}>
      <Path d="M104 6 Q105.6 16.4 116 18 Q105.6 19.6 104 30 Q102.4 19.6 92 18 Q102.4 16.4 104 6 Z" fill="#F8E58C" stroke="#111111" strokeWidth="2.5" strokeLinejoin="round" />
    </Layer>
  );
}

/** Zapy logo sticker: holo disc, Z-shaped lightning bolt, butter sparkle. Three stacked layers so the intro can animate each one. */
export function ZapMark({ size, boltStyle }: { size: number; boltStyle?: LayerStyle }) {
  return (
    <View style={{ width: size, height: size }} accessibilityRole="image" accessibilityLabel="Zapy">
      <ZapDisc size={size} />
      <ZapBolt size={size} style={boltStyle} />
      <ZapSparkle size={size} />
    </View>
  );
}
