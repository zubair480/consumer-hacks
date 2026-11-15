import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Pressable, StyleSheet, View, type LayoutRectangle, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import Animated, { Easing, FadeIn, FadeInLeft, LinearTransition, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming, type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { colors, fonts, gradients, palette } from "../../theme";
import { Text } from "./Text";

type IconName = ComponentProps<typeof Ionicons>["name"];

const BOUNCY = { damping: 12, stiffness: 220 };
const SNAPPY = { damping: 18, stiffness: 320 };
const GENTLE = { damping: 20, stiffness: 140 };
const CAPSULE = 64;
const GAP = 12;

/** Bottom padding every tab screen's scroll content needs so the capsule never covers the last row. */
export const TAB_BAR_SPACE = 120;

type Scroll = { hidden: SharedValue<number>; squeeze: SharedValue<number> };
const ScrollContext = createContext<Scroll | null>(null);

export function TabBarScrollProvider({ children }: { children: ReactNode }) {
  const hidden = useSharedValue(0);
  const squeeze = useSharedValue(1);
  const value = useMemo(() => ({ hidden, squeeze }), [hidden, squeeze]);
  return <ScrollContext.Provider value={value}>{children}</ScrollContext.Provider>;
}

/** Spread onto a tab screen's ScrollView/FlatList: hides the capsule on scroll down, returns it on scroll up or when scrolling stops. */
export function useTabBarScroll() {
  const ctx = useContext(ScrollContext);
  const last = useRef(0);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const set = useCallback(
    (v: number) => {
      if (ctx && ctx.hidden.get() !== v) ctx.hidden.set(v);
    },
    [ctx],
  );
  useEffect(
    () => () => {
      if (settle.current) clearTimeout(settle.current);
      set(0);
    },
    [set],
  );
  return useMemo(
    () => ({
      scrollEventThrottle: 16,
      onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const y = e.nativeEvent.contentOffset.y;
        const dy = y - last.current;
        last.current = y;
        if (ctx && Math.abs(dy) > 40) ctx.squeeze.set(withSequence(withTiming(0.96, { duration: 80 }), withSpring(1, SNAPPY)));
        if (y <= 8 || dy < -6) set(0);
        else if (dy > 6) set(1);
      },
      onScrollEndDrag: () => {
        if (settle.current) clearTimeout(settle.current);
        settle.current = setTimeout(() => set(0), 400);
      },
      onMomentumScrollBegin: () => {
        if (settle.current) clearTimeout(settle.current);
      },
      onMomentumScrollEnd: () => set(0),
    }),
    [set, ctx],
  );
}

const TABS: Record<string, { icon: IconName; active: IconName; color: string; label: string }> = {
  index: { icon: "home-outline", active: "home", color: palette.butter, label: "Home" },
  library: { icon: "albums-outline", active: "albums", color: palette.lavender, label: "Library" },
  activity: { icon: "pulse-outline", active: "pulse", color: palette.mint, label: "Activity" },
  profile: { icon: "person-circle-outline", active: "person-circle", color: palette.peach, label: "Profile" },
};

const BUBBLES: { mode: "url" | "text" | "image"; label: string; icon: IconName; color: string; testID: string; dx: number; dy: number }[] = [
  { mode: "url", label: "Link", icon: "link-outline", color: palette.lavender, testID: "quick-capture-link", dx: -92, dy: -64 },
  { mode: "text", label: "Text", icon: "document-text-outline", color: palette.butter, testID: "quick-capture-text", dx: 0, dy: -104 },
  { mode: "image", label: "Photo", icon: "image-outline", color: palette.mint, testID: "quick-capture-photo", dx: 92, dy: -64 },
];

type Route = BottomTabBarProps["state"]["routes"][number];
export type InkTabBarProps = BottomTabBarProps & {
  saves?: number;
  latestResultAt?: number;
  captureOpen: boolean;
};

