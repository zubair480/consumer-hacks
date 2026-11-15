import { router } from "expo-router";
import { useState } from "react";
import { FlatList, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../../convex/_generated/api";
import { Boundary } from "../../components/Boundary";
import { EmptyState } from "../../components/EmptyState";
import { Button } from "../../components/ui";
import { itemTitle } from "../../components/ItemCard";
import { ScreenHeader } from "../../components/ScreenHeader";
import { Skeleton } from "../../components/States";
import { SourceRow } from "../../components/studio/SourceRow";
import { colors, radius, space } from "../../components/tokens";
import { useOwnedQuery } from "../../identity/OwnerProvider";

export default function SourcePicker() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.pad}><ScreenHeader title="Pick a save" back /></View>
      <Boundary title="Couldn’t load your Library">
        <List />
      </Boundary>
    </SafeAreaView>
  );
}

function List() {
  const [query, setQuery] = useState("");
  const items = useOwnedQuery(api.items.list, { limit: 200 });
  if (items === undefined) return <View style={styles.pad}><Skeleton rows={5} height={72} /></View>;
  const q = query.trim().toLowerCase();
  const ready = items.filter((i) => i.extractionStatus === "ready" || i.extractionStatus === "needs_input");
  const shown = q ? ready.filter((i) => itemTitle(i).toLowerCase().includes(q) || (i.summary ?? "").toLowerCase().includes(q)) : ready;
  return (
    <FlatList
      testID="studio-source-list"
      data={shown}
      keyExtractor={(i) => i._id}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={ready.length > 0 ? (
        <TextInput testID="studio-source-search" placeholder="Search your saves" placeholderTextColor={colors.textFaint} value={query} onChangeText={setQuery} style={styles.search} />
      ) : undefined}
      ListEmptyComponent={ready.length === 0 ? (
        <EmptyState icon="bookmark-outline" title="No saves ready yet" body="Save a link, text or screenshot first. Once it’s understood you can turn it into posts.">
          <Button testID="studio-source-capture" title="Save something" icon="add" onPress={() => router.push("/capture")} style={{ marginTop: space.sm }}  fullWidth />
        </EmptyState>
      ) : (
        <EmptyState icon="search" title="No matches" body="Try a different word." />
      )}
      renderItem={({ item }) => <SourceRow item={item} onPress={() => router.push({ pathname: "/studio/platforms", params: { itemId: item._id } })} />}
    />
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  pad: { paddingHorizontal: space.lg },
  list: { padding: space.lg, gap: space.sm, paddingBottom: 80 },
  search: { color: colors.text, fontSize: 16, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: space.sm },
});
