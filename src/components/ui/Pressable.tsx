import { useState, type ReactNode } from "react";
import { Animated, Pressable as RNPressable, type PressableProps as RNPressableProps, type StyleProp, type ViewStyle } from "react-native";
import { motion } from "../../theme";

export type ScalePressableProps = Omit<RNPressableProps, "style" | "children"> & {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  scaleTo?: number;
};

/** Pressable with a springy scale-down on touch. Base for every tappable UI element. */
export function ScalePressable({ style, children, scaleTo = motion.pressScale, onPressIn, onPressOut, ...rest }: ScalePressableProps) {
  const [scale] = useState(() => new Animated.Value(1));
  const animate = (to: number) => Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return (
    <RNPressable
      {...rest}
      onPressIn={(e) => {
        animate(scaleTo);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        animate(1);
        onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </RNPressable>
  );
}
