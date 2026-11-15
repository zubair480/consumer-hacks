import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { ComponentProps } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../../convex/_generated/api";
import type { ActivityRow } from "../../components/api";
import { Boundary } from "../../components/Boundary";
import { EmptyState } from "../../components/EmptyState";
import { GradientButton } from "../../components/GradientButton";
import { Tap } from "../../components/Pressable";
import { Skeleton } from "../../components/States";
import { colors, radius, space } from "../../components/tokens";
import { timeAgo } from "../../components/typeMeta";
import { DisplayTitle, Text as UIText } from "../../components/ui";
import { useOwnedPaginatedQuery } from "../../identity/OwnerProvider";
import { colors as themeColors, fonts, palette } from "../../theme";
import { useTabBarScroll } from "../../components/ui/InkTabBar";
import type { ActivityEventType } from "../../shared/contracts";

type IconName = ComponentProps<typeof Ionicons>["name"];

const EVENT: Record<ActivityEventType, { icon: IconName; color: string; verb: string }> = {
  item_saved: { icon: "bookmark", color: palette.lavender, verb: "Saved" },
  item_updated: { icon: "create", color: palette.paper, verb: "Updated" },
  item_deleted: { icon: "trash", color: palette.paper, verb: "Deleted" },
  analysis_started: { icon: "eye", color: palette.sky, verb: "Analyzing" },
  analysis_completed: { icon: "bulb", color: palette.mint, verb: "Understood" },
  analysis_needs_input: { icon: "help-circle", color: palette.butter, verb: "Needs info" },
  analysis_failed: { icon: "alert-circle", color: themeColors.dangerSoft, verb: "Analysis failed" },
  action_started: { icon: "play", color: palette.sky, verb: "Started" },
  action_completed: { icon: "checkmark-done", color: palette.mint, verb: "Completed" },
  action_failed: { icon: "close-circle", color: themeColors.dangerSoft, verb: "Action failed" },
  collection_updated: { icon: "folder", color: palette.peach, verb: "Collection" },
};

export default function Activity() {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.top}>
        <DisplayTitle>Activity</DisplayTitle>
        <UIText variant="caption" tone="secondary">Saves, analysis and finished actions, newest first.</UIText>
      </View>
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

const SETTLES_ANALYSIS = new Set<ActivityEventType>(["analysis_completed", "analysis_needs_input", "analysis_failed"]);
const SETTLES_ACTION = new Set<ActivityEventType>(["action_completed", "action_failed"]);

/** The feed is an append-only log, so an "in progress" row stays after its work finished. Drop analysis_started / action_started rows that a newer settling event for the same item / execution already replaced. Input is newest first. */
function withoutSettled(events: ActivityRow[]) {
  const settledItems = new Set<string>();
  const settledExecutions = new Set<string>();
  return events.filter((e) => {
    if (SETTLES_ANALYSIS.has(e.type) && e.itemId) settledItems.add(e.itemId);
    if (SETTLES_ACTION.has(e.type) && e.executionId) settledExecutions.add(e.executionId);
    if (e.type === "analysis_started" && e.itemId && settledItems.has(e.itemId)) return false;
    if (e.type === "action_started" && e.executionId && settledExecutions.has(e.executionId)) return false;
    return true;
  });
}

function Feed() {
  const { results: raw, status, loadMore } = useOwnedPaginatedQuery(api.activity.listPage, {}, { initialNumItems: 20 });
  const events = withoutSettled(raw);
  const scroll = useTabBarScroll();
  if (status === "LoadingFirstPage") return <View style={styles.list}><Skeleton rows={5} height={64} /></View>;
  return (
    <FlatList
      testID="activity-list"
      data={events}
      keyExtractor={(e) => e._id}
      {...scroll}
      contentContainerStyle={styles.list}
      onEndReached={() => (status === "CanLoadMore" ? loadMore(20) : undefined)}
      onEndReachedThreshold={0.5}
      ListFooterComponent={status === "LoadingMore" ? <ActivityIndicator testID="activity-loading-more" color={colors.text} style={{ padding: space.lg }} /> : undefined}
      ListEmptyComponent={
        <EmptyState icon="pulse" title="No activity yet" body="Saves, analysis, and finished actions show up here.">
          <GradientButton testID="activity-empty-save-button" label="Save something" icon="add" onPress={() => router.push("/capture")} style={{ alignSelf: "stretch" }} />
        </EmptyState>
      }
      renderItem={({ item: e }) => {
        const m = EVENT[e.type] ?? EVENT.item_updated;
        const tappable = !!(e.itemId || e.executionId) && e.type !== "item_deleted";
        return (
          <Tap testID={`activity-${e._id}`} disabled={!tappable} accessibilityLabel={`${m.verb}: ${e.title}`} onPress={() => open(e)} style={styles.row}>
            <View style={[styles.node, { backgroundColor: m.color }]}>
              <Ionicons name={m.icon} size={20} color={colors.text} />
            </View>
            <View style={styles.body}>
              <UIText variant="caption" tone="secondary">{m.verb} · {timeAgo(e.createdAt)}</UIText>
              <UIText style={styles.title} numberOfLines={2}>{e.title}</UIText>
              {e.detail ? <UIText variant="caption" tone="secondary" numberOfLines={2}>{e.detail}</UIText> : null}
            </View>
            {tappable ? <Ionicons name="chevron-forward" size={18} color={colors.textFaint} /> : null}
          </Tap>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  top: { paddingHorizontal: space.xl, paddingTop: space.md, gap: space.xs, paddingBottom: space.md },
  list: { padding: space.xl, paddingTop: space.sm, gap: space.md, paddingBottom: 120 },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, paddingRight: space.lg, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  node: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 16, lineHeight: 21, fontFamily: fonts.bold },
});
