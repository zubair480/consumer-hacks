import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut, ReduceMotion, SlideInDown, SlideOutDown, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "./ui/Button";
import type { RequiredInput, SavedItemView, UserProfile } from "../shared/contracts";
import { useOwnedMutation } from "../identity/OwnerProvider";
import { api } from "../../convex/_generated/api";
import type { SuggestionRow } from "./api";
import { Field } from "./Field";
import { errorMessage } from "./media";
import { Tap } from "./Pressable";
import { colors, radius, space } from "./tokens";
import { fonts, palette } from "../theme";
import { SpinRing, success } from "./Signature";
import { Text } from "./ui/Text";

function prefill(input: RequiredInput, profile: UserProfile | undefined, item: SavedItemView | undefined): string {
  const from = (input as RequiredInput & { prefillFrom?: string }).prefillFrom;
  const [scope, field] = from?.split(".") ?? [];
  const source: Record<string, unknown> | undefined = scope === "item" ? item : scope === "profile" ? profile : undefined;
  const direct = field && source ? source[field] : undefined;
  if (direct !== undefined && direct !== null && direct !== "") return Array.isArray(direct) ? direct.join(", ") : String(direct);
  if (!profile) return "";
  const key = `${input.key} ${input.label}`.toLowerCase().replace(/[^a-z0-9]/g, "");
  const guess = (Object.keys(profile) as (keyof UserProfile)[]).find((k) => key.includes(k.toLowerCase()));
  const value = guess ? profile[guess] : undefined;
  return value === undefined ? "" : Array.isArray(value) ? value.join(", ") : String(value);
}

