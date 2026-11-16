import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "convex/react";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, DeviceEventEmitter, Pressable, RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { FadeIn, FadeInDown, useReducedMotion } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../../convex/_generated/api";
import { Boundary } from "../../components/Boundary";
import { itemTitle } from "../../components/ItemCard";
import { Shimmer, SpinRing } from "../../components/Signature";
import { Skeleton } from "../../components/States";
import { HoloBand, ScalePressable, SearchPill, Text } from "../../components/ui";
import { TAB_BAR_SPACE, useTabBarScroll } from "../../components/ui/InkTabBar";
import { showToast } from "../../components/ui/Toast";
import { MarkerTitle } from "../../components/ui/MarkerTitle";
import { useOwnedQuery, useOwnerId } from "../../identity/OwnerProvider";
import { boxFor } from "../../lib/boxes";
import { interestColor, useProfile } from "../../lib/useProfile";
import { colors, fonts, gradients, palette } from "../../theme";

const INK2 = "#5B5B63";
const openItem = (id: string) => router.push({ pathname: "/item/[id]", params: { id } });

type Items = NonNullable<ReturnType<typeof useOwnedQuery<typeof api.items.list>>>;
type Task = Items[number] & { state: TaskState };
type TaskState = "review" | "running" | "done";
type Tab = "review" | "all" | "done";
const ORDER: Record<TaskState, number> = { review: 0, running: 1, done: 2 };
const IN_PROGRESS = new Set(["pending", "extracting", "analyzing"]);

const introPending = () => (globalThis as { __zapyIntroPending?: boolean }).__zapyIntroPending === true;
let welcomed = false;
const SYNC_EVERY_MS = 60_000;
let lastXSync = 0;

/** Schedules the server-side X and GitHub syncs (imports.sync.syncAll) when Home gains focus or the app returns to the foreground (at most once a minute per device); `sync(true)` skips the throttle. New saves arrive live through items.list; a toast counts them after 5s. */
function useXAutoSync(itemCount: number | undefined) {
  const ownerId = useOwnerId();
  const syncAll = useMutation(api.imports.sync.syncAll);
  const sources = useOwnedQuery(api.imports.connections.sources, {});
  const connected = !!sources?.find((s) => s.platform === "x")?.connected;
  const count = useRef(itemCount);
  useEffect(() => {
    count.current = itemCount;
  }, [itemCount]);
  const sync = useCallback(
    async (force = false) => {
      const now = Date.now();
      if (!ownerId || (!force && now - lastXSync < SYNC_EVERY_MS)) return;
      lastXSync = now;
      const before = count.current ?? 0;
      try {
        const { scheduled } = await syncAll({ ownerId });
        if (!scheduled.length) return 0;
      } catch {
        return -1;
      }
      setTimeout(() => {
        const added = Math.max(0, (count.current ?? 0) - before);
        if (added > 0) showToast(`${added} new ${added === 1 ? "save" : "saves"}`);
      }, 5000);
      return 0;
    },
    [ownerId, syncAll],
  );
  useFocusEffect(
    useCallback(() => {
      void sync();
    }, [sync]),
  );
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void sync();
    });
    return () => sub.remove();
  }, [sync]);
  return { sync, connected };
}

/** Holds Home at opacity 0 while the cold-start intro plays; reveals on "zapy:introDone" or after 4s. */
function useIntroGate() {
  const [revealed, setRevealed] = useState(() => !introPending());
  useEffect(() => {
    if (revealed) return;
    const sub = DeviceEventEmitter.addListener("zapy:introDone", () => setRevealed(true));
    const timer = setTimeout(() => setRevealed(true), 4000);
    return () => {
      sub.remove();
      clearTimeout(timer);
    };
  }, [revealed]);
  return revealed;
}

