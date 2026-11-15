import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, FlatList, ScrollView, StyleSheet, Text, View } from "react-native";
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
import { DisplayTitle, ItemRow, SearchPill, TypeChip, WaveBlocks, pastelFor } from "../../components/ui";
import { useOwnedMutation, useOwnedQuery } from "../../identity/OwnerProvider";
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
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.top}>
        <View style={styles.titleRow}>
          <DisplayTitle>Library</DisplayTitle>
          <Tap testID="library-add-button" accessibilityLabel="Save something" onPress={() => router.push("/capture")} style={styles.add}>
            <Ionicons name="add" size={24} color={colors.surface} />
          </Tap>
        </View>
        <SearchPill
          testID="library-search-input"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>
      <Boundary title="Couldn’t load your library">
        <Results query={query} filter={filter} setFilter={setFilter} />
      </Boundary>
    </SafeAreaView>
  );
}

function Results({ query, filter, setFilter }: { query: string; filter?: ContentType; setFilter: (t?: ContentType) => void }) {
  const searching = query.trim().length > 0;
  const all = useOwnedQuery(api.items.list, { limit: 200 });
  const searched = useOwnedQuery(api.items.search, searching ? { query, primaryType: filter } : "skip");
  const retry = useOwnedMutation(api.items.retry);
  const counts = new Map<ContentType, number>();
  for (const i of all ?? []) if (i.primaryType) counts.set(i.primaryType, (counts.get(i.primaryType) ?? 0) + 1);
  const present = CONTENT_TYPES.filter((t) => counts.has(t));
  const items = searching ? searched : all?.filter((i) => !filter || i.primaryType === filter);
  const filtered = searching || !!filter;
  const toggle = (t: ContentType) => setFilter(filter === t ? undefined : t);

  return (
    <>
      {present.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} style={styles.filterBar}>
          <TypeChip testID="filter-all" label="All" count={all?.length} color={colors.surface} selected={!filter} onPress={() => setFilter(undefined)} />
          {present.map((t) => (
            <TypeChip key={t} testID={`filter-${t}`} type={t} label={metaFor(t).label} count={counts.get(t)} selected={filter === t} onPress={() => toggle(t)} />
          ))}
        </ScrollView>
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
          contentContainerStyle={styles.list}
          keyboardDismissMode="on-drag"
          ListHeaderComponent={
            !searching && !filter && present.length > 1 ? (
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
                <GradientButton testID="library-empty-save-button" label="Save something" icon="add" onPress={() => router.push("/capture")} style={{ alignSelf: "stretch" }} />
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
                  <Text style={styles.retryText}>Retry</Text>
                </Tap>
              ) : null}
            </View>
          )}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  top: { paddingHorizontal: space.xl, paddingTop: space.md, gap: space.lg, paddingBottom: space.md },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  add: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.text, alignItems: "center", justifyContent: "center" },
  filterBar: { flexGrow: 0 },
  filters: { gap: space.sm, paddingHorizontal: space.xl, paddingVertical: 4 },
  blocks: { marginBottom: space.sm },
  list: { padding: space.xl, paddingTop: space.md, gap: space.md, paddingBottom: 120 },
  retry: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-end", paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.text },
  retryText: { color: colors.surface, fontWeight: "700", fontSize: 13 },
});