/** Floating ink nav capsule: one shared pastel pill, raised holographic "+" with a quick-capture fan, hides on scroll. */
export function InkTabBar({ state, descriptors, emitter, navigateToTab, saves, latestResultAt, captureOpen }: InkTabBarProps) {
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const scroll = useContext(ScrollContext);
  const active = state.routes[state.index];
  const [layouts, setLayouts] = useState<Record<string, LayoutRectangle>>({});
  const [seenAt, setSeenAt] = useState(() => Date.now());
  const [fan, setFan] = useState(false);
  const x = useSharedValue(0);
  const w = useSharedValue(0);
  const placed = useSharedValue(0);
  const onTab = useSharedValue(TABS[active.name] ? 1 : 0);
  const rise = useSharedValue(reduce ? 0 : 80);
  const fade = useSharedValue(reduce ? 0 : 1);
  const scrim = useSharedValue(0);
  const tint = useSharedValue<string>(TABS[active.name]?.color ?? palette.butter);

  useEffect(() => {
    if (reduce) fade.set(withDelay(150, withTiming(1, { duration: 200 })));
    else rise.set(withDelay(150, withSpring(0, BOUNCY)));
  }, [reduce, rise, fade]);

  if (active.name === "activity" && latestResultAt && latestResultAt > seenAt) setSeenAt(latestResultAt);

  useEffect(() => {
    scrim.set(withTiming(fan ? 1 : 0, { duration: 200 }));
  }, [fan, scrim]);

  useEffect(() => {
    onTab.set(withTiming(TABS[active.name] ? 1 : 0, { duration: 150 }));
  }, [active.name, onTab]);

  const l = layouts[active.key];
  useEffect(() => {
    if (!l) return;
    if (reduce || !placed.get()) {
      x.set(l.x);
      w.set(l.width);
    } else {
      x.set(withSpring(l.x, BOUNCY));
      w.set(withSpring(l.width, BOUNCY));
    }
    placed.set(1);
    tint.set(withTiming(TABS[active.name]?.color ?? palette.butter, { duration: 200 }));
  }, [l, active.name, reduce, x, w, placed, tint]);

  const offscreen = 100 + insets.bottom;
  const capsule = useAnimatedStyle(() => {
    const h = scroll?.hidden.value ?? 0;
    const target = h * offscreen;
    const y = reduce ? 0 : h ? withSpring(target, GENTLE) : withSpring(0, BOUNCY);
    return {
      opacity: reduce ? fade.value * (1 - h) : 1,
      transform: [{ translateY: y }, { translateY: rise.value }, { scaleX: scroll?.squeeze.value ?? 1 }],
    };
  });
  const indicator = useAnimatedStyle(() => ({ left: x.value, width: w.value, opacity: placed.value * onTab.value, backgroundColor: tint.value }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.value }));

  const press = (route: Route) => {
    setFan(false);
    const event = emitter?.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (route.key !== active.key && !event?.defaultPrevented) navigateToTab?.(route.key);
  };

  const openCapture = (mode: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setFan(false);
    router.push({ pathname: "/capture", params: { mode } });
  };

  let tabIndex = 0;
  return (
    <>
      <Animated.View pointerEvents={fan ? "auto" : "none"} style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,255,255,0.6)" }, scrimStyle]}>
        <Pressable testID="quick-capture-scrim" accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={() => setFan(false)} />
      </Animated.View>
      <View pointerEvents={fan ? "box-none" : "none"} style={{ position: "absolute", left: 0, right: 0, bottom: insets.bottom + GAP + CAPSULE + 12, height: 0 }}>
        {BUBBLES.map((b, i) => (
          <Bubble key={b.mode} bubble={b} index={i} open={fan} onPress={() => openCapture(b.mode)} />
        ))}
      </View>
      <Animated.View
        testID="ink-tab-bar"
        style={[
          { position: "absolute", left: 20, right: 20, bottom: insets.bottom + GAP, height: CAPSULE, borderRadius: CAPSULE / 2, backgroundColor: colors.primary, shadowColor: "#111111", shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 12 },
          capsule,
        ]}
      >
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10 }}>
          <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 10, height: 44, borderRadius: 22 }, indicator]} />
          {state.routes.map((route) => {
            const options = descriptors[route.key]?.options ?? {};
            if (route.name === "create") {
              return (
                <PlusButton
                  key={route.key}
                  open={fan || captureOpen}
                  pulse={saves === 0 && !fan}
                  wrapperTestID={options.tabBarButtonTestID}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setFan((f) => !f);
                  }}
                />
              );
            }
            const meta = TABS[route.name];
            if (!meta) return null;
            const focused = route.key === active.key;
            const dot = route.name === "activity" && !focused && !!latestResultAt && latestResultAt > seenAt;
            const index = tabIndex++;
            return (
              <Animated.View
                key={route.key}
                layout={reduce ? undefined : LinearTransition.springify().damping(BOUNCY.damping).stiffness(BOUNCY.stiffness)}
                onLayout={(e) => {
                  const next = e.nativeEvent.layout;
                  setLayouts((prev) => (prev[route.key]?.x === next.x && prev[route.key]?.width === next.width ? prev : { ...prev, [route.key]: next }));
                }}
              >
                <Pressable
                  testID={options.tabBarButtonTestID}
                  accessibilityRole="tab"
                  accessibilityLabel={options.tabBarAccessibilityLabel ?? meta.label}
                  accessibilityState={{ selected: focused }}
                  onPress={() => press(route)}
                  style={{ height: 44, minWidth: 44, paddingHorizontal: focused ? 14 : 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  <TabIcon meta={meta} focused={focused} index={index} dot={dot} />
                  {focused ? (
                    <Animated.View entering={reduce ? FadeIn.duration(150) : FadeInLeft.delay(120).duration(180).withInitialValues({ opacity: 0, transform: [{ translateX: -8 }] })}>
                      <Text style={{ fontFamily: fonts.extraBold, fontSize: 13, lineHeight: 16, color: colors.text }} numberOfLines={1}>
                        {meta.label}
                      </Text>
                    </Animated.View>
                  ) : null}
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      </Animated.View>
    </>
  );
}

function TabIcon({ meta, focused, index, dot }: { meta: (typeof TABS)[string]; focused: boolean; index: number; dot: boolean }) {
  const reduce = useReducedMotion();
  const enter = useSharedValue(reduce ? 1 : 0.6);
  const sy = useSharedValue(1);
  const rot = useSharedValue(0);
  const filled = useSharedValue(focused ? 1 : 0);
  const dotScale = useSharedValue(1);
  const first = useRef(true);

  useEffect(() => {
    if (!reduce) enter.set(withDelay(150 + index * 40, withSpring(1, BOUNCY)));
  }, [reduce, index, enter]);

  useEffect(() => {
    filled.set(withTiming(focused ? 1 : 0, { duration: 150 }));
    if (first.current) {
      first.current = false;
      return;
    }
    if (focused) Haptics.selectionAsync().catch(() => {});
    if (focused && !reduce) {
      sy.set(withSequence(withTiming(0.85, { duration: 80 }), withTiming(1.12, { duration: 110 }), withSpring(1, SNAPPY)));
      rot.set(withSequence(withTiming(-8, { duration: 70 }), withTiming(8, { duration: 110 }), withSpring(0, SNAPPY)));
    }
  }, [focused, reduce, filled, sy, rot]);

  useEffect(() => {
    if (dot && !reduce) dotScale.set(withRepeat(withSequence(withTiming(1.4, { duration: 180 }), withTiming(1, { duration: 180 })), 2));
  }, [dot, reduce, dotScale]);

  const wrap = useAnimatedStyle(() => ({ transform: [{ scale: enter.value }, { scaleY: sy.value }, { rotate: `${rot.value}deg` }] }));
  const outline = useAnimatedStyle(() => ({ opacity: 1 - filled.value }));
  const solid = useAnimatedStyle(() => ({ opacity: filled.value }));
  const dotStyle = useAnimatedStyle(() => ({ transform: [{ scale: dotScale.value }] }));
  return (
    <Animated.View style={[{ width: 22, height: 22 }, wrap]}>
      <Animated.View style={[StyleSheet.absoluteFill, outline]}>
        <Ionicons name={meta.icon} size={22} color="rgba(255,255,255,0.55)" />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, solid]}>
        <Ionicons name={meta.active} size={22} color={colors.text} />
      </Animated.View>
      {dot ? <Animated.View testID="tab-activity-dot" style={[{ position: "absolute", top: -1, right: -3, width: 7, height: 7, borderRadius: 3.5, backgroundColor: palette.butter }, dotStyle]} /> : null}
    </Animated.View>
  );
}

