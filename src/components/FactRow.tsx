import { useState } from "react";
import { StyleSheet } from "react-native";
import Animated, { Easing, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import type { ExtractedFact } from "../shared/contracts";
import { fonts, palette } from "../theme";
import { Tap } from "./Pressable";
import { Text } from "./ui/Text";

const sourceLabel = (s: string) => (s === "user_text" ? "your text" : s === "image" ? "your image" : s);

/** Fact tile: pastel at 50%, radius 18, padding 14. Tap flips it (rotateY 180°, 300ms) to the source quote. Reduce Motion: crossfade. */
export function FactRow({ fact, index, color }: { fact: ExtractedFact; index: number; color: string }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const flip = useSharedValue(0);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    flip.set(withTiming(next ? 1 : 0, { duration: reduce ? 200 : 300, easing: Easing.out(Easing.cubic) }));
  };
  const front = useAnimatedStyle(() =>
    reduce
      ? { opacity: 1 - flip.value }
      : { opacity: flip.value < 0.5 ? 1 : 0, transform: [{ perspective: 800 }, { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` }] },
  );
  const back = useAnimatedStyle(() =>
    reduce
      ? { opacity: flip.value }
      : { opacity: flip.value >= 0.5 ? 1 : 0, transform: [{ perspective: 800 }, { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` }] },
  );
  const fill = { backgroundColor: color + "80" };
  return (
    <Tap
      testID={`fact-${index}`}
      accessibilityLabel={`${fact.label}: ${fact.value}`}
      accessibilityHint="Flips to show where this came from"
      accessibilityState={{ expanded: open }}
      haptic="none"
      onPress={toggle}
      style={styles.slot}
    >
      <Animated.View style={[styles.tile, fill, front]}>
        <Text style={styles.label} numberOfLines={1}>{fact.label}</Text>
        <Text style={styles.value} numberOfLines={3}>{fact.value}</Text>
      </Animated.View>
      <Animated.View style={[styles.tile, styles.back, fill, back]} pointerEvents="none">
        <Text style={styles.quote} numberOfLines={4}>“{fact.evidence.quote}”</Text>
        <Text style={styles.label} numberOfLines={1}>From {sourceLabel(fact.evidence.source)}</Text>
      </Animated.View>
    </Tap>
  );
}

const styles = StyleSheet.create({
  slot: { width: "48%", flexGrow: 1, minHeight: 104 },
  tile: { flex: 1, minHeight: 104, padding: 14, borderRadius: 18, gap: 4, backfaceVisibility: "hidden" },
  back: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "space-between" },
  label: { fontFamily: fonts.extraBold, fontSize: 11, lineHeight: 14, letterSpacing: 0.9, textTransform: "uppercase", color: palette.ink },
  value: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: palette.ink },
  quote: { fontFamily: fonts.medium, fontStyle: "italic", fontSize: 13, lineHeight: 18, color: palette.ink },
});
