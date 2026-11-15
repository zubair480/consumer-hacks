import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ActionCard } from "../../../components/ActionCard";
import { Boundary } from "../../../components/Boundary";
import { itemTitle } from "../../../components/ItemCard";
import { OutcomeRow } from "../../../components/OutcomeRow";
import { ScreenHeader } from "../../../components/ScreenHeader";
import { Section } from "../../../components/Section";
import { Skeleton } from "../../../components/States";
import { colors, radius, space, type } from "../../../components/tokens";
import { TypeChip } from "../../../components/TypeChip";
import { metaFor } from "../../../components/typeMeta";
import { useOwnedQuery } from "../../../identity/OwnerProvider";
import { IN_PROGRESS_EXTRACTION_STATUSES, type SavedItemView } from "../../../shared/contracts";

export default function ContextualActions() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}><ScreenHeader title="Actions" back /></View>
      <ScrollView contentContainerStyle={styles.content} testID="actions-screen" keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>
        <Boundary title="Couldn’t load actions">
          <Body itemId={id as Id<"savedItems">} />
        </Boundary>
      </ScrollView>
    </SafeAreaView>
  );
}

function Body({ itemId }: { itemId: Id<"savedItems"> }) {
  const item = useOwnedQuery(api.items.get, { itemId });
  if (item === undefined) return <Skeleton rows={3} height={120} />;
  return (
    <>
      <View style={styles.gap}>
        <TypeChip type={item.primaryType} />
        <Text style={type.title} numberOfLines={2}>{itemTitle(item)}</Text>
      </View>
      {IN_PROGRESS_EXTRACTION_STATUSES.includes(item.extractionStatus) ? (
        <View style={styles.pending}><ActivityIndicator color={colors.accent} /><Text style={type.caption}>Still understanding this save. Actions appear when it’s ready.</Text></View>
      ) : (
        <ActionList item={item} />
      )}
    </>
  );
}

function ActionList({ item }: { item: SavedItemView }) {
  const itemId = item._id as Id<"savedItems">;
  const suggestions = useOwnedQuery(api.actions.listSuggestions, { itemId });
  const results = useOwnedQuery(api.actions.listResultsForItem, { itemId });
  const profile = useOwnedQuery(api.preferences.get, {});
  if (suggestions === undefined) return <Skeleton rows={3} height={120} />;
  return (
    <>
      {suggestions.length === 0 ? (
        <View style={styles.pending}><ActivityIndicator color={colors.accent} /><Text style={type.caption}>Picking the best actions for this save…</Text></View>
      ) : (
        <View style={styles.gap}>
          {[...suggestions].sort((a, b) => a.rank - b.rank).map((s) => <ActionCard key={s._id} suggestion={s} color={metaFor(item.primaryType).color} profile={profile} item={item} />)}
        </View>
      )}
      {results && results.length > 0 ? (
        <Section title="Your outcomes">
          {results.map((r) => <OutcomeRow key={r._id} row={r} />)}
        </Section>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  top: { paddingHorizontal: space.xl },
  content: { padding: space.xl, gap: space.xl, paddingBottom: 80 },
  gap: { gap: space.md },
  pending: { flexDirection: "row", gap: space.md, alignItems: "center", padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface },
});
