import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors, radius } from "../tokens";

const config: Record<string, { label: string; color: string; spin?: boolean }> = {
  generating: { label: "Writing…", color: colors.info, spin: true },
  draft: { label: "Draft", color: colors.textMuted },
  ready_to_share: { label: "Ready to share", color: colors.success },
  awaiting_user_action: { label: "Awaiting you", color: colors.warning },
  publishing: { label: "Publishing…", color: colors.info, spin: true },
  published: { label: "Published", color: colors.success },
  shared_by_user: { label: "You posted it", color: colors.success },
  failed: { label: "Failed", color: colors.danger },
};

export function DraftStatusPill({ status, testID }: { status: string; testID?: string }) {
  const c = config[status] ?? { label: status.replace(/_/g, " "), color: colors.textMuted };
  return (
    <View style={[styles.pill, { borderColor: c.color + "55", backgroundColor: c.color + "1A" }]} testID={testID ?? `draft-status-${status}`}>
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
