import { StyleSheet, View } from "react-native";
import type { ExtractionStatus } from "../shared/contracts";
import { fonts, palette } from "../theme";
import { BouncingDots, Shimmer } from "./Signature";
import { Text } from "./ui/Text";

type Look = { label: string; bg: string; dot?: string; working?: boolean };
const understanding: Look = { label: "Understanding…", bg: palette.grey, working: true };
const looks: Record<ExtractionStatus, Look> = {
  pending: understanding,
  extracting: understanding,
  analyzing: understanding,
  ready: { label: "Ready", bg: palette.mint, dot: "#2BB673" },
  needs_input: { label: "Needs info", bg: palette.butter },
  failed: { label: "Failed", bg: palette.peach, dot: "#E5484D" },
};

/** Rulebook status pill (24 tall): grey shimmer + bouncing dots while working, mint Ready, butter Needs info, peach Failed. */
export function StatusPill({ status }: { status: ExtractionStatus }) {
  const l = looks[status] ?? understanding;
  return (
    <View style={[styles.pill, { backgroundColor: l.bg }]} testID={`status-${status}`} accessibilityLabel={l.label}>
      {l.working ? <Shimmer width={60} /> : null}
      {l.dot ? <View style={[styles.dot, { backgroundColor: l.dot }]} /> : null}
      <Text style={styles.text}>{l.label}</Text>
      {l.working ? <BouncingDots /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 6, height: 24, paddingHorizontal: 10, borderRadius: 999, alignSelf: "flex-start", overflow: "hidden" },
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: { fontFamily: fonts.extraBold, fontSize: 11, lineHeight: 14, letterSpacing: 0.9, textTransform: "uppercase", color: palette.ink },
});
