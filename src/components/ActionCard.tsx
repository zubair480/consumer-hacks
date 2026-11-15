import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import type { RequiredInput, SavedItemView, UserProfile } from "../shared/contracts";
import { useOwnedMutation } from "../identity/OwnerProvider";
import { api } from "../../convex/_generated/api";
import type { SuggestionRow } from "./api";
import { Field } from "./Field";
import { GradientButton } from "./GradientButton";
import { errorMessage } from "./media";
import { Tap } from "./Pressable";
import { colors, radius, space, type } from "./tokens";

function prefill(input: RequiredInput, profile: UserProfile | undefined, item: SavedItemView | undefined): string {
  const from = (input as RequiredInput & { prefillFrom?: string }).prefillFrom;
  const [scope, field] = from?.split(".") ?? [];
  const source: Record<string, unknown> | undefined = scope === "item" ? item : scope === "profile" ? profile : undefined;
  const direct = field && source ? source[field] : undefined;
  if (direct !== undefined && direct !== null && direct !== "") return Array.isArray(direct) ? direct.join(", ") : String(direct);
  if (!profile) return "";
  const key = input.key.toLowerCase();
  const guess = (Object.keys(profile) as (keyof UserProfile)[]).find((k) => key.includes(k.toLowerCase()));
  const value = guess ? profile[guess] : undefined;
  return value === undefined ? "" : Array.isArray(value) ? value.join(", ") : String(value);
}

export function ActionCard({ suggestion, color, profile, item }: { suggestion: SuggestionRow; color: string; profile?: UserProfile; item?: SavedItemView }) {
  const execute = useOwnedMutation(api.actions.execute);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = suggestion.latestExecution;
  const running = latest?.status === "queued" || latest?.status === "running";
  const fields = suggestion.requiredInputs;
  const values = Object.fromEntries(fields.map((f) => [f.key, inputs[f.key] ?? prefill(f, profile, item)]));
  const missing = fields.some((f) => f.required && !values[f.key]?.trim());
  const openResult = (id: string) => router.push({ pathname: "/result/[id]", params: { id } });

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const filled = Object.fromEntries(Object.entries(values).filter(([, v]) => v.trim()));
      const executionId = await execute({ suggestionId: suggestion._id, inputs: fields.length ? filled : undefined });
      openResult(executionId);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const start = () => {
    if (!suggestion.requiresApproval) return run();
    Alert.alert(
      suggestion.title,
      "Zapy will prepare this for you as a draft. Nothing is sent, posted, or booked: you review it, then copy or share it yourself.",
      [{ text: "Cancel", style: "cancel" }, { text: "Prepare draft", onPress: run }],
    );
  };

  return (
    <View style={[styles.card, { borderColor: color + "55" }]} testID={`action-${suggestion.actionType}`}>
      <View style={styles.head}>
        <View style={[styles.rank, { backgroundColor: color + "26" }]}><Text style={[styles.rankText, { color }]}>{suggestion.rank + 1}</Text></View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={type.heading}>{suggestion.title}</Text>
          <Text style={type.caption}>{suggestion.description}</Text>
        </View>
      </View>
      {fields.length > 0 ? (
        <View style={{ gap: space.sm }}>
          {fields.map((f) => (
            <View key={f.key} style={{ gap: 4 }}>
              <Text style={type.label}>{f.label}{f.required ? "" : " · optional"}</Text>
              <Field
                testID={`action-input-${f.key}`}
                placeholder={f.kind === "choice" && f.options ? f.options.join(" / ") : f.label}
                value={values[f.key]}
                keyboardType={f.kind === "number" ? "decimal-pad" : "default"}
                onChangeText={(v) => setInputs((p) => ({ ...p, [f.key]: v }))}
              />
            </View>
          ))}
        </View>
      ) : null}
      {error ? <Text style={styles.error} testID={`action-error-${suggestion.rank}`}>{error}</Text> : null}
      {running && latest ? (
        <Tap testID={`action-progress-${suggestion.rank}`} onPress={() => openResult(latest._id)} style={styles.status}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={[styles.statusText, { color: colors.accent }]}>Working on it…</Text>
        </Tap>
      ) : null}
      {latest?.resultId ? (
        <Tap testID={`action-view-result-${suggestion.rank}`} onPress={() => openResult(latest._id)} style={styles.status}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={[styles.statusText, { color: colors.success }]}>View result</Text>
        </Tap>
      ) : null}
      {latest?.status === "failed" && latest.error ? <Text style={styles.error}>Last run failed: {latest.error}</Text> : null}
      {suggestion.canExecute ? (
        running ? null : (
          <GradientButton
            testID={`action-button-${suggestion.rank}`}
            label={latest?.resultId ? "Run again" : suggestion.requiresApproval ? "Prepare draft" : "Run"}
            icon="flash"
            variant={latest?.resultId ? "secondary" : "primary"}
            onPress={start}
            loading={busy}
            disabled={missing}
          />
        )
      ) : (
        <View style={styles.status} testID={`action-unavailable-${suggestion.rank}`}>
          <Ionicons name="information-circle-outline" size={16} color={colors.textFaint} />
          <Text style={styles.statusText}>Not available for this save</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1 },
  head: { flexDirection: "row", gap: space.md },
  rank: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  rankText: { fontWeight: "800" },
  status: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.surfaceRaised },
  statusText: { color: colors.textFaint, fontWeight: "700" },
  error: { color: colors.danger, fontWeight: "600" },
});
