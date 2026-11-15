import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { ExtractionStatus } from "../shared/contracts";
import { colors, radius } from "./tokens";

const config: Record<ExtractionStatus, { label: string; color: string; spin?: boolean }> = {
  pending: { label: "Queued", color: colors.textMuted, spin: true },
  extracting: { label: "Reading", color: colors.info, spin: true },
  analyzing: { label: "Understanding", color: colors.accent, spin: true },
  ready: { label: "Ready", color: colors.success },
  needs_input: { label: "Needs input", color: colors.warning },
  failed: { label: "Failed", color: colors.danger },
};

export function StatusPill({ status }: { status: ExtractionStatus }) {
  const c = config[status] ?? config.pending;
  return (
    <View style={[styles.pill, { borderColor: c.color + "55", backgroundColor: c.color + "1A" }]}>
      {c.spin ? <ActivityIndicator size="small" color={c.color} style={styles.spin} /> : <View style={[styles.dot, { backgroundColor: c.color }]} />}
      <Text style={[styles.text, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1, alignSelf: "flex-start" },
  dot: { width: 6, height: 6, borderRadius: 3 },
  spin: { transform: [{ scale: 0.6 }], width: 10, height: 10 },
  text: { fontSize: 12, fontWeight: "700" },
});
