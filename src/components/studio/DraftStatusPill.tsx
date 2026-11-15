import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { PUBLISH_STATUS_LABELS } from "../../lib/share";
import { palette } from "../../theme";
import { radius } from "../tokens";
import { studioText } from "./studioStyles";

const GREEN = "#2BB673";
const RED = "#E5484D";

const config: Record<string, { label: string; bg: string; dot?: string; spin?: boolean }> = {
  generating: { label: "Writing…", bg: palette.grey, spin: true },
  draft: { label: PUBLISH_STATUS_LABELS.draft, bg: palette.grey },
  ready_to_share: { label: PUBLISH_STATUS_LABELS.ready_to_share, bg: palette.mint },
  awaiting_user_action: { label: PUBLISH_STATUS_LABELS.awaiting_user_action, bg: palette.butter },
  publishing: { label: PUBLISH_STATUS_LABELS.publishing, bg: palette.grey, spin: true },
  published: { label: PUBLISH_STATUS_LABELS.published, bg: palette.mint, dot: GREEN },
  failed: { label: PUBLISH_STATUS_LABELS.failed, bg: palette.peach, dot: RED },
};

export function DraftStatusPill({ status, label, testID }: { status: string; label?: string; testID?: string }) {
  const base = config[status] ?? { label: status.replace(/_/g, " "), bg: palette.grey };
  const c = label ? { ...base, label } : base;
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]} testID={testID ?? `draft-status-${status}`}>
      {c.spin ? <ActivityIndicator size="small" color={palette.ink} style={styles.spin} /> : c.dot ? <View style={[styles.dot, { backgroundColor: c.dot }]} /> : null}
      <Text style={styles.text}>{c.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 6, height: 24, paddingHorizontal: 10, borderRadius: radius.pill, alignSelf: "flex-start" },
  dot: { width: 7, height: 7, borderRadius: 4 },
  spin: { transform: [{ scale: 0.6 }], width: 12, height: 12 },
  text: { ...studioText.footnote, fontFamily: studioText.callout.fontFamily, color: palette.ink },
});
