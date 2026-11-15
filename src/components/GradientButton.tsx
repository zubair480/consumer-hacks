import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors as theme, fonts } from "../theme/tokens";
import { Tap } from "./Pressable";
import { colors, radius } from "./tokens";

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
  const fg = variant === "primary" ? theme.onPrimary : variant === "danger" ? colors.danger : colors.text;
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
      <View style={[styles.btn, variant === "primary" ? styles.primary : styles.secondary]}>
        {loading ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
        <Text style={[styles.label, { color: fg }]}>{label}</Text>
      </View>
    </Tap>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 52, paddingHorizontal: 20, borderRadius: radius.pill },
  primary: { backgroundColor: theme.primary },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  label: { fontSize: 16, fontFamily: fonts.bold },
  disabled: { opacity: 0.25 },
});
