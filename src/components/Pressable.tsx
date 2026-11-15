import * as Haptics from "expo-haptics";
import { useState } from "react";
import { Animated, Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  haptic?: "light" | "medium" | "none";
};

export function Tap({ style, haptic = "light", onPress, children, ...rest }: Props) {
  const [scale] = useState(() => new Animated.Value(1));
  const to = (value: number) => Animated.spring(scale, { toValue: value, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={() => to(0.97)}
      onPressOut={() => to(1)}
      onPress={(e) => {
        if (haptic !== "none") {
          Haptics.impactAsync(haptic === "medium" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
        onPress?.(e);
      }}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}
