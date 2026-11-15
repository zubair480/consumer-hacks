import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Boundary } from "../../components/Boundary";
import { EmptyState } from "../../components/EmptyState";
import { GradientButton } from "../../components/GradientButton";
import { itemTitle } from "../../components/ItemCard";
import { errorMessage } from "../../components/media";
import { Tap } from "../../components/Pressable";
import { Skeleton } from "../../components/States";
import { colors, radius, space } from "../../components/tokens";
import { metaFor, timeAgo } from "../../components/typeMeta";
import { CountChips, HoloBand, InkPill, ItemRow, SearchPill, SectionTitle, Text as ZText, WaveBlock, WaveBlocks, pastelFor } from "../../components/ui";
import { TAB_BAR_SPACE, useTabBarScroll } from "../../components/ui/InkTabBar";
import { MarkerTitle } from "../../components/ui/MarkerTitle";
import { useProfile } from "../../lib/useProfile";
import { useOwnedMutation, useOwnedPaginatedQuery, useOwnedQuery } from "../../identity/OwnerProvider";
import { fonts, palette } from "../../theme";
import { CONTENT_TYPES, type ContentType, type ExtractionStatus } from "../../shared/contracts";

const STATUS_META: Partial<Record<ExtractionStatus, string>> = {
  pending: "Reading…",
  extracting: "Reading…",
  analyzing: "Understanding…",
  needs_input: "Needs info",
  failed: "Failed",
};

export default function Library() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ContentType | undefined>();
  const [chipsOpen, setChipsOpen] = useState(true);
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const first = useProfile()?.displayName?.split(/\s+/)[0];
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <HoloBand height={140} />
      <View style={styles.top}>
        <View style={{ gap: 12 }}>
          <InkPill label="Library" />
          <MarkerTitle lines={first ? [`${first}'s`, "library"] : ["Your", "library"]} marker={first ? `${first}'s` : "library"} color={palette.lavender} size={34} testID="library-title" />
        </View>
        <SearchPill
          testID="library-search-input"
          outlined
          placeholder="Search your saves"
          autoFocus={focus === "search"}
          onFilterPress={() => setChipsOpen((o) => !o)}
          filterTestID="library-filter-button"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>
      <Boundary title="Couldn’t load your library">
        <Results query={query} filter={filter} setFilter={setFilter} chipsOpen={chipsOpen} />
      </Boundary>
    </SafeAreaView>
  );
}

