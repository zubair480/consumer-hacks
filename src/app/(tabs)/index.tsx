import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { FlatList, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../../convex/_generated/api";
import { Boundary } from "../../components/Boundary";
import { itemTitle } from "../../components/ItemCard";
import { Tap } from "../../components/Pressable";
import { Skeleton } from "../../components/States";
import { colors, space } from "../../components/tokens";
import { metaFor, timeAgo } from "../../components/typeMeta";
import { CountChips, DisplayTitle, HeroTypeCard, HoloBand, HomeHeader, InkCTA, ItemRow, SearchPill, WaveBlock, pastelFor } from "../../components/ui";
import { useOwnedQuery } from "../../identity/OwnerProvider";
import type { ContentType } from "../../shared/contracts";

const openCapture = () => router.push("/capture");
const openImport = () => router.push("/import");
const openLibrary = () => router.push("/library");
const openItem = (id: string) => router.push({ pathname: "/item/[id]", params: { id } });
const openExample = (example: string) => router.push({ pathname: "/capture", params: { example } });

const STARTERS: { key: string; label: string; eyebrow: string; type: ContentType }[] = [
  { key: "scholarship", label: "A scholarship", eyebrow: "Check if you qualify", type: "scholarship" },
  { key: "github", label: "A GitHub repo", eyebrow: "Get a setup guide", type: "github_repository" },
  { key: "restaurant", label: "A restaurant", eyebrow: "Plan the visit", type: "restaurant" },
];

type Items = NonNullable<ReturnType<typeof useOwnedQuery<typeof api.items.list>>>;

export default function Home() {
  const items = useOwnedQuery(api.items.list, { limit: 50 });
  const profile = useOwnedQuery(api.preferences.get, {});
  const name = (profile as { name?: string } | null | undefined)?.name?.trim() || "there";
  const ready = items?.filter((i) => i.extractionStatus === "ready").length;
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <HoloBand height={320} />
      <ScrollView contentContainerStyle={styles.content} testID="home-screen" showsVerticalScrollIndicator={false}>
        <HomeHeader name={name} saves={items?.length} ready={ready} onAvatarPress={() => router.push("/profile")} />
        <DisplayTitle highlight="action">Turn saves into action</DisplayTitle>
        <Boundary title="Couldn’t load your saves">
          <Feed items={items} />
        </Boundary>
      </ScrollView>
    </SafeAreaView>
  );
}

function Feed({ items }: { items: Items | undefined }) {
  if (items === undefined) return <Skeleton rows={3} />;
  if (items.length === 0) {
    return (
      <>
        <InkCTA testID="home-empty-import-button" title="Import your X bookmarks" subtitle="Zapy turns each post into something to do" onPress={openImport} />
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Start with one of these</Text>
          <View>
            {STARTERS.map((s, i) => (
              <View key={s.key} style={{ marginTop: i === 0 ? 0 : -18, zIndex: i }}>
                <WaveBlock
                  testID={i === 0 ? "home-empty-save-button" : `home-example-${s.key}`}
                  label={s.label}
                  eyebrow={s.eyebrow}
                  color={pastelFor(s.type)}
                  last={i === STARTERS.length - 1}
                  onPress={() => openExample(s.key)}
                  right={
                    <View style={styles.blockArrow}>
                      <Ionicons name="arrow-forward" size={20} color={colors.surface} />
                    </View>
                  }
                />
              </View>
            ))}
          </View>
        </View>
      </>
    );
  }
  const counts = new Map<ContentType, number>();
  for (const i of items) if (i.primaryType) counts.set(i.primaryType, (counts.get(i.primaryType) ?? 0) + 1);
  return (
    <>
      <Tap testID="home-save-button" accessibilityRole="button" accessibilityLabel="Find a save or save something" haptic="medium" onPress={openCapture}>
        <View pointerEvents="none">
          <SearchPill editable={false} placeholder="Find a save, or save something new" />
        </View>
      </Tap>
      <CountChips
        chips={[
          { key: "all", label: "All", count: items.length, testID: "home-type-chip-all" },
          ...[...counts.entries()].map(([t, n]) => ({ key: t, label: metaFor(t).label, count: n, type: t, selected: false, testID: `home-type-chip-${t}` })),
        ]}
        onPress={openLibrary}
      />
      <Boundary fallback={null}>
        <Ready items={items} />
      </Boundary>
      <InkCTA testID="home-import-button" title="Import your X bookmarks" subtitle="Zapy turns each post into something to do" onPress={openImport} />
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Recently saved</Text>
          <Tap testID="home-see-all" onPress={openLibrary}>
            <Text style={styles.link}>See all</Text>
          </Tap>
        </View>
        {items.slice(0, 10).map((item) => (
          <ItemRow
            key={item._id}
            testID={`item-card-${item._id}`}
            type={item.primaryType}
            title={itemTitle(item)}
            meta={[item.extractionStatus === "ready" ? metaFor(item.primaryType).label : "Reading…", timeAgo(item.createdAt)].join(" · ")}
            status={item.extractionStatus === "ready" ? "ready" : item.extractionStatus === "failed" ? "failed" : "working"}
            onPress={() => openItem(item._id)}
          />
        ))}
      </View>
      <Boundary fallback={null}>
        <Done />
      </Boundary>
    </>
  );
}

