import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import {
  DeviceEventEmitter,
  Pressable,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInLeft,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, {
  ClipPath,
  Defs,
  LinearGradient as SvgGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { colors, fonts, gradients, palette } from "../../theme";
import { Text } from "./Text";

type IconName = ComponentProps<typeof Ionicons>["name"];

const BOUNCY = { damping: 12, stiffness: 220 };
const SNAPPY = { damping: 18, stiffness: 320 };
const GENTLE = { damping: 20, stiffness: 140 };
const MORPH = { damping: 14, stiffness: 240, mass: 0.9 };
const DOCK = 68;
const GAP = 10;
const SPACER = 90;
const AnimatedRect = Animated.createAnimatedComponent(Rect);

/** Bottom padding every tab screen's scroll content needs so the capsule never covers the last row. */
export const TAB_BAR_SPACE = 132;

type Scroll = { hidden: SharedValue<number>; squeeze: SharedValue<number> };
const ScrollContext = createContext<Scroll | null>(null);

export function TabBarScrollProvider({ children }: { children: ReactNode }) {
  const hidden = useSharedValue(0);
  const squeeze = useSharedValue(1);
  const value = useMemo(() => ({ hidden, squeeze }), [hidden, squeeze]);
  return (
    <ScrollContext.Provider value={value}>{children}</ScrollContext.Provider>
  );
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
        if (ctx && Math.abs(dy) > 40)
          ctx.squeeze.set(
            withSequence(
              withTiming(0.96, { duration: 80 }),
              withSpring(1, SNAPPY),
            ),
          );
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

const TABS: Record<
  string,
  {
    icon: IconName;
    active: IconName;
    color: string;
    label: string;
    a11y: string;
    tilt: number;
  }
> = {
  index: {
    icon: "home-outline",
    active: "home",
    color: palette.butter,
    label: "Home",
    a11y: "Home",
    tilt: -4,
  },
  profile: {
    icon: "person-circle-outline",
    active: "person-circle",
    color: palette.peach,
    label: "You",
    a11y: "Profile",
    tilt: 4,
  },
};

const BUBBLES: {
  mode: "url" | "text" | "image";
  label: string;
  icon: IconName;
  color: string;
  testID: string;
  dx: number;
  dy: number;
  tilt: number;
}[] = [
  {
    mode: "url",
    label: "Link",
    icon: "link-outline",
    color: palette.lavender,
    testID: "quick-capture-link",
    dx: -87,
    dy: -50,
    tilt: -8,
  },
  {
    mode: "text",
    label: "Text",
    icon: "document-text-outline",
    color: palette.butter,
    testID: "quick-capture-text",
    dx: 0,
    dy: -100,
    tilt: 0,
  },
  {
    mode: "image",
    label: "Photo",
    icon: "image-outline",
    color: palette.mint,
    testID: "quick-capture-photo",
    dx: 87,
    dy: -50,
    tilt: 8,
  },
];

export function dockPath(W: number) {
  const cx = W / 2;
  return [
    "M 34,0",
    `L ${cx - 44.5},0`,
    `A 10 10 0 0 1 ${cx - 35.23},6.25`,
    `A 38 38 0 0 0 ${cx + 35.23},6.25`,
    `A 10 10 0 0 1 ${cx + 44.5},0`,
    `L ${W - 34},0`,
    `A 34 34 0 0 1 ${W},34`,
    `A 34 34 0 0 1 ${W - 34},68`,
    "L 34,68",
    "A 34 34 0 0 1 0,34",
    "A 34 34 0 0 1 34,0",
    "Z",
  ].join(" ");
}

/** Tabs before the notch share the left half and the rest share the right half, so a lone tab on either side is centered there. */
const slotWidth = (W: number, i: number, count: number, left: number) => {
  const side = (W - 16 - SPACER) / 2;
  return i < left ? side / Math.max(1, left) : side / Math.max(1, count - left);
};
const slotCenter = (W: number, i: number, count: number, left: number) => {
  const side = (W - 16 - SPACER) / 2;
  const w = slotWidth(W, i, count, left);
  return i < left ? 8 + w * (i + 0.5) : 8 + side + SPACER + w * (i - left + 0.5);
};

type Route = BottomTabBarProps["state"]["routes"][number];
export type InkTabBarProps = BottomTabBarProps & {
  saves?: number;
  latestResultAt?: number;
  captureOpen: boolean;
};

const introPending = () =>
  (globalThis as { __zapyIntroPending?: boolean }).__zapyIntroPending === true;

/** Notched ink dock: tilted pastel sticker tag on the active tab, holographic Save sticker in the notch with a quick-capture fan, hides on scroll. */
export function InkTabBar({
  state,
  descriptors,
  emitter,
  navigateToTab,
  saves,
  latestResultAt,
  captureOpen,
}: InkTabBarProps) {
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const scroll = useContext(ScrollContext);
  const active = state.routes[state.index];
  const tabRoutes = state.routes.filter((r) => TABS[r.name]);
  const createAt = state.routes.findIndex((r) => r.name === "create");
  const leftCount = tabRoutes.filter((r) => state.routes.indexOf(r) < createAt).length;
  const activeSlot = tabRoutes.findIndex((r) => r.key === active.key);
  const activeMeta = TABS[active.name];
  const [W, setW] = useState(0);
  const [seenAt, setSeenAt] = useState(() => Date.now());
  const [fan, setFan] = useState(false);
  const [started, setStarted] = useState(() => !introPending());
  const x = useSharedValue(0);
  const tilt = useSharedValue(activeMeta?.tilt ?? 0);
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);
  const tagFade = useSharedValue(1);
  const placed = useSharedValue(0);
  const onTab = useSharedValue(activeSlot >= 0 ? 1 : 0);
  const rise = useSharedValue(reduce ? 0 : 90);
  const fade = useSharedValue(reduce ? 0 : 1);
  const scrim = useSharedValue(0);
  const tint = useSharedValue<string>(activeMeta?.color ?? palette.butter);
  const burstX = useSharedValue(0);
  const burst = useSharedValue(0);
  const burstColor = useSharedValue<string>(
    activeMeta?.color ?? palette.butter,
  );
  const sweep = useSharedValue(-90);

  useEffect(() => {
    if (started) return;
    const sub = DeviceEventEmitter.addListener("zapy:introDone", () =>
      setStarted(true),
    );
    const timer = setTimeout(() => setStarted(true), 4000);
    return () => {
      sub.remove();
      clearTimeout(timer);
    };
  }, [started]);

  useEffect(() => {
    if (!started) return;
    if (reduce) fade.set(withTiming(1, { duration: 200 }));
    else rise.set(withDelay(150, withSpring(0, BOUNCY)));
  }, [started, reduce, rise, fade]);

  useEffect(() => {
    if (reduce || W <= 0) return;
    sweep.set(-90);
    sweep.set(
      withRepeat(
        withSequence(
          withTiming(W + 90, {
            duration: 1200,
            easing: Easing.inOut(Easing.quad),
          }),
          withDelay(6000, withTiming(-90, { duration: 0 })),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(sweep);
  }, [W, reduce, sweep]);

  if (active.name === "activity" && latestResultAt && latestResultAt > seenAt)
    setSeenAt(latestResultAt);

  useEffect(() => {
    scrim.set(withTiming(fan ? 1 : 0, { duration: 200 }));
  }, [fan, scrim]);

  useEffect(() => {
    onTab.set(withTiming(activeSlot >= 0 ? 1 : 0, { duration: 150 }));
  }, [activeSlot, onTab]);

  useEffect(() => {
    if (W <= 0 || activeSlot < 0) return;
    const cx = slotCenter(W, activeSlot, tabRoutes.length, leftCount);
    const meta = TABS[active.name];
    const color = meta?.color ?? palette.butter;
    if (!placed.get()) {
      x.set(cx);
      tilt.set(meta?.tilt ?? 0);
      tint.set(color);
      placed.set(1);
      return;
    }
    tint.set(withTiming(color, { duration: 180 }));
    if (reduce) {
      x.set(cx);
      tilt.set(meta?.tilt ?? 0);
      tagFade.set(0);
      tagFade.set(withTiming(1, { duration: 150 }));
      return;
    }
    x.set(withSpring(cx, MORPH));
    tilt.set(
      withSequence(
        withTiming(0, { duration: 90 }),
        withSpring(meta?.tilt ?? 0, { damping: 8, stiffness: 260 }),
      ),
    );
    sy.set(
      withSequence(
        withTiming(1, { duration: 120 }),
        withTiming(0.88, { duration: 70 }),
        withSpring(1, BOUNCY),
      ),
    );
    sx.set(
      withSequence(
        withTiming(1, { duration: 120 }),
        withTiming(1.08, { duration: 70 }),
        withSpring(1, BOUNCY),
      ),
    );
    burstX.set(cx);
    burstColor.set(color);
    burst.set(0);
    burst.set(
      withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }),
    );
  }, [
    W,
    tabRoutes.length,
    leftCount,
    activeSlot,
    active.name,
    reduce,
    x,
    tilt,
    sx,
    sy,
    tint,
    tagFade,
    placed,
    burst,
    burstX,
    burstColor,
  ]);

  const offscreen = 100 + insets.bottom;
  const dock = useAnimatedStyle(() => {
    const h = scroll?.hidden.value ?? 0;
    const y = reduce
      ? 0
      : h
        ? withSpring(h * offscreen, GENTLE)
        : withSpring(0, BOUNCY);
    return {
      opacity: reduce ? fade.value * (1 - h) : 1,
      transform: [
        { translateY: y },
        { translateY: rise.value },
        { scaleX: scroll?.squeeze.value ?? 1 },
      ],
    };
  });
  const tag = useAnimatedStyle(() => ({
    left: x.value - 30,
    opacity: placed.value * tagFade.value * onTab.value,
    backgroundColor: tint.value,
    transform: [
      { rotate: `${tilt.value}deg` },
      { scaleX: sx.value },
      { scaleY: sy.value },
    ],
  }));
  const ring = useAnimatedStyle(() => ({
    left: burstX.value - 22,
    borderColor: burstColor.value,
    opacity:
      burst.value === 0 || burst.value === 1 ? 0 : 0.7 * (1 - burst.value),
    transform: [{ scale: 0.6 + 1.1 * burst.value }],
  }));
  const sweepProps = useAnimatedProps(() => ({ x: sweep.value }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.value }));

  const press = (route: Route) => {
    setFan(false);
    const event = emitter?.emit({
      type: "tabPress",
      target: route.key,
      canPreventDefault: true,
    });
    if (route.key !== active.key && !event?.defaultPrevented)
      navigateToTab?.(route.key);
  };

  const openCapture = (mode: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setFan(false);
    router.push({ pathname: "/capture", params: { mode } });
  };

  const createRoute = state.routes.find((r) => r.name === "create");
  const path = W > 0 ? dockPath(W) : "";
  return (
    <>
      <Animated.View
        pointerEvents={fan ? "auto" : "none"}
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: "rgba(255,255,255,0.72)" },
          scrimStyle,
        ]}
      >
        <Pressable
          testID="quick-capture-scrim"
          accessibilityLabel="Close"
          style={StyleSheet.absoluteFill}
          onPress={() => setFan(false)}
        />
      </Animated.View>
      <View
        pointerEvents={fan ? "box-none" : "none"}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: insets.bottom + GAP + DOCK + 8,
          height: 0,
        }}
      >
        {BUBBLES.map((b, i) => (
          <Bubble
            key={b.mode}
            bubble={b}
            index={i}
            open={fan}
            onPress={() => openCapture(b.mode)}
          />
        ))}
      </View>
      <Animated.View
        testID="ink-tab-bar"
        onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}
        style={[
          {
            position: "absolute",
            left: 16,
            right: 16,
            bottom: insets.bottom + GAP,
            height: DOCK,
            backgroundColor: "transparent",
            shadowColor: "#111111",
            shadowOpacity: 0.25,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 10 },
            elevation: 12,
          },
          dock,
        ]}
      >
        {W > 0 ? (
          <>
            <Svg width={W} height={DOCK} style={StyleSheet.absoluteFill}>
              <Defs>
                <ClipPath id="dockClip">
                  <Path d={path} />
                </ClipPath>
                <SvgGradient id="dockSweep" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
                  <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.1} />
                  <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
                </SvgGradient>
              </Defs>
              <Path d={path} fill={palette.ink} />
              {reduce ? null : (
                <AnimatedRect
                  animatedProps={sweepProps}
                  y={0}
                  width={70}
                  height={DOCK}
                  skewX={-20}
                  fill="url(#dockSweep)"
                  clipPath="url(#dockClip)"
                />
              )}
              <Path
                d={path}
                fill="none"
                stroke="rgba(255,255,255,0.10)"
                strokeWidth={1}
              />
            </Svg>
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: "absolute",
                  top: 12,
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  borderWidth: 2,
                },
                ring,
              ]}
            />
            <Animated.View
              testID="dock-tag"
              pointerEvents="none"
              style={[
                {
                  position: "absolute",
                  top: 9,
                  width: 60,
                  height: 50,
                  borderRadius: 16,
                },
                tag,
              ]}
            >
              <View
                style={{
                  position: "absolute",
                  top: 6,
                  left: 8,
                  width: 12,
                  height: 3,
                  borderRadius: 1.5,
                  backgroundColor: "rgba(255,255,255,0.5)",
                  transform: [{ rotate: "-20deg" }],
                }}
              />
            </Animated.View>
            <View
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 8,
              }}
            >
              {state.routes.map((route) => {
                const options = descriptors[route.key]?.options ?? {};
                if (route.name === "create")
                  return (
                    <View
                      key={route.key}
                      testID={options.tabBarButtonTestID}
                      style={{ width: SPACER, height: DOCK }}
                    />
                  );
                const meta = TABS[route.name];
                if (!meta) return null;
                const focused = route.key === active.key;
                const dot =
                  route.name === "activity" &&
                  !focused &&
                  !!latestResultAt &&
                  latestResultAt > seenAt;
                const index = tabRoutes.indexOf(route);
                return (
                  <Pressable
                    key={route.key}
                    testID={options.tabBarButtonTestID}
                    accessibilityRole="tab"
                    accessibilityLabel={
                      options.tabBarAccessibilityLabel ?? meta.a11y
                    }
                    accessibilityState={{ selected: focused }}
                    onPress={() => press(route)}
                    hitSlop={4}
                    style={{
                      width: slotWidth(W, index, tabRoutes.length, leftCount),
                      height: 52,
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 2,
                    }}
                  >
                    <TabIcon
                      meta={meta}
                      focused={focused}
                      index={index}
                      dot={dot}
                      started={started}
                    />
                    {focused ? (
                      <Animated.View
                        key={route.key}
                        entering={
                          reduce
                            ? FadeIn.duration(140)
                            : FadeInLeft.delay(80)
                                .duration(140)
                                .withInitialValues({
                                  opacity: 0,
                                  transform: [{ translateX: 0 }],
                                })
                        }
                      >
                        <Text
                          style={{
                            fontFamily: fonts.extraBold,
                            fontSize: 10,
                            lineHeight: 12,
                            letterSpacing: 0.3,
                            color: colors.text,
                          }}
                          numberOfLines={1}
                        >
                          {meta.label}
                        </Text>
                      </Animated.View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}
      </Animated.View>
      {createRoute && W > 0 ? (
        <Animated.View
          style={[
            {
              position: "absolute",
              bottom: insets.bottom + GAP + DOCK - 24,
              left: 16 + W / 2 - 32,
              zIndex: 20,
              elevation: 14,
            },
            dock,
          ]}
        >
          <SaveSticker
            open={fan || captureOpen}
            pulse={saves === 0 && !fan}
            started={started}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                () => {},
              );
              setFan((f) => !f);
            }}
            onLongPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
                () => {},
              );
              setFan(false);
              router.push({ pathname: "/capture", params: { mode: "url" } });
            }}
          />
        </Animated.View>
      ) : null}
    </>
  );
}

