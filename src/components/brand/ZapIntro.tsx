import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef, useState } from "react";
import { DeviceEventEmitter, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useProfile } from "../../lib/useProfile";
import { colors, fonts, gradients, palette } from "../../theme";
import { Doodle, type DoodleKind } from "../ui/Doodle";
import { ZapMark } from "./ZapMark";

let played = false;
if (!played) (globalThis as { __zapyIntroPending?: boolean }).__zapyIntroPending = true;

/** True until the cold-start intro has finished; the root layout hides the splash itself when this is false. */
export const introWillPlay = () => !played;

const MORPH = { damping: 14, stiffness: 240, mass: 0.9 };
const ZAP = { damping: 7, stiffness: 320 };
const FUNK = { damping: 9, stiffness: 260 };
const OUT_CUBIC = Easing.out(Easing.cubic);

const MARK = 120;
const SLOT = 76;
const END_SCALE = SLOT / MARK;

const LETTERS = [
  { ch: "z", tilt: -5, from: 22, at: 620 },
  { ch: "a", tilt: 4, from: -18, at: 690 },
  { ch: "p", tilt: -3, from: 20, at: 760 },
  { ch: "y", tilt: 6, from: -16, at: 830 },
];

const CONFETTI: { angle: number; dist: number; kind: DoodleKind; size: number; fill?: string; spin: number }[] = [
  { angle: -90, dist: 150, kind: "star", size: 26, fill: palette.butter, spin: 90 },
  { angle: -54, dist: 130, kind: "squiggle", size: 24, spin: -60 },
  { angle: -18, dist: 165, kind: "circle", size: 18, fill: palette.mint, spin: 0 },
  { angle: 18, dist: 140, kind: "burst", size: 26, spin: 120 },
  { angle: 54, dist: 120, kind: "star", size: 20, fill: palette.peach, spin: -90 },
  { angle: 90, dist: 150, kind: "arrow", size: 24, spin: 45 },
  { angle: 126, dist: 125, kind: "star", size: 22, fill: palette.lavender, spin: 120 },
  { angle: 162, dist: 160, kind: "squiggle", size: 22, spin: 80 },
  { angle: 198, dist: 135, kind: "circle", size: 16, fill: palette.butter, spin: 0 },
  { angle: 234, dist: 150, kind: "burst", size: 22, spin: -120 },
];

function Letter({ ch, tilt, from, p }: { ch: string; tilt: number; from: number; p: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, p.value)),
    transform: [{ translateY: interpolate(p.value, [0, 1], [36, 0]) }, { scale: interpolate(p.value, [0, 1], [0.3, 1]) }, { rotate: `${interpolate(p.value, [0, 1], [from, tilt])}deg` }],
  }));
  return <Animated.Text style={[styles.letter, style]}>{ch}</Animated.Text>;
}

function Line({ angle, p }: { angle: number; p: SharedValue<number> }) {
  const rad = (angle * Math.PI) / 180;
  const style = useAnimatedStyle(() => {
    const r = interpolate(p.value, [0, 1], [70, 112]);
    return {
      opacity: p.value === 0 ? 0 : 1 - p.value,
      transform: [{ translateX: Math.cos(rad) * r }, { translateY: Math.sin(rad) * r }, { rotate: `${angle}deg` }, { scaleX: interpolate(p.value, [0, 1], [1, 0.4]) }],
    };
  });
  return <Animated.View style={[styles.line, style]} />;
}

function Confetti({ piece, p }: { piece: (typeof CONFETTI)[number]; p: SharedValue<number> }) {
  const rad = (piece.angle * Math.PI) / 180;
  const style = useAnimatedStyle(() => ({
    opacity: p.value === 0 ? 0 : p.value < 0.7 ? 1 : interpolate(p.value, [0.7, 1], [1, 0]),
    transform: [
      { translateX: Math.cos(rad) * piece.dist * p.value },
      { translateY: Math.sin(rad) * piece.dist * p.value },
      { rotate: `${piece.spin * p.value}deg` },
      { scale: p.value < 0.4 ? interpolate(p.value, [0, 0.4], [0, 1]) : interpolate(p.value, [0.4, 1], [1, 0.85]) },
    ],
  }));
  return (
    <Animated.View style={[styles.center, style]}>
      <Doodle kind={piece.kind} size={piece.size} fill={piece.fill} />
    </Animated.View>
  );
}

/** Cold-start "zap-in" intro (ZAPY_INTRO_SPEC). Overlays the app, hands off from the native splash, then reveals Home. */
export function ZapIntro() {
  const [done, setDone] = useState(played);
  if (done) return null;
  return <Intro onFinish={() => setDone(true)} />;
}

