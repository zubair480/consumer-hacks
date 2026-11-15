import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { ComponentProps } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { activityApi, type ActivityRow } from "../../components/api";
import { Boundary } from "../../components/Boundary";
import { EmptyState } from "../../components/EmptyState";
import { GradientButton } from "../../components/GradientButton";
import { Tap } from "../../components/Pressable";
import { ScreenHeader } from "../../components/ScreenHeader";
import { Skeleton } from "../../components/States";
import { colors, radius, space, type } from "../../components/tokens";
import { timeAgo } from "../../components/typeMeta";
import { useOwnedQuery } from "../../identity/OwnerProvider";
import type { ActivityEventType } from "../../shared/contracts";

type IconName = ComponentProps<typeof Ionicons>["name"];

const EVENT: Record<ActivityEventType, { icon: IconName; color: string; verb: string }> = {
  item_saved: { icon: "bookmark", color: colors.accent, verb: "Saved" },
  item_updated: { icon: "create", color: colors.textMuted, verb: "Updated" },
  item_deleted: { icon: "trash", color: colors.textFaint, verb: "Deleted" },
  analysis_started: { icon: "sparkles", color: colors.info, verb: "Analyzing" },
  analysis_completed: { icon: "sparkles", color: colors.success, verb: "Understood" },
  analysis_needs_input: { icon: "help-circle", color: colors.warning, verb: "Needs info" },
  analysis_failed: { icon: "alert-circle", color: colors.danger, verb: "Analysis failed" },
  action_started: { icon: "flash", color: colors.info, verb: "Started" },
  action_completed: { icon: "checkmark-done", color: colors.success, verb: "Completed" },
  action_failed: { icon: "close-circle", color: colors.danger, verb: "Action failed" },
  collection_updated: { icon: "folder", color: colors.accent, verb: "Collection" },
};

export default function Activity() {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.top}><ScreenHeader title="Activity" /></View>
      <Boundary title="Couldn’t load activity">
        <Feed />
      </Boundary>
    </SafeAreaView>
  );
}

function open(e: ActivityRow) {
  if (e.executionId && (e.resultId || e.type.startsWith("action_"))) router.push({ pathname: "/result/[id]", params: { id: e.executionId } });
  else if (e.itemId) router.push({ pathname: "/item/[id]", params: { id: e.itemId } });
}

function Feed() {
  const events = useOwnedQuery(activityApi.list, { limit: 100 });
  if (events === undefined) return <View style={styles.list}><Skeleton rows={5} height={64} /></View>;
  return (
    <FlatList
      testID="activity-list"
      data={events}
      keyExtractor={(e) => e._id}
      contentContainerStyle={styles.list}
      ListEmptyComponent={
        <EmptyState icon="pulse" title="No activity yet" body="Saves, analysis, and finished actions show up here.">
          <GradientButton testID="activity-empty-save-button" label="Save something" icon="add" onPress={() => router.push("/capture")} style={{ alignSelf: "stretch" }} />
        </EmptyState>
      }
      renderItem={({ item: e, index }) => {
        const m = EVENT[e.type] ?? EVENT.item_updated;
        const tappable = !!(e.itemId || e.executionId) && e.type !== "item_deleted";
        return (
          <Tap testID={`activity-${e._id}`} disabled={!tappable} accessibilityLabel={`${m.verb}: ${e.title}`} onPress={() => open(e)} style={styles.row}>
            <View style={styles.rail}>
              <View style={[styles.node, { backgroundColor: m.color + "26", borderColor: m.color }]}>
                <Ionicons name={m.icon} size={14} color={m.color} />
              </View>
              {index < events.length - 1 ? <View style={styles.line} /> : null}
            </View>
            <View style={styles.body}>
              <Text style={type.caption}>{m.verb} · {timeAgo(e.createdAt)}</Text>
              <Text style={type.heading} numberOfLines={2}>{e.title}</Text>
              {e.detail ? <Text style={type.caption} numberOfLines={2}>{e.detail}</Text> : null}
            </View>
            {tappable ? <Ionicons name="chevron-forward" size={16} color={colors.textFaint} style={{ marginTop: 6 }} /> : null}
          </Tap>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  top: { paddingHorizontal: space.xl },
  list: { padding: space.xl, paddingBottom: 60 },
  row: { flexDirection: "row", gap: space.md },
  rail: { alignItems: "center", width: 30 },
  node: { width: 30, height: 30, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  line: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 4 },
  body: { flex: 1, gap: 4, paddingBottom: space.xl },
});
