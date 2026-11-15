import * as Haptics from "expo-haptics";
import type { ReactNode } from "react";
import { Pressable as RNPressable, type PressableProps as RNPressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated";
import { motion } from "../../theme";

export type ScalePressableProps = Omit<RNPressableProps, "style" | "children"> & {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  scaleTo?: number;
  /** impactLight on press, for primary buttons and Run. */
  haptic?: boolean;
};

/** Press-scale wrapper: springs to 0.96 (damping 18, stiffness 320), optional light haptic. Base for every tappable UI element. */
export function ScalePressable({ style, children, scaleTo = motion.pressScale, haptic, onPressIn, onPressOut, onPress, ...rest }: ScalePressableProps) {
  const reduce = useReducedMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <RNPressable
      {...rest}
      onPress={(e) => {
        if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.(e);
      }}
      onPressIn={(e) => {
        if (!reduce) scale.set(withSpring(scaleTo, motion.spring));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!reduce) scale.set(withSpring(1, motion.spring));
        onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, animated]}>{children}</Animated.View>
    </RNPressable>
  );
}