function Results({ query, filter, setFilter, chipsOpen }: { query: string; filter?: ContentType; setFilter: (t?: ContentType) => void; chipsOpen: boolean }) {
  const searching = query.trim().length > 0;
  const all = useOwnedQuery(api.items.list, { limit: 200 });
  const paged = useOwnedPaginatedQuery(api.items.listPage, searching ? "skip" : { primaryType: filter }, { initialNumItems: 20 });
  const searched = useOwnedQuery(api.items.search, searching ? { query, primaryType: filter } : "skip");
  const retry = useOwnedMutation(api.items.retry);
  const counts = new Map<ContentType, number>();
  for (const i of all ?? []) if (i.primaryType) counts.set(i.primaryType, (counts.get(i.primaryType) ?? 0) + 1);
  const present = CONTENT_TYPES.filter((t) => counts.has(t));
  const items = searching ? searched : paged.status === "LoadingFirstPage" ? undefined : paged.results;
  const filtered = searching || !!filter;
  const toggle = (t: ContentType) => setFilter(filter === t ? undefined : t);
  const scroll = useTabBarScroll();
  const tryOne = !filtered && all !== undefined && all.length > 0 && all.length < 3;

  return (
    <>
      {chipsOpen && present.length > 0 ? (
        <View style={styles.filters}>
          <CountChips
            chips={[
              { key: "all", label: "All", count: all?.length, selected: !filter, testID: "filter-all" },
              ...present.map((t) => ({ key: t, label: metaFor(t).label, count: counts.get(t), type: t, selected: filter === t, testID: `filter-${t}` })),
            ]}
            onPress={(key) => (key === "all" ? setFilter(undefined) : toggle(key as ContentType))}
          />
        </View>
      ) : null}
      {items === undefined ? (
        <View style={styles.list}>
          <Skeleton rows={4} />
        </View>
      ) : (
        <FlatList
          testID="library-list"
          data={items}
          keyExtractor={(i) => i._id}
          {...scroll}
          contentContainerStyle={styles.list}
          keyboardDismissMode="on-drag"
          onEndReached={() => (!searching && paged.status === "CanLoadMore" ? paged.loadMore(20) : undefined)}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            !searching && paged.status === "LoadingMore" ? (
              <ActivityIndicator testID="library-loading-more" color={colors.text} style={{ padding: space.lg }} />
            ) : tryOne ? (
              <TryOne />
            ) : undefined
          }
          ListHeaderComponent={
            !searching && !filter && present.length > 0 ? (
              <View style={styles.blocks}>
                <WaveBlocks
                  blocks={present.map((t) => ({ key: t, label: metaFor(t).label, count: counts.get(t) ?? 0, color: pastelFor(t), testID: `library-block-${t}` }))}
                  onPress={(key) => toggle(key as ContentType)}
                />
              </View>
            ) : undefined
          }
          ListEmptyComponent={
            <EmptyState
              icon={filtered ? "search" : "albums-outline"}
              title={filtered ? "No matches" : "Your library is empty"}
              body={filtered ? "Try a different search or filter." : "Everything you save lands here and stays here."}
            >
              {filtered ? (
                <GradientButton testID="library-clear-filters-button" label="Show everything" variant="secondary" onPress={() => setFilter(undefined)} style={{ alignSelf: "stretch" }} />
              ) : (
                <GradientButton testID="library-empty-save-button" label="Save something" onPress={() => router.push("/capture")} style={{ alignSelf: "stretch" }} />
              )}
            </EmptyState>
          }
          renderItem={({ item }) => (
            <View style={{ gap: 6 }}>
              <ItemRow
                testID={`item-card-${item._id}`}
                type={item.primaryType}
                title={itemTitle(item)}
                meta={[STATUS_META[item.extractionStatus] ?? metaFor(item.primaryType).label, timeAgo(item.createdAt)].join(" · ")}
                status={item.extractionStatus === "ready" ? "ready" : item.extractionStatus === "failed" ? "failed" : "working"}
                onPress={() => router.push({ pathname: "/item/[id]", params: { id: item._id } })}
              />
              {item.extractionStatus === "failed" ? (
                <Tap
                  testID={`retry-${item._id}`}
                  accessibilityLabel="Retry analysis"
                  onPress={() => retry({ itemId: item._id as Id<"savedItems"> }).catch((e) => Alert.alert("Couldn’t retry", errorMessage(e)))}
                  style={styles.retry}
                >
                  <Ionicons name="refresh" size={14} color={colors.surface} />
                  <ZText style={styles.retryText}>Retry</ZText>
                </Tap>
              ) : null}
            </View>
          )}
        />
      )}
    </>
  );
}

const STARTERS: { key: string; label: string; eyebrow: string; type: ContentType }[] = [
  { key: "scholarship", label: "A scholarship", eyebrow: "CHECK IF YOU QUALIFY", type: "scholarship" },
  { key: "github", label: "A GitHub repo", eyebrow: "GET A SETUP GUIDE", type: "github_repository" },
  { key: "restaurant", label: "A restaurant", eyebrow: "PLAN THE VISIT", type: "restaurant" },
];

function TryOne() {
  return (
    <View style={{ gap: 12, marginTop: 16 }}>
      <SectionTitle title="Try one" />
      <View>
        {STARTERS.map((s, i) => (
          <View key={s.key} style={{ marginTop: i === 0 ? 0 : -14, zIndex: i }}>
            <WaveBlock testID={`library-example-${s.key}`} label={s.label} eyebrow={s.eyebrow} color={pastelFor(s.type)} last={i === STARTERS.length - 1} onPress={() => router.push({ pathname: "/capture", params: { example: s.key } })} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  top: { paddingHorizontal: space.xl, paddingTop: space.md, gap: space.lg, paddingBottom: space.md },
  filters: { paddingHorizontal: space.xl, paddingVertical: 4 },
  blocks: { marginBottom: space.sm },
  list: { padding: space.xl, paddingTop: space.md, gap: space.md, paddingBottom: TAB_BAR_SPACE },
  retry: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-end", paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.text },
  retryText: { color: colors.surface, fontFamily: fonts.bold, fontSize: 13, lineHeight: 18 },
});