function Intro({ onFinish }: { onFinish: () => void }) {
  const reduce = useReducedMotion();
  const { width: W, height: H } = useWindowDimensions();
  const profile = useProfile();
  const nameRef = useRef<string | undefined>(undefined);
  const displayName = profile?.displayName;
  useEffect(() => {
    nameRef.current = displayName;
  }, [displayName]);
  const [greeting, setGreeting] = useState("Turn saves into action");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const started = useRef(false);
  const wiping = useRef(false);
  const offset = useRef(0);

  const markScale = useSharedValue(1);
  const markRot = useSharedValue(0);
  const markX = useSharedValue(0);
  const bolt = useSharedValue(1);
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const lines = useSharedValue(0);
  const letters = [useSharedValue(0), useSharedValue(0), useSharedValue(0), useSharedValue(0)];
  const marker = useSharedValue(0);
  const confetti = useSharedValue(0);
  const greet = useSharedValue(0);
  const wordmark = useSharedValue(0);
  const lockup = useSharedValue(1);
  const wipe = useSharedValue(0);
  const overlay = useSharedValue(1);
  const wipeX = useSharedValue(0);
  const all = [markScale, markRot, markX, bolt, ring1, ring2, lines, ...letters, marker, confetti, greet, wordmark, lockup, wipe, overlay];

  const at = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
  const release = () => {
    (globalThis as { __zapyIntroPending?: boolean }).__zapyIntroPending = false;
    DeviceEventEmitter.emit("zapy:introDone");
  };
  const finish = () => {
    played = true;
    onFinish();
  };

  const wipeAndReveal = (delay: number) => {
    wiping.current = true;
    const scaleTo = (2 * Math.hypot(W, H)) / SLOT;
    wipeX.set(offset.current);
    wipe.set(withDelay(delay, withTiming(scaleTo, { duration: 340, easing: Easing.in(Easing.cubic) })));
    lockup.set(withDelay(delay, withTiming(0, { duration: 120 })));
    overlay.set(withDelay(delay + 340, withTiming(0, { duration: 220, easing: Easing.out(Easing.quad) })));
    at(delay + 340, () => {
      release();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
    });
    at(delay + 560, finish);
  };

  const showFinal = () => {
    markScale.set(END_SCALE);
    markRot.set(-6);
    markX.set(offset.current);
    letters.forEach((l) => l.set(1));
    marker.set(1);
    greet.set(1);
    wordmark.set(1);
    setGreeting(nameRef.current ? `Welcome back, ${nameRef.current.split(" ")[0]}` : "Turn saves into action");
  };

  const start = () => {
    if (started.current) return;
    started.current = true;
    SplashScreen.hideAsync().catch(() => {});
    if (reduce) {
      showFinal();
      at(500, () => {
        release();
        overlay.set(withTiming(0, { duration: 200 }));
      });
      at(700, finish);
      return;
    }
    const wind = { duration: 220, easing: Easing.out(Easing.quad) };
    markScale.set(withSequence(withTiming(0.84, wind), withSpring(1, ZAP)));
    markRot.set(withSequence(withTiming(-14, wind), withSpring(0, ZAP)));
    bolt.set(withSequence(withTiming(0.25, { duration: 60 }), withTiming(1, { duration: 60 }), withTiming(0.4, { duration: 50 }), withTiming(1, { duration: 50 })));
    at(220, () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}));
    ring1.set(withDelay(220, withTiming(1, { duration: 420, easing: OUT_CUBIC })));
    ring2.set(withDelay(280, withTiming(1, { duration: 420, easing: OUT_CUBIC })));
    lines.set(withDelay(220, withTiming(1, { duration: 360, easing: OUT_CUBIC })));
    at(520, () => {
      markX.set(withSpring(offset.current, MORPH));
      markScale.set(withSpring(END_SCALE, MORPH));
      markRot.set(withSpring(-6, MORPH));
    });
    wordmark.set(withDelay(600, withTiming(1, { duration: 1 })));
    LETTERS.forEach((l, i) => {
      letters[i].set(withDelay(l.at, withSpring(1, FUNK)));
      at(l.at, () => Haptics.selectionAsync().catch(() => {}));
    });
    marker.set(withDelay(1080, withTiming(1, { duration: 260, easing: OUT_CUBIC })));
    at(1080, () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}));
    confetti.set(withDelay(1180, withTiming(1, { duration: 520, easing: OUT_CUBIC })));
    at(1250, () => {
      if (nameRef.current) setGreeting(`Welcome back, ${nameRef.current.split(" ")[0]}`);
    });
    greet.set(withDelay(1250, withTiming(1, { duration: 240, easing: OUT_CUBIC })));
    wipeAndReveal(1800);
  };

  const skip = () => {
    if (!started.current || wiping.current || reduce) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    all.forEach((v) => cancelAnimation(v));
    showFinal();
    ring1.set(1);
    ring2.set(1);
    lines.set(1);
    confetti.set(1);
    bolt.set(1);
    wipeAndReveal(0);
  };

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlay.value }));
  const markStyle = useAnimatedStyle(() => ({
    opacity: lockup.value,
    transform: [{ translateX: markX.value }, { scale: markScale.value }, { rotate: `${markRot.value}deg` }],
  }));
  const boltStyle = useAnimatedStyle(() => ({ opacity: bolt.value }));
  const ring1Style = useAnimatedStyle(() => ({ opacity: ring1.value === 0 ? 0 : interpolate(ring1.value, [0, 1], [0.9, 0]), transform: [{ scale: interpolate(ring1.value, [0, 1], [1, 2.4]) }] }));
  const ring2Style = useAnimatedStyle(() => ({ opacity: ring2.value === 0 ? 0 : interpolate(ring2.value, [0, 1], [0.8, 0]), transform: [{ scale: interpolate(ring2.value, [0, 1], [1, 2.0]) }] }));
  const lockupStyle = useAnimatedStyle(() => ({ opacity: lockup.value * wordmark.value }));
  const markerStyle = useAnimatedStyle(() => ({ transform: [{ rotate: "-2deg" }, { scaleX: marker.value }] }));
  const greetStyle = useAnimatedStyle(() => ({ opacity: greet.value * lockup.value, transform: [{ translateY: interpolate(greet.value, [0, 1], [10, 0]) }] }));
  const wipeStyle = useAnimatedStyle(() => ({ opacity: wipe.value === 0 ? 0 : 1, transform: [{ translateX: wipeX.value }, { scale: wipe.value === 0 ? 1 : wipe.value }] }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, overlayStyle]} onLayout={start} testID="zap-intro">
      <Pressable testID="zap-intro-skip" accessibilityLabel="Skip intro" style={StyleSheet.absoluteFill} onPress={skip}>
        <View style={styles.stage} pointerEvents="none">
          <Animated.View style={[styles.lockup, lockupStyle]} onLayout={(e) => (offset.current = e.nativeEvent.layout.x + SLOT / 2 - W / 2)}>
            <View style={styles.slot} />
            <View style={styles.wordmark}>
              <Animated.View style={[styles.marker, markerStyle]} />
              {LETTERS.map((l, i) => <Letter key={l.ch} ch={l.ch} tilt={l.tilt} from={l.from} p={letters[i]} />)}
            </View>
            <Animated.Text style={[styles.greeting, greetStyle]}>{greeting}</Animated.Text>
          </Animated.View>
          <Animated.View style={[styles.ring, ring1Style]} />
          <Animated.View style={[styles.ring, styles.ring2, ring2Style]} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <Line key={a} angle={a} p={lines} />)}
          {CONFETTI.map((c, i) => <Confetti key={i} piece={c} p={confetti} />)}
          <Animated.View style={[styles.center, markStyle]}>
            <ZapMark size={MARK} boltStyle={boltStyle} />
          </Animated.View>
          <Animated.View style={[styles.wipe, wipeStyle]}>
            <LinearGradient colors={gradients.holo} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { zIndex: 1000, elevation: 1000, backgroundColor: colors.background },
  stage: { flex: 1, alignItems: "center", justifyContent: "center" },
  center: { position: "absolute" },
  lockup: { flexDirection: "row", alignItems: "center", gap: 12 },
  slot: { width: SLOT, height: SLOT },
  wordmark: { flexDirection: "row", alignItems: "center" },
  letter: { fontFamily: fonts.display, fontSize: 58, lineHeight: 70, color: palette.ink, marginRight: -1 },
  marker: { position: "absolute", left: -6, right: -6, bottom: 8, height: 22, borderRadius: 6, backgroundColor: palette.butter, transformOrigin: "left center" },
  greeting: { position: "absolute", left: 0, right: 0, top: SLOT + 18, textAlign: "center", fontFamily: fonts.bold, fontSize: 16, color: colors.textSecondary },
  ring: { position: "absolute", width: MARK, height: MARK, borderRadius: MARK / 2, borderWidth: 4, borderColor: palette.ink },
  ring2: { borderWidth: 10, borderColor: palette.butter },
  line: { position: "absolute", width: 16, height: 4, borderRadius: 2, backgroundColor: palette.ink },
  wipe: { position: "absolute", width: SLOT, height: SLOT, borderRadius: SLOT / 2, overflow: "hidden" },
});
