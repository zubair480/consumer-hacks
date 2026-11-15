import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { EmptyState } from "../../components/EmptyState";
import { Field } from "../../components/Field";
import { ItemCard } from "../../components/ItemCard";
import { Tap } from "../../components/Pressable";
import { ScreenHeader } from "../../components/ScreenHeader";
import { colors, radius, space } from "../../components/tokens";
import { typeMeta } from "../../components/typeMeta";
import { useOwnedMutation, useOwnedQuery } from "../../identity/OwnerProvider";
import { CONTENT_TYPES, type ContentType } from "../../shared/contracts";

export default function Library() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ContentType | undefined>();
  const searching = query.trim().length > 0;
  const listed = useOwnedQuery(api.items.list, searching ? "skip" : { primaryType: filter, limit: 100 });
  const searched = useOwnedQuery(api.items.search, searching ? { query, primaryType: filter } : "skip");
  const items = searching ? searched : listed;
  const retry = useOwnedMutation(api.items.retry);

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
          <Field testID="library-search-input" placeholder="Search your saves" value={query} onChangeText={setQuery} style={styles.search} returnKeyType="search" autoCorrect={false} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          <Chip testID="filter-all" label="All" active={!filter} onPress={() => setFilter(undefined)} />
          {CONTENT_TYPES.map((t) => (
            <Chip key={t} testID={`filter-${t}`} label={typeMeta[t].label} color={typeMeta[t].color} active={filter === t} onPress={() => setFilter(filter === t ? undefined : t)} />
          ))}
        </ScrollView>
      </View>
      {items === undefined ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: space.xxl }} />
      ) : (
        <FlatList
          testID="library-list"
          data={items}
          keyExtractor={(i) => i._id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              icon={searching || filter ? "search" : "albums-outline"}
              title={searching || filter ? "No matches" : "Your library is empty"}
              body={searching || filter ? "Try a different search or filter." : "Everything you save lands here and stays here."}
            />
          }
          renderItem={({ item }) => (
            <View>
              <ItemCard item={item} />
              {item.extractionStatus === "failed" ? (
                <Tap testID={`retry-${item._id}`} accessibilityLabel="Retry analysis" onPress={() => retry({ itemId: item._id as Id<"savedItems"> })} style={styles.retry}>
                  <Ionicons name="refresh" size={14} color={colors.danger} />
                  <Text style={styles.retryText}>Retry analysis</Text>
                </Tap>
              ) : null}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function Chip({ testID, label, active, color = colors.accent, onPress }: { testID: string; label: string; active: boolean; color?: string; onPress: () => void }) {
  return (
    <Tap testID={testID} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.chip, active && { backgroundColor: color + "26", borderColor: color }]}>
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
  filters: { gap: space.sm, paddingVertical: 2 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipText: { color: colors.textMuted, fontWeight: "700", fontSize: 13 },
  list: { padding: space.xl, paddingTop: space.sm, gap: space.md, paddingBottom: 60 },
  retry: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-end", marginTop: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.danger + "1A" },
  retryText: { color: colors.danger, fontWeight: "700", fontSize: 12 },
});
