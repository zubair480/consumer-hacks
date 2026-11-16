import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { useReducedMotion } from "react-native-reanimated";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../../convex/_generated/api";
import { Boundary } from "../../components/Boundary";
import { CalendarConnectRow } from "../../components/agents/CalendarAgent";
import { ConnectedAccounts } from "../../components/publishing/ConnectedAccounts";
import { Field } from "../../components/Field";
import { GradientButton } from "../../components/GradientButton";
import { errorMessage } from "../../components/media";
import { Section } from "../../components/Section";
import { ShareToZapyCard } from "../../components/share/ShareToZapyCard";
import { Skeleton } from "../../components/States";
import { colors, radius, space, type } from "../../components/tokens";
import { HoloBand, InkPill, ScalePressable, Text as ZText } from "../../components/ui";
import { TAB_BAR_SPACE, useTabBarScroll } from "../../components/ui/InkTabBar";
import { MarkerTitle } from "../../components/ui/MarkerTitle";
import { INTERESTS } from "../../lib/useProfile";
import { fonts, palette } from "../../theme";
import { useOwnedMutation, useOwnedQuery, useOwnerId } from "../../identity/OwnerProvider";
import type { UserProfile } from "../../shared/contracts";

type Key = "name" | "educationLevel" | "fieldOfStudy" | "country" | "citizenship" | "gpa" | "city" | "interests";

const FIELDS: { key: Key; label: string; placeholder: string; numeric?: boolean }[] = [
  { key: "name", label: "Name", placeholder: "What should we call you?" },
  { key: "educationLevel", label: "Education level", placeholder: "e.g. High school senior, Undergraduate" },
  { key: "fieldOfStudy", label: "Field of study", placeholder: "e.g. Computer Science" },
  { key: "country", label: "Country", placeholder: "e.g. United States" },
  { key: "citizenship", label: "Citizenship", placeholder: "e.g. U.S. citizen" },
  { key: "gpa", label: "GPA (optional)", placeholder: "e.g. 3.6", numeric: true },
  { key: "city", label: "City", placeholder: "e.g. San Francisco" },
];

function toText(p: UserProfile, key: Key): string {
  const v = p[key];
  return v === undefined || v === null ? "" : Array.isArray(v) ? v.join(", ") : String(v);
}

