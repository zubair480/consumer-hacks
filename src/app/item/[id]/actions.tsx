import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { actionsApi, type SuggestionRow } from "../../../components/actionsApi";
import { Boundary } from "../../../components/Boundary";
import { EmptyState } from "../../../components/EmptyState";
import { Field } from "../../../components/Field";
import { GradientButton } from "../../../components/GradientButton";
import { itemTitle } from "../../../components/ItemCard";
import { errorMessage } from "../../../components/media";
import { OutcomeRow } from "../../../components/OutcomeRow";
import { Tap } from "../../../components/Pressable";
import { ScreenHeader } from "../../../components/ScreenHeader";
import { Section } from "../../../components/Section";
import { colors, radius, space, type } from "../../../components/tokens";
import { TypeChip } from "../../../components/TypeChip";
import { metaFor } from "../../../components/typeMeta";
import { useOwnedMutation, useOwnedQuery } from "../../../identity/OwnerProvider";
import { IN_PROGRESS_EXTRACTION_STATUSES } from "../../../shared/contracts";

export default function ContextualActions() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = id as Id<"savedItems">;
  const item = useOwnedQuery(api.items.get, { itemId });
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}><ScreenHeader title="Actions" back /></View>
      <ScrollView contentContainerStyle={styles.content} testID="actions-screen">
        {item === undefined ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <>
            <View style={styles.gap}>
              <TypeChip type={item.primaryType} />
              <Text style={type.title} numberOfLines={2}>{itemTitle(item)}</Text>
            </View>
            <Boundary fallback={<EmptyState icon="construct-outline" title="Actions are on their way" body="Action suggestions aren't available on this server yet. Your save is safe; check back shortly." />}>
              {IN_PROGRESS_EXTRACTION_STATUSES.includes(item.extractionStatus) ? (
                <View style={styles.pending}><ActivityIndicator color={colors.accent} /><Text style={type.caption}>Still understanding this save. Actions appear when it&apos;s ready.</Text></View>
              ) : (
                <ActionList itemId={itemId} color={metaFor(item.primaryType).color} />
              )}
            </Boundary>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionList({ itemId, color }: { itemId: Id<"savedItems">; color: string }) {
  const suggestions = useOwnedQuery(actionsApi.listSuggestions, { itemId });
  const results = useOwnedQuery(actionsApi.listResultsForItem, { itemId });
  if (suggestions === undefined) return <ActivityIndicator color={colors.accent} />;
  return (
    <>
      {suggestions.length === 0 ? (
        <View style={styles.pending}><ActivityIndicator color={colors.accent} /><Text style={type.caption}>Picking the best actions for this save…</Text></View>
      ) : (
        <View style={styles.gap}>
          {[...suggestions].sort((a, b) => a.rank - b.rank).map((s) => <ActionCard key={s._id} suggestion={s} color={color} />)}
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

function ActionCard({ suggestion, color }: { suggestion: SuggestionRow; color: string }) {
  const execute = useOwnedMutation(actionsApi.execute);
  const [open, setOpen] = useState(false);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = suggestion.latestExecution;
  const needsInputs = suggestion.requiredInputs.length > 0;
  const missing = suggestion.requiredInputs.some((i) => i.required && !inputs[i.key]?.trim());

  const run = async () => {
    if (needsInputs && !open) return setOpen(true);
    setBusy(true);
    setError(null);
    try {
      const executionId = await execute({ suggestionId: suggestion._id, inputs: needsInputs ? inputs : undefined });
      router.push({ pathname: "/result/[id]", params: { id: executionId } });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.card, { borderColor: color + "55" }]} testID={`action-${suggestion.actionType}`}>
      <View style={styles.cardHead}>
        <View style={[styles.rank, { backgroundColor: color + "26" }]}><Text style={[styles.rankText, { color }]}>{suggestion.rank + 1}</Text></View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={type.heading}>{suggestion.title}</Text>
          <Text style={type.caption}>{suggestion.description}</Text>
        </View>
      </View>
      {open ? (
        <View style={styles.gap}>
          {suggestion.requiredInputs.map((i) => (
            <Field
              key={i.key}
              testID={`action-input-${i.key}`}
              placeholder={i.label + (i.required ? "" : " (optional)")}
              value={inputs[i.key] ?? ""}
              keyboardType={i.kind === "number" ? "numeric" : "default"}
              onChangeText={(v) => setInputs((p) => ({ ...p, [i.key]: v }))}
            />
          ))}
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {latest && (latest.status === "queued" || latest.status === "running") ? (
        <Tap testID={`action-progress-${suggestion.rank}`} onPress={() => router.push({ pathname: "/result/[id]", params: { id: latest._id } })} style={styles.soon}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={[styles.soonText, { color: colors.accent }]}>Working on it…</Text>
        </Tap>
      ) : null}
      {latest?.resultId ? (
        <Tap testID={`action-view-result-${suggestion.rank}`} onPress={() => router.push({ pathname: "/result/[id]", params: { id: latest._id } })} style={styles.soon}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={[styles.soonText, { color: colors.success }]}>View result</Text>
        </Tap>
      ) : null}
      {latest?.status === "failed" && latest.error ? <Text style={styles.error}>Last run failed: {latest.error}</Text> : null}
      {suggestion.canExecute ? (
        <GradientButton
          testID={`action-button-${suggestion.rank}`}
          label={open ? "Run" : latest?.resultId ? "Run again" : suggestion.requiresApproval ? "Prepare draft" : "Do it"}
          icon="flash"
          onPress={run}
          loading={busy}
          disabled={open && missing}
        />
      ) : (
        <Tap testID={`action-button-${suggestion.rank}`} disabled style={styles.soon}>
          <Ionicons name="information-circle-outline" size={16} color={colors.textFaint} />
          <Text style={styles.soonText}>Not available for this save</Text>
        </Tap>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  top: { paddingHorizontal: space.xl },
  content: { padding: space.xl, gap: space.xl, paddingBottom: 60 },
  gap: { gap: space.md },
  pending: { flexDirection: "row", gap: space.md, alignItems: "center", padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface },
  card: { gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1 },
  cardHead: { flexDirection: "row", gap: space.md },
  rank: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  rankText: { fontWeight: "800" },
  soon: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.surfaceRaised },
  soonText: { color: colors.textFaint, fontWeight: "700" },
  error: { color: colors.danger, fontWeight: "600" },
});

