import { ActivityIndicator, View } from "react-native";
import { IN_PROGRESS_EXTRACTION_STATUSES, type ExecutionStatus, type ExtractionStatus } from "../../shared/contracts";
import { colors, radius, spacing } from "../../theme";
import { Text } from "./Text";

const config: Record<ExtractionStatus | ExecutionStatus, { label: string; color: string }> = {
  pending: { label: "Queued", color: colors.textSecondary },
  extracting: { label: "Reading", color: colors.info },
  analyzing: { label: "Understanding", color: colors.primary },
  ready: { label: "Ready", color: colors.success },
  needs_input: { label: "Needs input", color: colors.warning },
  failed: { label: "Failed", color: colors.danger },
  queued: { label: "Queued", color: colors.textSecondary },
  running: { label: "Running", color: colors.primary },
  awaiting_approval: { label: "Awaiting you", color: colors.warning },
  succeeded: { label: "Done", color: colors.success },
  cancelled: { label: "Cancelled", color: colors.textMuted },
};

const spinning = new Set<string>([...IN_PROGRESS_EXTRACTION_STATUSES, "queued", "running"]);

/** Pill for an extraction or execution status. */
export function StatusBadge({ status, testID }: { status: ExtractionStatus | ExecutionStatus; testID?: string }) {
  const { label, color } = config[status];
  return (
    <View
      testID={testID}
      accessibilityLabel={label}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        alignSelf: "flex-start",
        paddingHorizontal: spacing.sm,
        height: 24,
        borderRadius: radius.pill,
        backgroundColor: color + "22",
      }}
    >
      {spinning.has(status) ? <ActivityIndicator size="small" color={color} style={{ transform: [{ scale: 0.7 }] }} /> : <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />}
      <Text variant="caption" color={color} style={{ fontWeight: "700" }}>{label}</Text>
    </View>
  );
}