function Enter({ index = 0, style, children }: { index?: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <Animated.View entering={reduce ? FadeIn.duration(200) : FadeInDown.delay(index * 50).springify().damping(18).stiffness(320)} style={style}>
      {children}
    </Animated.View>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/** Demo flow A3: Home is the task queue, unreviewed first. */
export default function Home() {
  const items = useOwnedQuery(api.items.list, { limit: 50 });
  const outcomes = useOwnedQuery(api.actions.recentOutcomes, { limit: 50 });
  const me = useProfile();
  const scroll = useTabBarScroll();
  const revealed = useIntroGate();
  const [tab, setTab] = useState<Tab>("review");
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const x = useXAutoSync(items?.length);
  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([x.sync(true), new Promise((r) => setTimeout(r, 2000))]);
    setRefreshing(false);
  };

  useEffect(() => {
    if (me && !me.onboarded && !welcomed) {
      welcomed = true;
      router.push("/welcome");
    }
  }, [me]);

  const doneIds = new Set((outcomes ?? []).map((o) => o.itemId as string));
  const tasks: Task[] = (items ?? []).map((i) => ({ ...i, state: doneIds.has(i._id) ? "done" : IN_PROGRESS.has(i.extractionStatus) ? "running" : "review" }));
  const inReview = (t: Task) => t.state === "review" || t.state === "running";
  const counts = { review: tasks.filter(inReview).length, all: tasks.length, done: tasks.filter((t) => t.state === "done").length };
  const needle = query.trim().toLowerCase();
  const matches = (t: Task) => !needle || [itemTitle(t), t.summary, t.sourceUrl, t.rawText].some((s) => s?.toLowerCase().includes(needle));
  const shown = (
    tab === "review"
      ? tasks.filter(inReview).sort((a, b) => Number(b.state === "running") - Number(a.state === "running") || b.createdAt - a.createdAt)
      : (tab === "all" ? tasks : tasks.filter((t) => t.state === "done")).sort((a, b) => ORDER[a.state] - ORDER[b.state] || b.createdAt - a.createdAt)
  ).filter(matches);
  const first = me?.displayName?.split(/\s+/)[0];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <HoloBand height={140} />
      <ScrollView
        {...scroll}
        contentContainerStyle={styles.content}
        testID="home-screen"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl testID="queue-refresh" refreshing={refreshing} onRefresh={refresh} tintColor={colors.text} colors={[colors.text]} />}
      >
        <View key={revealed ? "shown" : "held"} testID="queue-screen" style={[styles.stack, !revealed && { opacity: 0 }]}>
          <Enter index={0}>
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.extraBold, fontSize: 16, lineHeight: 22, color: colors.text }} numberOfLines={1}>
                  {first ? `${greeting()}, ${first}` : greeting()}
                </Text>
                <Text testID="home-subline" style={{ fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: INK2 }}>
                  {items === undefined ? " " : counts.all > 0 ? `${counts.all} ${counts.all === 1 ? "save" : "saves"} · ${counts.review} to review` : "Nothing waiting. Pull everything in"}
                </Text>
              </View>
              <ScalePressable testID="home-avatar" accessibilityRole="button" accessibilityLabel="Profile" scaleTo={0.97} onPress={() => router.push("/profile")}>
                <LinearGradient colors={gradients.holo} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ring}>
                  <View style={[styles.avatar, { backgroundColor: interestColor(me?.topInterest) }]}>
                    <Text style={{ fontFamily: fonts.display, fontSize: 18, lineHeight: 22, color: colors.text }}>{(first ?? "Z").charAt(0).toUpperCase()}</Text>
                  </View>
                </LinearGradient>
              </ScalePressable>
            </View>
          </Enter>
          {x.connected ? null : (
            <Enter index={1}>
              <ScalePressable testID="home-x-pill" accessibilityRole="button" accessibilityLabel="Connect X" scaleTo={0.97} onPress={() => router.push("/import")} style={[styles.pillBtn, styles.xPill]}>
                <Ionicons name="logo-x" size={16} color={colors.text} />
                <Text style={styles.pillBtnText}>Connect X</Text>
              </ScalePressable>
            </Enter>
          )}
          <Enter index={1}>
            <MarkerTitle lines={["Your tasks"]} marker="tasks" />
          </Enter>
          <Enter index={2}>
            <View style={styles.segment} accessibilityRole="tablist">
              {(["review", "all", "done"] as const).map((k) => (
                <Pressable key={k} testID={`queue-tab-${k}`} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} onPress={() => setTab(k)} style={[styles.segItem, tab === k && styles.segActive]}>
                  <Text style={[styles.segText, tab === k && { color: colors.onPrimary }]} numberOfLines={1}>
                    {k === "review" ? "To review" : k === "all" ? "All" : "Done"} ({counts[k]})
                  </Text>
                </Pressable>
              ))}
            </View>
          </Enter>
          {counts.all >= 3 ? (
            <Enter index={3}>
              <SearchPill testID="home-search-pill" accessibilityLabel="Search your saves" placeholder="Search your saves" value={query} onChangeText={setQuery} autoCorrect={false} autoCapitalize="none" clearButtonMode="while-editing" />
            </Enter>
          ) : null}
          <Boundary title="Couldn’t load your tasks">
            {items === undefined ? (
              <Skeleton rows={3} />
            ) : shown.length === 0 ? (
              <Enter index={4} style={styles.empty}>
                <Text style={styles.emptyTitle}>{needle ? "No matches" : tab === "done" ? "Nothing done yet" : "All caught up"}</Text>
                <ScalePressable testID="queue-pull-button" accessibilityRole="button" accessibilityLabel="Pull everything" haptic scaleTo={0.97} onPress={() => router.push("/pull")} style={styles.pull}>
                  <Ionicons name="cloud-download-outline" size={20} color={colors.onPrimary} />
                  <Text style={styles.pullText}>Pull everything</Text>
                </ScalePressable>
              </Enter>
            ) : (
              <View style={{ gap: 12 }}>
                {shown.map((t, i) => (
                  <Enter key={t._id} index={4 + i}>
                    <TaskCard task={t} />
                  </Enter>
                ))}
              </View>
            )}
          </Boundary>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function TaskCard({ task }: { task: Task }) {
  const box = boxFor(task.primaryType);
  const title = itemTitle(task);
  return (
    <ScalePressable testID={`task-card-${task._id}`} accessibilityRole="button" accessibilityLabel={title} scaleTo={0.97} onPress={() => openItem(task._id)} style={[styles.card, { backgroundColor: box.color }]}>
      <View style={styles.cardTop}>
        <View style={styles.chip}>
          <Text style={styles.chipText}>{box.label}</Text>
        </View>
        <StatusPill state={task.state} />
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>
        {title}
      </Text>
      {task.summary ? (
        <Text style={styles.cardSummary} numberOfLines={1}>
          {task.summary}
        </Text>
      ) : null}
      {task.state === "running" ? (
        <View style={styles.bar} testID={`task-reading-${task._id}`}>
          <View style={{ flex: 1, gap: 6, overflow: "hidden" }}>
            <Text style={styles.barText} numberOfLines={1}>
              Zapy is reading this…
            </Text>
            <Shimmer color={box.color} width={160} />
          </View>
          <View style={[styles.play, { backgroundColor: palette.grey }]}>
            <SpinRing size={18} color={palette.ink} />
          </View>
        </View>
      ) : (
        <View style={styles.bar}>
          <Text style={styles.barText} numberOfLines={1}>
            {box.action ?? "See what Zapy can do"}
          </Text>
          <View style={styles.play}>
            <Ionicons name="play" size={16} color={colors.onPrimary} style={{ marginLeft: 2 }} />
          </View>
        </View>
      )}
    </ScalePressable>
  );
}

