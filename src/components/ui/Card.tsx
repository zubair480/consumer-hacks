import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { colors, palette, radius, shadows, spacing } from "../../theme";
import { ScalePressable } from "./Pressable";

export type CardProps = {
  children: ReactNode;
  onPress?: () => void;
  /** Colored stripe on the left edge, e.g. contentTypeColors[type]. */
  accent?: string;
  variant?: "default" | "raised" | "outline" | "hero";
  padded?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, onPress, accent, variant = "default", padded = true, testID, accessibilityLabel, style }: CardProps) {
  const cardStyle: StyleProp<ViewStyle> = [
    {
      backgroundColor: variant === "raised" ? colors.surfaceRaised : variant === "hero" ? palette.butter : colors.surface,
      borderRadius: radius.card,
      borderWidth: variant === "default" || variant === "outline" ? 1 : 0,
      borderColor: colors.border,
      padding: padded ? spacing.xl : 0,
      overflow: "hidden",
    },
    variant === "outline" ? null : shadows.card,
    style,
  ];
  const content = (
    <>
      {accent ? <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, backgroundColor: accent }} /> : null}
      {children}
    </>
  );
  if (!onPress) {
    return (
      <View testID={testID} accessibilityLabel={accessibilityLabel} style={cardStyle}>
        {content}
      </View>
    );
  }
  return (
    <ScalePressable testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} scaleTo={0.98} style={cardStyle}>
      {content}
    </ScalePressable>
  );
}
