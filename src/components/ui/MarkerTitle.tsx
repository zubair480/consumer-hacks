import { View } from "react-native";
import { fonts, palette } from "../../theme";
import { Text } from "./Text";

/** Display headline (Archivo Black, caps, leading 100%) with one keyword on a pastel marker block rotated -1.5deg. Lines are manual: pass one string per line. */
export function MarkerTitle({ lines, marker, color = palette.butter, size = 38, testID }: { lines: string[]; marker: string; color?: string; size?: number; testID?: string }) {
  const style = { fontFamily: fonts.display, fontSize: size, lineHeight: size + 2, letterSpacing: -0.5, color: palette.ink };
  return (
    <View accessibilityRole="header" accessibilityLabel={lines.join(" ")} testID={testID} style={{ gap: 2 }}>
      {lines.map((line, i) => (
        <View key={i} style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: size * 0.22 }}>
          {line.split(" ").map((word, j) =>
            word.replace(/[^\p{L}\p{N}']/gu, "").toUpperCase() === marker.toUpperCase() ? (
              <View key={j} style={{ backgroundColor: color, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 2, transform: [{ rotate: "-1.5deg" }] }}>
                <Text style={style}>{word.toUpperCase()}</Text>
              </View>
            ) : (
              <Text key={j} style={style}>
                {word.toUpperCase()}
              </Text>
            ),
          )}
        </View>
      ))}
    </View>
  );
}