function Bubble({ bubble, index, open, onPress }: { bubble: (typeof BUBBLES)[number]; index: number; open: boolean; onPress: () => void }) {
  const reduce = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    const order = open ? index : BUBBLES.length - 1 - index;
    p.set(reduce ? withTiming(open ? 1 : 0, { duration: 200 }) : withDelay(order * 40, open ? withSpring(1, BOUNCY) : withTiming(0, { duration: 160, easing: Easing.in(Easing.cubic) })));
  }, [open, index, reduce, p]);
  const a = useAnimatedStyle(() => {
    const t = reduce ? 1 : p.value;
    return { opacity: Math.min(1, p.value * 1.4), transform: [{ translateX: bubble.dx * t }, { translateY: bubble.dy * t }, { scale: reduce ? 1 : 0.4 + 0.6 * p.value }] };
  });
  return (
    <Animated.View pointerEvents={open ? "auto" : "none"} style={[{ position: "absolute", left: "50%", top: -40, marginLeft: -36, width: 72, alignItems: "center" }, a]}>
      <Pressable testID={bubble.testID} accessibilityRole="button" accessibilityLabel={`Save a ${bubble.label.toLowerCase()}`} onPress={onPress} style={{ alignItems: "center", gap: 6 }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: bubble.color, borderWidth: 2, borderColor: colors.text, alignItems: "center", justifyContent: "center", shadowColor: "#111111", shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 6 }}>
          <Ionicons name={bubble.icon} size={22} color={colors.text} />
        </View>
        <Text style={{ fontFamily: fonts.extraBold, fontSize: 12, lineHeight: 16, color: colors.text }}>{bubble.label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function PlusButton({ open, pulse, wrapperTestID, onPress }: { open: boolean; pulse: boolean; wrapperTestID?: string; onPress: () => void }) {
  const reduce = useReducedMotion();
  const rot = useSharedValue(0);
  const ring = useSharedValue(0);
  const spin = useSharedValue(0);
  const press = useSharedValue(1);
  useEffect(() => {
    rot.set(reduce ? (open ? 45 : 0) : withSpring(open ? 45 : 0, SNAPPY));
  }, [open, reduce, rot]);
  useEffect(() => {
    if (reduce) return;
    spin.set(withRepeat(withTiming(360, { duration: 8000, easing: Easing.linear }), -1));
    return () => cancelAnimation(spin);
  }, [reduce, spin]);
  useEffect(() => {
    if (!pulse || reduce) {
      ring.set(0);
      return;
    }
    ring.set(withRepeat(withSequence(withTiming(1, { duration: 1200 }), withDelay(1300, withTiming(0, { duration: 0 }))), -1));
  }, [pulse, reduce, ring]);
  const glyph = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));
  const holo = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));
  const body = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  const halo = useAnimatedStyle(() => ({ opacity: ring.value === 0 ? 0 : 0.6 * (1 - ring.value), transform: [{ scale: 1 + 0.6 * ring.value }] }));
  return (
    <View testID={wrapperTestID} style={{ width: 64, alignItems: "center", marginTop: -20 }}>
      <Animated.View pointerEvents="none" style={[{ position: "absolute", width: 56, height: 56, borderRadius: 28, borderWidth: 3, borderColor: gradients.holo[0] }, halo]} />
      <Pressable
        testID="home-save-button"
        accessibilityRole="button"
        accessibilityLabel={open ? "Close" : "Save something"}
        onPress={onPress}
        onPressIn={() => {
          if (!reduce) press.set(withTiming(0.88, { duration: 120 }));
        }}
        onPressOut={() => {
          if (!reduce) press.set(withSpring(1, BOUNCY));
        }}
        hitSlop={6}
      >
        <Animated.View style={[{ width: 56, height: 56, borderRadius: 28, borderWidth: 3, borderColor: colors.text, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: gradients.holo[1] }, body]}>
          <Animated.View style={[{ position: "absolute", width: 80, height: 80, left: -15, top: -15 }, holo]}>
            <LinearGradient colors={gradients.holo} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }} />
          </Animated.View>
          <Animated.View style={glyph}>
            <Ionicons name="add" size={26} color={colors.text} />
          </Animated.View>
        </Animated.View>
      </Pressable>
    </View>
  );
}
