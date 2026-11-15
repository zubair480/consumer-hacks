import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, FlatList, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Boundary } from "../../components/Boundary";
import { EmptyState } from "../../components/EmptyState";
import { errorMessage } from "../../components/media";
import { Field } from "../../components/Field";
import { GradientButton } from "../../components/GradientButton";
import { ItemCard } from "../../components/ItemCard";
import { Tap } from "../../components/Pressable";
import { ScreenHeader } from "../../components/ScreenHeader";
import { Skeleton } from "../../components/States";
import { colors, radius, space } from "../../components/tokens";
import { typeMeta } from "../../components/typeMeta";
import { useOwnedMutation, useOwnedQuery } from "../../identity/OwnerProvider";
import { CONTENT_TYPES, type ContentType } from "../../shared/contracts";

export default function Library() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ContentType | undefined>();
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.top}>
        <ScreenHeader
          title="Library"
          right={
            <Tap testID="library-add-button" accessibilityLabel="Save something" onPress={() => router.push("/capture")} style={styles.add}>
              <Ionicons name="add" size={22} color={colors.text} />
            </Tap>
          }
        />
        <View>
          <Ionicons name="search" size={18} color={colors.textFaint} style={styles.searchIcon} />
          <Field testID="library-search-input" placeholder="Search titles, summaries, text" value={query} onChangeText={setQuery} style={styles.search} returnKeyType="search" autoCorrect={false} clearButtonMode="while-editing" />
        </View>
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
  const present = CONTENT_TYPES.filter((t) => all?.some((i) => i.primaryType === t));
  const items = searching ? searched : all?.filter((i) => !filter || i.primaryType === filter);
  const filtered = searching || !!filter;

  return (
    <>
      {present.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} style={styles.filterBar}>
          <Chip testID="filter-all" label="All" active={!filter} onPress={() => setFilter(undefined)} />
          {present.map((t) => (
            <Chip key={t} testID={`filter-${t}`} label={typeMeta[t].label} color={typeMeta[t].color} active={filter === t} onPress={() => setFilter(filter === t ? undefined : t)} />
          ))}
        </ScrollView>
      ) : null}
      {items === undefined ? (
        <View style={styles.list}><Skeleton rows={4} /></View>
      ) : (
        <FlatList
          testID="library-list"
          data={items}
          keyExtractor={(i) => i._id}
          contentContainerStyle={styles.list}
          keyboardDismissMode="on-drag"
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
            <View>
              <ItemCard item={item} />
              {item.extractionStatus === "failed" ? (
                <Tap testID={`retry-${item._id}`} accessibilityLabel="Retry analysis" onPress={() => retry({ itemId: item._id as Id<"savedItems"> }).catch((e) => Alert.alert("Couldn’t retry", errorMessage(e)))} style={styles.retry}>
                  <Ionicons name="refresh" size={14} color={colors.danger} />
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

function Chip({ testID, label, active, color = colors.accent, onPress }: { testID: string; label: string; active: boolean; color?: string; onPress: () => void }) {
  return (
    <Tap testID={testID} accessibilityRole="button" accessibilityLabel={`Filter ${label}`} accessibilityState={{ selected: active }} onPress={onPress} style={[styles.chip, active && { backgroundColor: color + "26", borderColor: color }]}>
      <Text style={[styles.chipText, active && { color }]}>{label}</Text>
    </Tap>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  top: { paddingHorizontal: space.xl, gap: space.md, paddingBottom: space.sm },
  add: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceRaised, alignItems: "center", justifyContent: "center" },
  search: { paddingLeft: 44 },
  searchIcon: { position: "absolute", left: 16, top: 16, zIndex: 1 },
  filterBar: { flexGrow: 0 },
  filters: { gap: space.sm, paddingHorizontal: space.xl, paddingVertical: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipText: { color: colors.textMuted, fontWeight: "700", fontSize: 13 },
  list: { padding: space.xl, paddingTop: space.md, gap: space.md, paddingBottom: 60 },
  retry: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-end", marginTop: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.danger + "1A" },
  retryText: { color: colors.danger, fontWeight: "700", fontSize: 12 },
});
