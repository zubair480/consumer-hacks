import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { ActivityIndicator, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius, spacing } from "../../theme";
import { ScalePressable } from "./Pressable";
import { Text } from "./Text";

export type IconName = ComponentProps<typeof Ionicons>["name"];
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

const variantStyle: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.primary, fg: colors.onPrimary },
  secondary: { bg: colors.surface, fg: colors.text, border: colors.text },
  ghost: { bg: "transparent", fg: colors.text },
  danger: { bg: colors.danger, fg: colors.onPrimary },
};

const sizeStyle: Record<ButtonSize, { height: number; px: number; icon: number }> = {
  sm: { height: 38, px: spacing.lg, icon: 16 },
  md: { height: 54, px: spacing.xl, icon: 18 },
  lg: { height: 58, px: spacing.xl, icon: 22 },
};

export function Button({ title, onPress, variant = "primary", size = "md", icon, loading, disabled, fullWidth, testID, style }: ButtonProps) {
  const v = variantStyle[variant];
  const s = sizeStyle[size];
  const inactive = disabled || loading;
  return (
    <ScalePressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      haptic={variant === "primary"}
      onPress={onPress}
      style={[
        {
          height: s.height,
          paddingHorizontal: s.px,
          borderRadius: radius.pill,
          backgroundColor: v.bg,
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.sm,
          opacity: disabled ? 0.45 : 1,
          alignSelf: fullWidth ? "stretch" : "flex-start",
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          {icon ? <Ionicons name={icon} size={s.icon} color={v.fg} /> : null}
          <Text variant={size === "sm" ? "label" : "bodyStrong"} color={v.fg}>
            {title}
          </Text>
        </View>
      )}
    </ScalePressable>
  );
}

export type IconButtonProps = {
  icon: IconName;
  onPress?: () => void;
  accessibilityLabel: string;
  testID?: string;
  size?: number;
  tone?: "default" | "primary";
};

export function IconButton({ icon, onPress, accessibilityLabel, testID, size = 44, tone = "default" }: IconButtonProps) {
  return (
    <ScalePressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      scaleTo={0.9}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: tone === "primary" ? colors.primary : colors.surface,
        borderWidth: tone === "primary" ? 0 : 1,
        borderColor: colors.border,
      }}
    >
      <Ionicons name={icon} size={size * 0.45} color={tone === "primary" ? colors.onPrimary : colors.text} />
    </ScalePressable>
  );
}