export default function Profile() {
  const scroll = useTabBarScroll();
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <HoloBand height={140} />
      <ScrollView {...scroll} contentContainerStyle={styles.content} testID="profile-screen" keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <InkPill label="Profile" />
          <ScalePressable testID="profile-replay-welcome" accessibilityRole="button" accessibilityLabel="Replay welcome" scaleTo={0.97} onPress={() => router.push("/welcome")} style={{ height: 44, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.text, justifyContent: "center" }}>
            <ZText style={{ fontFamily: fonts.bold, fontSize: 13, lineHeight: 18, color: colors.text }}>Replay welcome</ZText>
          </ScalePressable>
        </View>
        <ScalePressable testID="profile-x-bookmarks" accessibilityRole="button" accessibilityLabel="X bookmarks" scaleTo={0.97} onPress={() => router.push("/import")} style={{ minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
          <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: colors.text, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="logo-x" size={18} color="#FFFFFF" />
          </View>
          <ZText style={{ flex: 1, fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.text }}>X bookmarks</ZText>
          <Ionicons name="chevron-forward" size={16} color="#9A9AA3" />
        </ScalePressable>
        <Boundary title="Couldn’t load your profile">
          <Body />
        </Boundary>
        <Boundary title="Couldn’t load connected accounts">
          <ConnectedAccounts />
        </Boundary>
        <Boundary fallback={null}><CalendarConnectRow /></Boundary>
        <Boundary title="Couldn’t load Share to Zapy"><ShareToZapyCard /></Boundary>
        <About />
      </ScrollView>
    </SafeAreaView>
  );
}

function Body() {
  const profile = useOwnedQuery(api.preferences.get, {});
  const stats = useOwnedQuery(api.preferences.stats, {});
  const outcomes = useOwnedQuery(api.actions.recentOutcomes, { limit: 50 });
  const upsert = useOwnedMutation(api.preferences.upsert);
  const [draft, setDraft] = useState<Partial<Record<Key, string>>>({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  if (profile === undefined) return <Skeleton rows={3} />;
  const value = (k: Key) => draft[k] ?? toText(profile, k);
  const dirty = Object.keys(draft).length > 0;
  const displayName = value("name").trim();

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const gpaText = value("gpa").trim();
      const gpa = gpaText ? Number(gpaText) : null;
      if (gpaText && Number.isNaN(gpa)) throw new Error("GPA must be a number.");
      await upsert({
        name: value("name"),
        educationLevel: value("educationLevel"),
        fieldOfStudy: value("fieldOfStudy"),
        country: value("country"),
        citizenship: value("citizenship"),
        city: value("city"),
        gpa,
      });
      setDraft({});
      setStatus("Saved");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      setStatus(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <View style={{ gap: 8 }}>
        <MarkerTitle lines={[displayName.split(/\s+/)[0] || "You"]} marker={displayName.split(/\s+/)[0] || "You"} color={palette.peach} size={40} testID="profile-name" />
        <ZText style={{ fontFamily: fonts.medium, fontSize: 15, lineHeight: 22, color: "#5B5B63" }}>{[value("educationLevel"), value("city")].filter(Boolean).join(" · ") || "Add details so actions fit you"}</ZText>
      </View>

      <Interests current={profile.interests ?? []} onChange={(interests) => upsert({ interests }).catch((e) => setStatus(errorMessage(e)))} />

      <View style={styles.stats}>
        <Stat testID="stat-saves" color={palette.lavender} label="Saved" value={stats?.saves} capped={stats?.capped} />
        <Stat testID="stat-acted" color={palette.butter} label="Acted on" value={outcomes ? new Set(outcomes.map((o) => o.itemId as string)).size : undefined} />
        <Stat testID="stat-outcomes" color={palette.mint} label="Results" value={stats?.outcomes} capped={stats?.capped} />
      </View>

      <Section title="About you">
        <Text style={type.caption}>Used to check scholarship eligibility and plan visits. Stays in your Zapy account; nothing is shared.</Text>
        {FIELDS.map((f) => (
          <View key={f.key} style={{ gap: 6 }}>
            <Text style={styles.fieldLabel}>{f.label}</Text>
            <Field
              testID={`profile-${f.key}-input`}
              placeholder={f.placeholder}
              value={value(f.key)}
              keyboardType={f.numeric ? "decimal-pad" : "default"}
              autoCapitalize={f.key === "interests" ? "none" : "words"}
              onChangeText={(v) => { setDraft((d) => ({ ...d, [f.key]: v })); setStatus(null); }}
            />
          </View>
        ))}
        <GradientButton testID="save-profile-button" label={status === "Saved" && !dirty ? "Saved" : "Save profile"} icon={status === "Saved" && !dirty ? "checkmark" : "save-outline"} loading={saving} disabled={!dirty} onPress={save} />
        {status && status !== "Saved" ? <Text style={styles.error} testID="profile-error">{status}</Text> : null}
      </Section>
    </>
  );
}

function About() {
  const ownerId = useOwnerId();
  return (
    <Section title="About & limitations">
      <View style={styles.about} testID="about-section">
        {[
          ["bulb-outline", "Zapy reads what you save and suggests three actions. Results come from the source you saved; when a fact isn’t in the source (a deadline, a price, an address) we say so instead of guessing."],
          ["lock-closed", "Some links are private or block readers (Instagram, logged-in pages). When that happens, add a screenshot or paste the text."],
          ["share-outline", "Nothing is posted or sent for you. Drafts are copied or shared through your phone’s share sheet."],
          ["phone-portrait-outline", `No account needed: your saves belong to this device (${ownerId.slice(0, 8)}). Deleting the app removes access to them.`],
        ].map(([icon, text]) => (
          <View key={icon} style={styles.aboutRow}>
            <Ionicons name={icon as "bulb-outline"} size={16} color={colors.textMuted} style={{ marginTop: 2 }} />
            <Text style={[type.caption, { flex: 1, lineHeight: 18 }]}>{text}</Text>
          </View>
        ))}
      </View>
    </Section>
  );
}

function Interests({ current, onChange }: { current: string[]; onChange: (interests: string[]) => void }) {
  const [picked, setPicked] = useState(current.map((c) => c.toLowerCase()));
  const toggle = (key: string) => {
    Haptics.selectionAsync().catch(() => {});
    const next = picked.includes(key) ? picked.filter((k) => k !== key) : [...picked, key];
    setPicked(next);
    onChange(next);
  };
  return (
    <View style={{ gap: 12 }}>
      <ZText style={{ fontFamily: fonts.extraBold, fontSize: 18, lineHeight: 24, color: colors.text }}>What you save most</ZText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {INTERESTS.map((i) => {
          const on = picked.includes(i.key);
          return (
            <ScalePressable key={i.key} testID={`profile-interest-${i.key}`} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={i.label} scaleTo={0.95} onPress={() => toggle(i.key)} style={{ height: 44, paddingHorizontal: 16, borderRadius: 999, justifyContent: "center", backgroundColor: on ? colors.text : i.color }}>
              <ZText style={{ fontFamily: fonts.bold, fontSize: 14, lineHeight: 20, color: on ? "#FFFFFF" : colors.text }}>{i.label}</ZText>
            </ScalePressable>
          );
        })}
      </View>
    </View>
  );
}

function CountUp({ to }: { to: number }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (to <= 0 || reduce) return;
    const start = Date.now();
    const id = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / 600);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p === 1) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
  }, [to, reduce]);
  return <>{to <= 0 || reduce ? to : n}</>;
}

function Stat({ testID, label, value, color, capped }: { testID: string; label: string; value?: number; color: string; capped?: boolean }) {
  return (
    <View style={[styles.stat, { backgroundColor: color }]} testID={testID}>
      <ZText style={styles.statValue}>{value === undefined ? "–" : <CountUp to={value} />}{capped ? "+" : ""}</ZText>
      <ZText style={styles.statLabel}>{label.toUpperCase()}</ZText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.xl, paddingTop: space.md, gap: 28, paddingBottom: TAB_BAR_SPACE },
  card: { flexDirection: "row", alignItems: "center", gap: space.lg, padding: space.xl, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.text, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 26, fontWeight: "800" },
  stats: { flexDirection: "row", gap: space.md },
  stat: { flex: 1, alignItems: "flex-start", padding: 14, borderRadius: 18, gap: 2 },
  statValue: { color: colors.text, fontSize: 30, lineHeight: 34, fontFamily: fonts.display, fontVariant: ["tabular-nums"] },
  statLabel: { color: colors.text, fontSize: 11, lineHeight: 14, fontFamily: fonts.extraBold, letterSpacing: 0.9 },
  fieldLabel: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.bold },
  error: { color: colors.danger, fontFamily: fonts.bold },
  about: { gap: space.md, padding: space.xl, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  aboutRow: { flexDirection: "row", gap: space.md },
});
