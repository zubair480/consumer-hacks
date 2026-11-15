import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { FlatList, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../../convex/_generated/api";
import { Boundary } from "../../components/Boundary";
import { EmptyState } from "../../components/EmptyState";
import { GradientButton } from "../../components/GradientButton";
import { itemTitle } from "../../components/ItemCard";
import { Tap } from "../../components/Pressable";
import { Skeleton } from "../../components/States";
import { colors, space } from "../../components/tokens";
import { metaFor, timeAgo } from "../../components/typeMeta";
import { DisplayTitle, Header, HeroTypeCard, HoloBand, ItemRow, TypeChip } from "../../components/ui";
import { useOwnedQuery } from "../../identity/OwnerProvider";
import type { ContentType } from "../../shared/contracts";

const openCapture = () => router.push("/capture");
const openImport = () => router.push("/import");
const openLibrary = () => router.push("/library");
const openItem = (id: string) => router.push({ pathname: "/item/[id]", params: { id } });

type Items = NonNullable<ReturnType<typeof useOwnedQuery<typeof api.items.list>>>;

export default function Home() {
  const items = useOwnedQuery(api.items.list, { limit: 50 });
  const profile = useOwnedQuery(api.preferences.get, {});
  const name = (profile as { name?: string } | null | undefined)?.name?.trim() || "there";
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <HoloBand height={300} />
      <ScrollView contentContainerStyle={styles.content} testID="home-screen">
        <Header
          name={name}
          saves={items?.length}
          right={
            <Tap testID="home-header-add-button" accessibilityLabel="Save something" haptic="medium" onPress={openCapture} style={styles.add}>
              <Ionicons name="add" size={24} color={colors.surface} />
            </Tap>
          }
        />
        <DisplayTitle>Turn saves into action</DisplayTitle>

        <Tap testID="home-save-button" accessibilityRole="button" accessibilityLabel="Save something" haptic="medium" onPress={openCapture} style={styles.search}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <Text style={styles.searchText}>Find a save, or save something new</Text>
          <View style={styles.searchPlus}>
            <Ionicons name="add" size={18} color={colors.surface} />
          </View>
        </Tap>

        <Tap testID="home-import-button" accessibilityRole="button" accessibilityLabel="Import saves" haptic="medium" onPress={openImport} style={styles.importPill}>
          <View style={styles.importIcon}>
            <Ionicons name="cloud-download-outline" size={18} color={colors.text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.importTitle}>Import saves</Text>
            <Text style={styles.meta} numberOfLines={1}>Pull in what you bookmarked on X</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={colors.text} />
        </Tap>

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
      <EmptyState icon="bookmark-outline" title="Nothing saved yet" body="Save a GitHub repo, a scholarship, a restaurant, or a design you liked. Zapy figures out what you can do with it.">
        <GradientButton testID="home-empty-import-button" label="Import your bookmarks" icon="cloud-download" variant="secondary" onPress={openImport} style={{ alignSelf: "stretch", marginTop: space.sm }} />
        <GradientButton testID="home-empty-save-button" label="Save your first thing" icon="add" onPress={openCapture} style={{ alignSelf: "stretch", marginTop: space.sm }} />
      </EmptyState>
    );
  }
  const counts = new Map<ContentType, number>();
  for (const i of items) if (i.primaryType) counts.set(i.primaryType, (counts.get(i.primaryType) ?? 0) + 1);
  return (
    <>
      {counts.size > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }} style={styles.bleed}>
          {[...counts.entries()].map(([t, n]) => (
            <TypeChip key={t} type={t} label={metaFor(t).label} count={n} onPress={openLibrary} testID={`home-type-chip-${t}`} />
          ))}
        </ScrollView>
      ) : null}
      <Boundary fallback={null}>
        <ReadyAndOutcomes items={items} />
      </Boundary>
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
            onPress={() => openItem(item._id)}
          />
        ))}
      </View>
    </>
  );
}

function ReadyAndOutcomes({ items }: { items: Items }) {
  const outcomes = useOwnedQuery(api.actions.recentOutcomes, { limit: 50 });
  if (outcomes === undefined) return null;
  const acted = new Set(outcomes.map((o) => o.itemId as string));
  const ready = items.filter((i) => i.extractionStatus === "ready" && !acted.has(i._id)).slice(0, 5);
  return (
    <>
      {ready.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ready for you</Text>
          <FlatList
            testID="home-ready-list"
            horizontal
            data={ready}
            keyExtractor={(i) => i._id}
            showsHorizontalScrollIndicator={false}
            style={styles.bleed}
            contentContainerStyle={{ gap: space.md, paddingHorizontal: space.xl }}
            renderItem={({ item }) => (
              <HeroTypeCard
                testID={`item-card-${item._id}`}
                width={290}
                type={item.primaryType}
                typeLabel={metaFor(item.primaryType).label}
                title={itemTitle(item)}
                summary={item.summary ?? undefined}
                source={item.sourceUrl?.replace(/^https?:\/\/(www\.)?/, "") ?? undefined}
                actionLabel="See 3 actions"
                onPress={() => openItem(item._id)}
              />
            )}
          />
        </View>
      ) : null}
      {outcomes.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Done</Text>
          {outcomes.slice(0, 5).map((r) => (
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
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.xl, gap: space.xl, paddingBottom: 60 },
  add: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.text, alignItems: "center", justifyContent: "center" },
  search: { flexDirection: "row", alignItems: "center", gap: space.sm, height: 52, paddingLeft: space.xl, paddingRight: 6, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  searchText: { flex: 1, fontSize: 15, color: colors.textFaint },
  searchPlus: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.text, alignItems: "center", justifyContent: "center" },
  importPill: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: 10, paddingLeft: 10, paddingRight: space.xl, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  importIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceRaised, alignItems: "center", justifyContent: "center" },
  importTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  bleed: { marginHorizontal: -space.xl },
  section: { gap: space.md },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 20, fontWeight: "800", letterSpacing: -0.2, color: colors.text },
  link: { color: colors.text, fontWeight: "700", fontSize: 14, textDecorationLine: "underline" },
  done: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm },
  check: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.text, alignItems: "center", justifyContent: "center" },
  doneTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted },
});
