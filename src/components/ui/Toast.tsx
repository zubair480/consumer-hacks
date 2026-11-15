import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts } from "../../theme";
import { Text } from "./Text";

let listener: ((message: string) => void) | null = null;

/** Ink toast that drops in from the top and hides after 2s. Rendered by <ToastHost /> in the root layout. */
export function showToast(message: string) {
  listener?.(message);
}

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const [message, setMessage] = useState<string | null>(null);
  const y = useSharedValue(-80);
  const o = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    listener = (m) => {
      setMessage(m);
      if (timer.current) clearTimeout(timer.current);
      y.set(reduce ? 0 : withSpring(0, { damping: 12, stiffness: 220 }));
      o.set(withTiming(1, { duration: 200 }));
      timer.current = setTimeout(() => {
        o.set(withTiming(0, { duration: 200, easing: Easing.in(Easing.cubic) }));
        if (!reduce) y.set(withTiming(-80, { duration: 280, easing: Easing.in(Easing.cubic) }));
      }, 2000);
    };
    return () => {
      listener = null;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [reduce, y, o]);

  const a = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }] }));
  if (!message) return null;
  return (
    <Animated.View pointerEvents="none" testID="toast" style={[{ position: "absolute", top: insets.top + 8, alignSelf: "center", height: 44, borderRadius: 22, paddingLeft: 8, paddingRight: 18, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.primary, shadowColor: "#111111", shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 12 }, a]}>
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.onPrimary, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="checkmark" size={18} color={colors.primary} />
      </View>
      <Text style={{ fontFamily: fonts.bold, fontSize: 14, lineHeight: 20, color: colors.onPrimary }}>{message}</Text>
    </Animated.View>
  );
}