function TabIcon({
  meta,
  focused,
  index,
  dot,
  started,
}: {
  meta: (typeof TABS)[string];
  focused: boolean;
  index: number;
  dot: boolean;
  started: boolean;
}) {
  const reduce = useReducedMotion();
  const enter = useSharedValue(reduce ? 1 : 0.6);
  const sy = useSharedValue(1);
  const rot = useSharedValue(0);
  const filled = useSharedValue(focused ? 1 : 0);
  const dotScale = useSharedValue(1);
  const first = useRef(true);

  useEffect(() => {
    if (!reduce && started)
      enter.set(withDelay(150 + index * 40, withSpring(1, BOUNCY)));
  }, [reduce, index, enter, started]);

  useEffect(() => {
    filled.set(withTiming(focused ? 1 : 0, { duration: 150 }));
    if (first.current) {
      first.current = false;
      return;
    }
    if (focused) Haptics.selectionAsync().catch(() => {});
    if (focused && !reduce) {
      sy.set(
        withSequence(
          withTiming(0.85, { duration: 80 }),
          withTiming(1.12, { duration: 110 }),
          withSpring(1, SNAPPY),
        ),
      );
      rot.set(
        withSequence(
          withTiming(-8, { duration: 70 }),
          withTiming(8, { duration: 110 }),
          withSpring(0, SNAPPY),
        ),
      );
    }
  }, [focused, reduce, filled, sy, rot]);

  useEffect(() => {
    if (dot && !reduce)
      dotScale.set(
        withRepeat(
          withSequence(
            withTiming(1.4, { duration: 180 }),
            withTiming(1, { duration: 180 }),
          ),
          2,
        ),
      );
  }, [dot, reduce, dotScale]);

  const size = focused ? 20 : 22;
  const wrap = useAnimatedStyle(() => ({
    transform: [
      { scale: enter.value },
      { scaleY: sy.value },
      { rotate: `${rot.value}deg` },
    ],
  }));
  const outline = useAnimatedStyle(() => ({ opacity: 1 - filled.value }));
  const solid = useAnimatedStyle(() => ({ opacity: filled.value }));
  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dotScale.value }],
  }));
  return (
    <Animated.View style={[{ width: size, height: size }, wrap]}>
      <Animated.View style={[StyleSheet.absoluteFill, outline]}>
        <Ionicons name={meta.icon} size={size} color="rgba(255,255,255,0.55)" />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, solid]}>
        <Ionicons name={meta.active} size={size} color={colors.text} />
      </Animated.View>
      {dot ? (
        <Animated.View
          testID="tab-activity-dot"
          style={[
            {
              position: "absolute",
              top: -1,
              right: -3,
              width: 7,
              height: 7,
              borderRadius: 3.5,
              backgroundColor: palette.butter,
            },
            dotStyle,
          ]}
        />
      ) : null}
    </Animated.View>
  );
}

