import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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
import { colors, fonts, palette } from "../../theme";
import { Text } from "./Text";

type IconName = ComponentProps<typeof Ionicons>["name"];

const BOUNCY = { damping: 12, stiffness: 220 };
const SNAPPY = { damping: 18, stiffness: 320 };
const GENTLE = { damping: 20, stiffness: 140 };
const MORPH = { damping: 14, stiffness: 240, mass: 0.9 };
const DOCK = 68;
const GAP = 10;
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

export function dockPath(W: number) {
  return [
    "M 34,0",
    `L ${W - 34},0`,
    `A 34 34 0 0 1 ${W},34`,
    `A 34 34 0 0 1 ${W - 34},68`,
    "L 34,68",
    "A 34 34 0 0 1 0,34",
    "A 34 34 0 0 1 34,0",
    "Z",
  ].join(" ");
}

const slotWidth = (W: number, count: number) => (W - 16) / Math.max(1, count);
const slotCenter = (W: number, i: number, count: number) =>
  8 + slotWidth(W, count) * (i + 0.5);

type Route = BottomTabBarProps["state"]["routes"][number];
export type InkTabBarProps = BottomTabBarProps & {
  latestResultAt?: number;
};

const introPending = () =>
  (globalThis as { __zapyIntroPending?: boolean }).__zapyIntroPending === true;

/** Ink capsule dock: tilted pastel sticker tag on the active tab, tabs spaced evenly, hides on scroll. */
export function InkTabBar({
  state,
  descriptors,
  emitter,
  navigateToTab,
  latestResultAt,
}: InkTabBarProps) {
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const scroll = useContext(ScrollContext);
  const active = state.routes[state.index];
  const tabRoutes = state.routes.filter((r) => TABS[r.name]);
  const activeSlot = tabRoutes.findIndex((r) => r.key === active.key);
  const activeMeta = TABS[active.name];
  const [W, setW] = useState(0);
  const [seenAt, setSeenAt] = useState(() => Date.now());
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
    onTab.set(withTiming(activeSlot >= 0 ? 1 : 0, { duration: 150 }));
  }, [activeSlot, onTab]);

  useEffect(() => {
    if (W <= 0 || activeSlot < 0) return;
    const cx = slotCenter(W, activeSlot, tabRoutes.length);
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

  const press = (route: Route) => {
    const event = emitter?.emit({
      type: "tabPress",
      target: route.key,
      canPreventDefault: true,
    });
    if (route.key !== active.key && !event?.defaultPrevented)
      navigateToTab?.(route.key);
  };

  const path = W > 0 ? dockPath(W) : "";
  return (
    <>
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
                      width: slotWidth(W, tabRoutes.length),
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
