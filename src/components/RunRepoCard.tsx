import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useOwnedMutation, useOwnedQuery } from "../identity/OwnerProvider";
import { ACTION_LABELS } from "../shared/contracts";
import { errorMessage } from "./media";
import { Tap } from "./Pressable";
import { SpinRing, success } from "./Signature";
import { colors, radius, space } from "./tokens";
import { fonts, palette } from "../theme";
import { Text } from "./ui/Text";

/** Agent mode: the 4th suggestion on GitHub saves. Renders nothing unless the server has it configured. */
export function RunRepoCard({ itemId, color }: { itemId: Id<"savedItems">; color: string }) {
  const available = useOwnedQuery(api.agentRuns.runRepoAvailable, {});
  const latest = useOwnedQuery(api.agentRuns.latestRunRepo, available ? { itemId } : "skip");
  const start = useOwnedMutation(api.agentRuns.startRunRepo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!available) return null;
  const running = latest?.status === "queued" || latest?.status === "running";
  const openResult = (id: string) => router.push({ pathname: "/result/[id]", params: { id } });
  const label = ACTION_LABELS.run_repo;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const executionId = await start({ itemId });
      success();
      openResult(executionId);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card} testID="action-run_repo">
      <View style={styles.head}>
        <View style={[styles.rank, { backgroundColor: color }]}><Text style={styles.rankText}>4</Text></View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.title} numberOfLines={2}>{label.title}</Text>
          <Text style={styles.desc} numberOfLines={1}>{busy || running ? "Running in a sandbox…" : label.description}</Text>
        </View>
        {running ? (
          <View style={styles.play}><SpinRing /></View>
        ) : (
          <Tap
            testID="run-repo-button"
            accessibilityRole="button"
            accessibilityLabel={latest?.resultId ? "Run again" : label.title}
            accessibilityState={{ disabled: busy, busy }}
            disabled={busy}
            haptic="light"
            hitSlop={4}
            onPress={run}
            style={styles.play}
          >
            {busy ? <SpinRing /> : <Ionicons name={latest?.resultId ? "refresh" : "play"} size={18} color={palette.white} style={latest?.resultId ? null : { marginLeft: 2 }} />}
          </Tap>
        )}
      </View>
      {error ? <Text style={styles.error} testID="run-repo-error">{error}</Text> : null}
      {running && latest ? (
        <Tap testID="run-repo-progress" onPress={() => openResult(latest._id)} style={styles.status}>
          <SpinRing size={14} color={palette.ink} />
          <Text style={styles.statusText}>Working… tap to watch</Text>
        </Tap>
      ) : null}
      {latest?.resultId ? (
        <Tap testID="run-repo-view-result" onPress={() => openResult(latest._id)} style={styles.status}>
          <View style={styles.okDot} />
          <Text style={styles.statusText}>View result</Text>
        </Tap>
      ) : null}
      {latest?.status === "failed" && latest.error ? <Text style={styles.error}>Last run failed: {latest.error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md, padding: 16, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  head: { flexDirection: "row", gap: space.md, alignItems: "center", minHeight: 44 },
  rank: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  rankText: { fontFamily: fonts.extraBold, fontSize: 14, color: colors.text, fontVariant: ["tabular-nums"] },
  title: { fontFamily: fonts.extraBold, fontSize: 16, lineHeight: 20, color: colors.text },
  desc: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: "#5B5B63" },
  play: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.ink, alignItems: "center", justifyContent: "center" },
  status: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 44, borderRadius: radius.pill, backgroundColor: palette.grey },
  statusText: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 20, color: colors.text },
  okDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#2BB673" },
  error: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: "#E5484D" },
});
