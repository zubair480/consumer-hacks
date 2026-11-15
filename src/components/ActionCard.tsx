import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import type { RequiredInput, SavedItemView, UserProfile } from "../shared/contracts";
import { useOwnedMutation } from "../identity/OwnerProvider";
import { api } from "../../convex/_generated/api";
import type { SuggestionRow } from "./api";
import { Field } from "./Field";
import { errorMessage } from "./media";
import { Tap } from "./Pressable";
import { colors, radius, space, type } from "./tokens";
import { shadows } from "../theme";

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

  const canRun = suggestion.canExecute && !running;
  const runLabel = latest?.resultId ? "Run again" : suggestion.requiresApproval ? "Prepare draft" : "Run";

  return (
    <View style={styles.card} testID={`action-${suggestion.actionType}`}>
      <View style={styles.head}>
        <View style={[styles.rank, { backgroundColor: color }]}><Text style={styles.rankText}>{suggestion.rank + 1}</Text></View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.title} numberOfLines={2}>{suggestion.title}</Text>
          <Text style={type.caption} numberOfLines={1}>{suggestion.description}</Text>
        </View>
        {canRun ? (
          <Tap
            testID={`action-button-${suggestion.rank}`}
            accessibilityRole="button"
            accessibilityLabel={runLabel}
            accessibilityState={{ disabled: busy || missing, busy }}
            disabled={busy || missing}
            haptic="medium"
            onPress={start}
            style={[styles.play, latest?.resultId && styles.playAgain, (busy || missing) && { opacity: 0.4 }]}
          >
            {busy ? <ActivityIndicator color={latest?.resultId ? colors.text : "#FFFFFF"} /> : <Ionicons name={latest?.resultId ? "refresh" : "play"} size={18} color={latest?.resultId ? colors.text : "#FFFFFF"} />}
          </Tap>
        ) : running ? (
          <View style={[styles.play, styles.playAgain]}><ActivityIndicator color={colors.text} /></View>
        ) : null}
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
          <Text style={styles.statusText}>Working on it… tap to watch</Text>
        </Tap>
      ) : null}
      {latest?.resultId ? (
        <Tap testID={`action-view-result-${suggestion.rank}`} onPress={() => openResult(latest._id)} style={styles.status}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={styles.statusText}>View result</Text>
        </Tap>
      ) : null}
      {latest?.status === "failed" && latest.error ? <Text style={styles.error}>Last run failed: {latest.error}</Text> : null}
      {!suggestion.canExecute ? (
        <View style={styles.status} testID={`action-unavailable-${suggestion.rank}`}>
          <Ionicons name="information-circle-outline" size={16} color={colors.textFaint} />
          <Text style={[styles.statusText, { color: colors.textFaint }]}>Not available for this save</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md, padding: space.lg, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...shadows.card },
  head: { flexDirection: "row", gap: space.md, alignItems: "center", minHeight: 44 },
  rank: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  rankText: { fontWeight: "900", fontSize: 16, color: colors.text },
  title: { fontSize: 17, lineHeight: 21, fontWeight: "800", color: colors.text },
  play: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.text, alignItems: "center", justifyContent: "center" },
  playAgain: { backgroundColor: colors.surfaceRaised },
  status: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised },
  statusText: { color: colors.text, fontWeight: "700", fontSize: 14 },
  error: { color: colors.danger, fontWeight: "600" },
});
