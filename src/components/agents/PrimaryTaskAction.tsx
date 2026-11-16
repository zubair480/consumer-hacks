import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Switch, TextInput, View } from "react-native";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useOwnedMutation, useOwnedQuery } from "../../identity/OwnerProvider";
import { boxFor } from "../../lib/boxes";
import type { SavedItemView } from "../../shared/contracts";
import { colors, fonts, palette } from "../../theme";
import { errorMessage } from "../media";
import { SpinRing } from "../Signature";
import { ScalePressable, Text } from "../ui";

type FillValues = { name: string; email: string; phone: string; studying: string };

/** Demo flow A4: the one big agent action on an item (Run it / Fill it / Add to calendar). Renders nothing for other boxes. */
export function PrimaryTaskAction({ item }: { item: SavedItemView }) {
  const box = boxFor(item.primaryType);
  if (box.key === "code") return <RunAction itemId={item._id as Id<"savedItems">} />;
  if (box.key === "forms") return <FillAction itemId={item._id as Id<"savedItems">} />;
  if (box.key === "events") return <CalendarAction itemId={item._id as Id<"savedItems">} />;
  return null;
}

function BigButton({ label, icon, busy, onPress }: { label: string; icon: "play" | "document-text-outline" | "calendar-outline"; busy?: boolean; onPress: () => void }) {
  return (
    <ScalePressable testID="task-primary-action" accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ busy: !!busy, disabled: !!busy }} disabled={busy} haptic scaleTo={0.97} onPress={onPress} style={styles.big}>
      <Text style={styles.bigText}>{busy ? "Working…" : label}</Text>
      <View style={styles.circle}>{busy ? <SpinRing size={18} color={palette.ink} /> : <Ionicons name={icon} size={18} color={colors.text} style={icon === "play" ? { marginLeft: 2 } : null} />}</View>
    </ScalePressable>
  );
}

function Note({ text }: { text: string | null }) {
  return text ? <Text style={styles.note}>{text}</Text> : null;
}

function RunAction({ itemId }: { itemId: Id<"savedItems"> }) {
  const latest = useOwnedQuery(api.agentRuns.latestRunRepo, { itemId });
  const start = useOwnedMutation(api.agentRuns.startRunRepo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = latest?.status === "queued" || latest?.status === "running";
  const press = async () => {
    if (running && latest) return router.push({ pathname: "/result/[id]", params: { id: latest._id } });
    setBusy(true);
    setError(null);
    try {
      const executionId = await start({ itemId });
      router.push({ pathname: "/result/[id]", params: { id: executionId } });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 8 }}>
      <BigButton label={running ? "Watch it run" : "Run it for me"} icon="play" busy={busy} onPress={press} />
      <Note text={error} />
    </View>
  );
}

function FillAction({ itemId }: { itemId: Id<"savedItems"> }) {
  const profile = useOwnedQuery(api.preferences.get, {});
  const upsert = useOwnedMutation(api.preferences.upsert);
  const start = useOwnedMutation(api.formFill.start);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<FillValues | null>(null);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const p = (profile ?? {}) as { name?: string; email?: string; phone?: string; fieldOfStudy?: string };
  const v: FillValues = values ?? { name: p.name ?? "", email: p.email ?? "", phone: p.phone ?? "", studying: p.fieldOfStudy ?? "" };
  const set = (k: keyof FillValues) => (text: string) => setValues({ ...v, [k]: text });

  const fill = async () => {
    setBusy(true);
    setError(null);
    try {
      if (remember) {
        const save = upsert as unknown as (args: Record<string, string>) => Promise<unknown>;
        await save({ name: v.name, fieldOfStudy: v.studying, email: v.email, phone: v.phone }).catch(() => upsert({ name: v.name, fieldOfStudy: v.studying }));
      }
      const runId = await start({ itemId });
      setOpen(false);
      router.push({ pathname: "/fill/[runId]", params: { runId } });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const fields: { key: keyof FillValues; label: string; keyboard?: "email-address" | "phone-pad" }[] = [
    { key: "name", label: "Full name" },
    { key: "email", label: "Email", keyboard: "email-address" },
    { key: "phone", label: "Phone number", keyboard: "phone-pad" },
    { key: "studying", label: "What are you studying?" },
  ];

  return (
    <>
      <BigButton label="Fill it for me" icon="document-text-outline" onPress={() => setOpen(true)} />
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <Pressable style={styles.scrim} onPress={() => setOpen(false)} />
        <View style={styles.sheet} testID="fill-sheet">
          <Text style={styles.sheetTitle}>Zapy will use these</Text>
          {fields.map((f) => (
            <View key={f.key} style={{ gap: 4 }}>
              <Text style={styles.label}>{f.label}</Text>
              <TextInput testID={`fill-sheet-${f.key}`} value={v[f.key]} onChangeText={set(f.key)} keyboardType={f.keyboard ?? "default"} autoCapitalize={f.keyboard ? "none" : "words"} placeholderTextColor="#9A9AA3" selectionColor={colors.primary} style={styles.input} />
            </View>
          ))}
          <View style={styles.switchRow}>
            <Text style={styles.label}>Remember these</Text>
            <Switch testID="fill-sheet-remember" value={remember} onValueChange={setRemember} trackColor={{ true: palette.ink, false: palette.grey }} thumbColor="#FFFFFF" />
          </View>
          <Note text={error} />
          <ScalePressable testID="fill-sheet-submit" accessibilityRole="button" accessibilityLabel="Fill the form" disabled={busy} haptic scaleTo={0.97} onPress={fill} style={styles.big}>
            <Text style={styles.bigText}>{busy ? "Working…" : "Fill the form"}</Text>
            {busy ? (
              <View style={styles.circle}>
                <SpinRing size={18} color={palette.ink} />
              </View>
            ) : null}
          </ScalePressable>
        </View>
      </Modal>
    </>
  );
}

function CalendarAction({ itemId }: { itemId: Id<"savedItems"> }) {
  const job = useOwnedQuery(api.agents.calendar.latestForItem, { itemId });
  const prepare = useOwnedMutation(api.agents.calendar.prepare);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = job && job.status !== "cancelled" ? job : null;
  if (active?.status === "completed") return <Text style={styles.doneText}>Added to Google Calendar ✓</Text>;
  if (active) return null;
  const press = async () => {
    setBusy(true);
    setError(null);
    try {
      await prepare({ itemId, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 8 }}>
      <BigButton label="Add to my calendar" icon="calendar-outline" busy={busy} onPress={press} />
      <Note text={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  big: { height: 56, borderRadius: 999, backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  bigText: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20, color: colors.onPrimary },
  circle: { position: "absolute", right: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  note: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.danger },
  doneText: { fontFamily: fonts.extraBold, fontSize: 16, lineHeight: 22, color: colors.text },
  scrim: { flex: 1, backgroundColor: "rgba(17,17,17,0.4)" },
  sheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 40, gap: 12 },
  sheetTitle: { fontFamily: fonts.extraBold, fontSize: 22, lineHeight: 26, color: colors.text },
  label: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 18, color: colors.text },
  input: { height: 48, borderRadius: 16, borderWidth: 1, borderColor: palette.hairline, paddingHorizontal: 16, fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 },
});
