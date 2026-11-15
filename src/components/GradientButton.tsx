import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { ComponentProps } from "react";
import { ActivityIndicator, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { Tap } from "./Pressable";
import { colors, gradient, radius } from "./tokens";

type Props = {
  testID: string;
  label: string;
  icon?: ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  style?: StyleProp<ViewStyle>;
};

export function GradientButton({ testID, label, icon, onPress, loading, disabled, variant = "primary", style }: Props) {
  const inactive = disabled || loading;
  const content = (
    <>
      {loading ? <ActivityIndicator color={colors.text} /> : icon ? <Ionicons name={icon} size={18} color={variant === "danger" ? colors.danger : colors.text} /> : null}
      <Text style={[styles.label, variant === "danger" && { color: colors.danger }]}>{label}</Text>
    </>
  );
  return (
    <Tap
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive }}
      disabled={inactive}
      haptic="medium"
      onPress={onPress}
      style={[style, inactive && styles.disabled]}
    >
      {variant === "primary" ? (
        <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btn}>{content}</LinearGradient>
      ) : (
        <LinearGradient colors={[colors.surfaceRaised, colors.surfaceRaised]} style={[styles.btn, styles.secondary]}>{content}</LinearGradient>
      )}
    </Tap>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15, paddingHorizontal: 20, borderRadius: radius.md },
  secondary: { borderWidth: 1, borderColor: colors.border },
  label: { color: colors.text, fontSize: 16, fontWeight: "700" },
  disabled: { opacity: 0.5 },
});
