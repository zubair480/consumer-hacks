import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { PUBLISH_STATUS_LABELS } from "../../lib/share";
import { colors, radius } from "../tokens";

const config: Record<string, { label: string; color: string; spin?: boolean }> = {
  generating: { label: "Writing…", color: colors.info, spin: true },
  draft: { label: PUBLISH_STATUS_LABELS.draft, color: colors.textMuted },
  ready_to_share: { label: PUBLISH_STATUS_LABELS.ready_to_share, color: colors.success },
  awaiting_user_action: { label: PUBLISH_STATUS_LABELS.awaiting_user_action, color: colors.warning },
  publishing: { label: PUBLISH_STATUS_LABELS.publishing, color: colors.info, spin: true },
  published: { label: PUBLISH_STATUS_LABELS.published, color: colors.success },
  failed: { label: PUBLISH_STATUS_LABELS.failed, color: colors.danger },
};

export function DraftStatusPill({ status, label, testID }: { status: string; label?: string; testID?: string }) {
  const base = config[status] ?? { label: status.replace(/_/g, " "), color: colors.textMuted };
  const c = label ? { ...base, label } : base;
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