function Bubble({
  bubble,
  index,
  open,
  onPress,
}: {
  bubble: (typeof BUBBLES)[number];
  index: number;
  open: boolean;
  onPress: () => void;
}) {
  const reduce = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    if (reduce) {
      p.set(withTiming(open ? 1 : 0, { duration: 200 }));
      return;
    }
    p.set(
      open
        ? withDelay(index * 45, withSpring(1, BOUNCY))
        : withDelay(
            (BUBBLES.length - 1 - index) * 30,
            withTiming(0, { duration: 160, easing: Easing.in(Easing.cubic) }),
          ),
    );
  }, [open, index, reduce, p]);
  const a = useAnimatedStyle(() => {
    const t = reduce ? 1 : p.value;
    return {
      opacity: Math.min(1, p.value * 1.4),
      transform: [
        { translateX: bubble.dx * t },
        { translateY: bubble.dy * t },
        { rotate: `${bubble.tilt * t}deg` },
        { scale: reduce ? 1 : 0.4 + 0.6 * p.value },
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents={open ? "auto" : "none"}
      style={[
        {
          position: "absolute",
          left: "50%",
          top: -26,
          marginLeft: -36,
          width: 72,
          alignItems: "center",
        },
        a,
      ]}
    >
      <Pressable
        testID={bubble.testID}
        accessibilityRole="button"
        accessibilityLabel={`Save a ${bubble.label.toLowerCase()}`}
        onPress={onPress}
        style={{ alignItems: "center", gap: 6 }}
      >
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: bubble.color,
            borderWidth: 2,
            borderColor: colors.text,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: "#111111",
            shadowOpacity: 0.12,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 8 },
            elevation: 6,
          }}
        >
          <Ionicons name={bubble.icon} size={22} color={colors.text} />
        </View>
        <View
          style={{
            height: 22,
            paddingHorizontal: 10,
            borderRadius: 11,
            backgroundColor: palette.ink,
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontFamily: fonts.extraBold,
              fontSize: 11,
              lineHeight: 14,
              color: "#FFFFFF",
            }}
          >
            {bubble.label}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function SaveSticker({
  open,
  pulse,
  started,
  onPress,
  onLongPress,
}: {
  open: boolean;
  pulse: boolean;
  started: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const reduce = useReducedMotion();
  const rot = useSharedValue(0);
  const ring = useSharedValue(0);
  const spin = useSharedValue(0);
  const press = useSharedValue(1);
  const pop = useSharedValue(reduce ? 1 : 0);
  const lean = useSharedValue(-6);
  const twinkle = useSharedValue(1);
  useEffect(() => {
    rot.set(reduce ? (open ? 45 : 0) : withSpring(open ? 45 : 0, SNAPPY));
  }, [open, reduce, rot]);
  useEffect(() => {
    if (!reduce && started)
      pop.set(withDelay(150 + 4 * 40 + 120, withSpring(1, BOUNCY)));
  }, [reduce, started, pop]);
  useEffect(() => {
    if (reduce) return;
    spin.set(
      withRepeat(
        withTiming(360, { duration: 10000, easing: Easing.linear }),
        -1,
      ),
    );
    lean.set(
      withRepeat(
        withSequence(
          withTiming(-3, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
          withTiming(-6, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      ),
    );
    twinkle.set(
      withRepeat(
        withSequence(
          withTiming(1.15, { duration: 300 }),
          withTiming(0.85, { duration: 300 }),
          withDelay(2400, withTiming(1, { duration: 0 })),
        ),
        -1,
      ),
    );
    return () => {
      cancelAnimation(spin);
      cancelAnimation(lean);
      cancelAnimation(twinkle);
    };
  }, [reduce, spin, lean, twinkle]);
  useEffect(() => {
    if (!pulse || reduce) {
      ring.set(0);
      return;
    }
    ring.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1200 }),
          withDelay(1300, withTiming(0, { duration: 0 })),
        ),
        -1,
      ),
    );
  }, [pulse, reduce, ring]);
  const glyph = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }],
  }));
  const holo = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));
  const body = useAnimatedStyle(() => ({
    transform: [
      { scale: press.value * pop.value },
      { rotate: `${lean.value}deg` },
    ],
  }));
  const sparkle = useAnimatedStyle(() => ({
    opacity: 0.5 + 0.5 * Math.min(1, Math.max(0, (twinkle.value - 0.85) / 0.3)),
    transform: [{ scale: twinkle.value }],
  }));
  const halo = useAnimatedStyle(() => ({
    opacity: ring.value === 0 ? 0 : 0.6 * (1 - ring.value),
    transform: [{ scale: 1 + 0.6 * ring.value }],
  }));
  return (
    <View style={{ width: 64, height: 64 }}>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            width: 64,
            height: 64,
            borderRadius: 32,
            borderWidth: 3,
            borderColor: gradients.holo[0],
          },
          halo,
        ]}
      />
      <Pressable
        testID="home-save-button"
        accessibilityRole="button"
        accessibilityLabel={open ? "Close" : "Save something"}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={350}
        onPressIn={() => {
          if (!reduce) press.set(withSpring(0.86, SNAPPY));
        }}
        onPressOut={() => {
          if (!reduce) press.set(withSpring(1, BOUNCY));
        }}
      >
        <Animated.View
          style={[
            {
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: "#FFFFFF",
              alignItems: "center",
              justifyContent: "center",
            },
            body,
          ]}
        >
          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              borderWidth: 3,
              borderColor: colors.text,
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: gradients.holo[1],
            }}
          >
            <Animated.View
              style={[
                {
                  position: "absolute",
                  width: 90,
                  height: 90,
                  left: -18,
                  top: -18,
                },
                holo,
              ]}
            >
              <LinearGradient
                colors={gradients.holo}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ flex: 1 }}
              />
            </Animated.View>
            <Animated.View style={glyph}>
              <Ionicons name="add" size={30} color={colors.text} />
            </Animated.View>
          </View>
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                top: -4,
                right: -6,
                width: 16,
                height: 16,
              },
              sparkle,
            ]}
          >
            <Svg width={16} height={16} viewBox="0 0 16 16">
              <Path
                d="M8 0 Q9 7 16 8 Q9 9 8 16 Q7 9 0 8 Q7 7 8 0 Z"
                fill={palette.butter}
                stroke={colors.text}
                strokeWidth={1.5}
              />
            </Svg>
          </Animated.View>
        </Animated.View>
      </Pressable>
    </View>
  );
}