function Ready({ items }: { items: Items }) {
  const outcomes = useOwnedQuery(api.actions.recentOutcomes, { limit: 50 });
  if (outcomes === undefined) return null;
  const acted = new Set(outcomes.map((o) => o.itemId as string));
  const ready = items.filter((i) => i.extractionStatus === "ready" && !acted.has(i._id)).slice(0, 5);
  if (ready.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Ready for you</Text>
      <FlatList
        testID="home-ready-list"
        horizontal
        data={ready}
        keyExtractor={(i) => i._id}
        showsHorizontalScrollIndicator={false}
        snapToInterval={280 + space.lg}
        decelerationRate="fast"
        style={styles.bleed}
        contentContainerStyle={{ gap: space.lg, paddingHorizontal: space.xl }}
        renderItem={({ item }) => (
          <HeroTypeCard
            testID={`item-card-${item._id}`}
            type={item.primaryType}
            typeLabel={metaFor(item.primaryType).label}
            title={itemTitle(item)}
            source={item.sourceUrl ?? undefined}
            age={timeAgo(item.createdAt)}
            actionLabel="See 3 actions"
            onPress={() => openItem(item._id)}
          />
        )}
      />
    </View>
  );
}

function Done() {
  const outcomes = useOwnedQuery(api.actions.recentOutcomes, { limit: 5 });
  if (!outcomes?.length) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Done</Text>
      {outcomes.map((r) => (
        <Tap key={r._id} testID={`outcome-${r._id}`} onPress={() => router.push({ pathname: "/result/[id]", params: { id: r.executionId } })} style={styles.done}>
          <View style={styles.check}>
            <Ionicons name="checkmark" size={16} color={colors.surface} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.doneTitle} numberOfLines={1}>{r.result.title}</Text>
            <Text style={styles.meta} numberOfLines={1}>{r.itemTitle ? `${r.itemTitle} · ` : ""}{timeAgo(r.createdAt)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
        </Tap>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.xl, gap: space.xl, paddingBottom: 72 },
  bleed: { marginHorizontal: -space.xl },
  section: { gap: space.md },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 20, fontWeight: "900", letterSpacing: -0.3, color: colors.text },
  link: { color: colors.text, fontWeight: "700", fontSize: 14, textDecorationLine: "underline" },
  blockArrow: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.text, alignItems: "center", justifyContent: "center" },
  done: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm },
  check: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.text, alignItems: "center", justifyContent: "center" },
  doneTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted },
});
