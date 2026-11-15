import * as Haptics from "expo-haptics";
import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Text } from "./ui/Text";
import { Doodle } from "./ui/Doodle";
import { palette } from "../theme";

export const springs = {
  snappy: { damping: 18, stiffness: 320 },
  bouncy: { damping: 12, stiffness: 220 },
  gentle: { damping: 20, stiffness: 140 },
} as const;

export const success = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
export const light = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

/** Progress ring: a 2.5pt ring with one open quarter that spins. Reduce Motion: static ring. */
export function SpinRing({ size = 20, color = palette.white }: { size?: number; color?: string }) {
  const reduce = useReducedMotion();
  const turn = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    turn.set(withRepeat(withTiming(1, { duration: 800, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(turn);
  }, [reduce, turn]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 360}deg` }] }));
  return (
    <Animated.View
      testID="spin-ring"
      style={[{ width: size, height: size, borderRadius: size / 2, borderWidth: 2.5, borderColor: color, borderTopColor: "transparent" }, style]}
    />
  );
}

function Dot({ index, color }: { index: number; color: string }) {
  const reduce = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    y.set(withDelay(index * 120, withRepeat(withSequence(withTiming(-3, { duration: 240, easing: Easing.out(Easing.cubic) }), withTiming(0, { duration: 240, easing: Easing.in(Easing.cubic) })), -1, false)));
    return () => cancelAnimation(y);
  }, [reduce, index, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

/** Three dots bouncing in sequence (the "Understanding…" pill). */
export function BouncingDots({ color = palette.ink }: { color?: string }) {
  return (
    <View style={styles.dots}>
      {[0, 1, 2].map((i) => <Dot key={i} index={i} color={color} />)}
    </View>
  );
}

/** Pastel shimmer sweeping left to right every 1.2s inside its parent (parent needs overflow hidden). */
export function Shimmer({ color = palette.lavender, width = 160 }: { color?: string; width?: number }) {
  const reduce = useReducedMotion();
  const x = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    x.set(withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.cubic) }), -1, false));
    return () => cancelAnimation(x);
  }, [reduce, x]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: -width + x.value * width * 2 }] }));
  if (reduce) return null;
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { width, opacity: 0.55, backgroundColor: color }, style]} />;
}

const SPARKS = [0, 60, 120, 180, 240, 300];

function Spark({ angle, play }: { angle: number; play: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    if (!play) return;
    p.set(0);
    p.set(withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }));
  }, [play, p]);
  const rad = (angle * Math.PI) / 180;
  const style = useAnimatedStyle(() => ({
    opacity: p.value === 0 ? 0 : 1 - p.value,
    transform: [{ translateX: Math.cos(rad) * 34 * p.value }, { translateY: Math.sin(rad) * 22 * p.value }, { scale: 0.4 + p.value * 0.8 }, { rotate: `${angle}deg` }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.spark, style]}>
      <Doodle kind={angle % 120 === 0 ? "star" : "burst"} size={14} />
    </Animated.View>
  );
}

/** Ready burst: 6 doodle sparks scale out and fade around its child (600ms). Reduce Motion: nothing. */
export function Burst({ play, children }: { play: number; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <View style={styles.burst}>
      {children}
      {!reduce && play ? SPARKS.map((a) => <Spark key={a} angle={a} play={play} />) : null}
    </View>
  );
}

/** Number that counts up from 0 over 600ms. Reduce Motion: final value. */
export function CountUp({ value, style, testID }: { value: number; style?: StyleProp<TextStyle>; testID?: string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (reduce) return;
    let frame = 0;
    const start = Date.now();
    const from = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / 600);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(from + (value - from) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduce]);
  return <Text testID={testID} style={[{ fontVariant: ["tabular-nums"] }, style]}>{reduce ? value : shown}</Text>;
}

/** Spring "pop" on a value change (checkbox). */
export function usePop(on: boolean) {
  const reduce = useReducedMotion();
  const s = useSharedValue(1);
  const [prev, setPrev] = useState(on);
  if (prev !== on) {
    setPrev(on);
    if (!reduce) s.set(withSequence(withTiming(0.8, { duration: 90 }), withSpring(1, springs.bouncy)));
  }
  return useAnimatedStyle(() => ({ transform: [{ scale: s.value }] })) as StyleProp<ViewStyle>;
}

const styles = StyleSheet.create({
  dots: { flexDirection: "row", gap: 3, alignItems: "center", height: 10 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  burst: { alignSelf: "flex-start", alignItems: "center", justifyContent: "center" },
  spark: { position: "absolute" },
});
