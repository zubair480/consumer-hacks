import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, space, type } from "./tokens";

export function EmptyState({ icon, title, body, children }: { icon: ComponentProps<typeof Ionicons>["name"]; title: string; body?: string; children?: React.ReactNode }) {
  return (
    <View style={styles.box}>
      <View style={styles.icon}><Ionicons name={icon} size={26} color={colors.accent} /></View>
      <Text style={[type.heading, styles.center]}>{title}</Text>
      {body ? <Text style={[type.caption, styles.center]}>{body}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", gap: space.sm, padding: space.xl, borderRadius: radius.lg, borderWidth: 1, borderStyle: "dashed", borderColor: colors.border },
  icon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.accent + "22", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  center: { textAlign: "center" },
});
