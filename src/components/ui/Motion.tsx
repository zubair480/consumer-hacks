import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, { Easing, FadeIn, FadeInDown, ReduceMotion, useReducedMotion } from "react-native-reanimated";
import { motion } from "../../theme";

/** Section enter: fade + translateY 14 -> 0 over 260ms, Easing.out(cubic), staggered 50ms by index. Reduce Motion: plain fade, no stagger. */
export function Enter({ index = 0, children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduce = useReducedMotion();
  const entering = reduce
    ? FadeIn.duration(motion.enter.duration).reduceMotion(ReduceMotion.Never)
    : FadeInDown.duration(motion.enter.duration).delay(index * motion.enter.stagger).easing(Easing.out(Easing.cubic)).withInitialValues({ opacity: 0, transform: [{ translateY: motion.enter.offset }] });
  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}

/** Spring slide-up from +24, staggered 70ms (WaveBlocks). Reduce Motion: no animation. */
export function SlideUp({ index = 0, children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduce = useReducedMotion();
  return (
    <Animated.View entering={reduce ? undefined : FadeInDown.springify().damping(18).stiffness(220).delay(index * 70).withInitialValues({ opacity: 0, transform: [{ translateY: 24 }] })} style={style}>
      {children}
    </Animated.View>
  );
}