function StatusPill({ state }: { state: TaskState }) {
  if (state === "running")
    return (
      <View style={[styles.pill, { backgroundColor: "#FFFFFF" }]}>
        <SpinRing size={12} color={palette.ink} />
        <Text style={styles.pillText}>Reading…</Text>
      </View>
    );
  return (
    <View style={[styles.pill, { backgroundColor: state === "done" ? palette.mint : palette.butter, borderWidth: 1, borderColor: colors.text }]}>
      <Text style={styles.pillText}>{state === "done" ? "Done ✓" : "To review"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: TAB_BAR_SPACE },
  stack: { gap: 24 },
  xPill: { flex: 0, alignSelf: "flex-start", paddingHorizontal: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.text },
  pillBtn: { flex: 1, height: 44, borderRadius: 999, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 12 },
  pillBtnText: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 20, color: colors.text },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  ring: { width: 48, height: 48, borderRadius: 24, padding: 2 },
  avatar: { flex: 1, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  segment: { flexDirection: "row", gap: 4, padding: 4, borderRadius: 999, backgroundColor: palette.grey },
  segItem: { flex: 1, height: 44, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  segActive: { backgroundColor: colors.primary },
  segText: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 18, color: colors.text, fontVariant: ["tabular-nums"] },
  empty: { alignItems: "center", gap: 16, paddingVertical: 24 },
  emptyTitle: { fontFamily: fonts.extraBold, fontSize: 22, lineHeight: 26, color: colors.text },
  pull: { alignSelf: "stretch", height: 56, borderRadius: 999, backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  pullText: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.onPrimary },
  card: { borderRadius: 24, padding: 16, gap: 8 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  chip: { height: 28, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "#FFFFFF", justifyContent: "center" },
  chipText: { fontFamily: fonts.extraBold, fontSize: 11, lineHeight: 14, letterSpacing: 0.9, color: colors.text, textTransform: "uppercase" },
  pill: { height: 24, paddingHorizontal: 10, borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 6 },
  pillText: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 16, color: colors.text },
  cardTitle: { fontFamily: fonts.extraBold, fontSize: 16, lineHeight: 21, color: colors.text },
  cardSummary: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.text },
  bar: { marginTop: 4, height: 52, borderRadius: 26, backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 18, paddingRight: 6 },
  barText: { flex: 1, fontFamily: fonts.bold, fontSize: 14, lineHeight: 20, color: colors.text },
  play: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
});