export function ActionCard({ suggestion, color, profile, item }: { suggestion: SuggestionRow; color: string; profile?: UserProfile; item?: SavedItemView }) {
  const execute = useOwnedMutation(api.actions.execute);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(false);
  const reduce = useReducedMotion();
  const insets = useSafeAreaInsets();
  const [error, setError] = useState<string | null>(null);
  const latest = suggestion.latestExecution;
  const running = latest?.status === "queued" || latest?.status === "running";
  const fields = suggestion.requiredInputs;
  const values = Object.fromEntries(fields.map((f) => [f.key, inputs[f.key] ?? prefill(f, profile, item)]));
  const missing = fields.some((f) => f.required && !values[f.key]?.trim());
  const openResult = (id: string) => router.push({ pathname: "/result/[id]", params: { id } });

  const run = async () => {
    setSheet(false);
    setBusy(true);
    setError(null);
    try {
      const filled = Object.fromEntries(Object.entries(values).filter(([, v]) => v.trim()));
      const executionId = await execute({ suggestionId: suggestion._id, inputs: fields.length ? filled : undefined });
      success();
      openResult(executionId);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => {
    if (!suggestion.requiresApproval) return run();
    Alert.alert(
      suggestion.title,
      "Zapy will prepare this for you as a draft. Nothing is sent, posted, or booked: you review it, then copy or share it yourself.",
      [{ text: "Cancel", style: "cancel" }, { text: "Prepare draft", onPress: run }],
    );
  };

  const start = () => (fields.length > 0 ? setSheet(true) : confirm());
  const canRun = suggestion.canExecute && !running;
  const runLabel = latest?.resultId ? "Run again" : suggestion.requiresApproval ? "Prepare draft" : "Run";

  return (
    <View style={styles.card} testID={`action-${suggestion.actionType}`}>
      <View style={styles.head}>
        <View style={[styles.rank, { backgroundColor: color }]}><Text style={styles.rankText}>{suggestion.rank + 1}</Text></View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.title} numberOfLines={2}>{suggestion.title}</Text>
          <Text style={styles.desc} numberOfLines={1}>{busy || running ? "Working…" : suggestion.description}</Text>
        </View>
        {canRun ? (
          <Tap
            testID={`action-button-${suggestion.rank}`}
            accessibilityRole="button"
            accessibilityLabel={runLabel}
            accessibilityState={{ disabled: busy, busy }}
            disabled={busy}
            haptic="light"
            hitSlop={4}
            onPress={start}
            style={styles.play}
          >
            {busy ? <SpinRing /> : <Ionicons name={latest?.resultId ? "refresh" : "play"} size={18} color={palette.white} style={latest?.resultId ? null : { marginLeft: 2 }} />}
          </Tap>
        ) : running ? (
          <View style={styles.play}><SpinRing /></View>
        ) : null}
      </View>
      <Modal visible={sheet} transparent animationType="none" statusBarTranslucent onRequestClose={() => setSheet(false)}>
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.scrim}>
          <Pressable testID={`action-sheet-close-${suggestion.rank}`} accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={() => setSheet(false)} />
        </Animated.View>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.sheetWrap} pointerEvents="box-none">
          <Animated.View
            entering={(reduce ? FadeIn.duration(200) : SlideInDown.springify().damping(20).stiffness(140)).reduceMotion(ReduceMotion.Never)}
            exiting={reduce ? FadeOut.duration(200) : SlideOutDown.duration(280)}
            style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}
            testID={`action-sheet-${suggestion.rank}`}
          >
            <View style={styles.grabber} />
            <View style={styles.sheetHead}>
              <View style={[styles.rank, { backgroundColor: color }]}><Text style={styles.rankText}>{suggestion.rank + 1}</Text></View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.sheetTitle} numberOfLines={2}>{suggestion.title}</Text>
                <Text style={styles.desc} numberOfLines={2}>Prefilled from your Profile. Edit anything before you run it.</Text>
              </View>
            </View>
            <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: space.sm }}>
          {fields.map((f) => (
            <View key={f.key} style={{ gap: 4 }}>
              <Text style={styles.overline}>{f.label}{f.required ? "" : " · optional"}</Text>
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
            </ScrollView>
            <Button testID={`action-sheet-run-${suggestion.rank}`} title={runLabel} icon="play" fullWidth disabled={missing} onPress={confirm} />
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
      {error ? <Text style={styles.error} testID={`action-error-${suggestion.rank}`}>{error}</Text> : null}
      {running && latest ? (
        <Tap testID={`action-progress-${suggestion.rank}`} onPress={() => openResult(latest._id)} style={styles.status}>
          <SpinRing size={14} color={palette.ink} />
          <Text style={styles.statusText}>Working… tap to watch</Text>
        </Tap>
      ) : null}
      {latest?.resultId ? (
        <Tap testID={`action-view-result-${suggestion.rank}`} onPress={() => openResult(latest._id)} style={styles.status}>
          <View style={styles.okDot} />
          <Text style={styles.statusText}>View result</Text>
        </Tap>
      ) : null}
      {latest?.status === "failed" && latest.error ? <Text style={styles.error}>Last run failed: {latest.error}</Text> : null}
      {!suggestion.canExecute ? (
        <View style={styles.status} testID={`action-unavailable-${suggestion.rank}`}>
          <Ionicons name="information-circle-outline" size={18} color={palette.ink} />
          <Text style={styles.statusText}>Not available for this save</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md, padding: 16, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  head: { flexDirection: "row", gap: space.md, alignItems: "center", minHeight: 44 },
  rank: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  rankText: { fontFamily: fonts.extraBold, fontSize: 14, color: colors.text, fontVariant: ["tabular-nums"] },
  title: { fontFamily: fonts.extraBold, fontSize: 16, lineHeight: 20, color: colors.text },
  desc: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: "#5B5B63" },
  overline: { fontFamily: fonts.extraBold, fontSize: 11, lineHeight: 14, letterSpacing: 0.9, textTransform: "uppercase", color: "#5B5B63" },
  play: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.ink, alignItems: "center", justifyContent: "center" },
  status: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 44, borderRadius: radius.pill, backgroundColor: palette.grey },
  statusText: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 20, color: colors.text },
  okDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#2BB673" },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(17,17,17,0.4)" },
  sheetWrap: { flex: 1, justifyContent: "flex-end" },
  sheet: { backgroundColor: palette.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12, gap: 16 },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border },
  sheetHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  sheetTitle: { fontFamily: fonts.extraBold, fontSize: 22, lineHeight: 26, color: colors.text },
  error: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: "#E5484D" },
});
