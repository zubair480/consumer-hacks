import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../../convex/_generated/api";
import { Boundary } from "../../components/Boundary";
import { ConnectedAccounts } from "../../components/publishing/ConnectedAccounts";
import { Field } from "../../components/Field";
import { GradientButton } from "../../components/GradientButton";
import { errorMessage } from "../../components/media";
import { ScreenHeader } from "../../components/ScreenHeader";
import { Section } from "../../components/Section";
import { Skeleton } from "../../components/States";
import { colors, radius, space, type } from "../../components/tokens";
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
  { key: "interests", label: "Interests", placeholder: "Comma separated: design, AI, food" },
];

function toText(p: UserProfile, key: Key): string {
  const v = p[key];
  return v === undefined || v === null ? "" : Array.isArray(v) ? v.join(", ") : String(v);
}

export default function Profile() {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} testID="profile-screen" keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <ScreenHeader title="Profile" />
        <Boundary title="Couldn’t load your profile">
          <Body />
        </Boundary>
        <Boundary title="Couldn’t load connected accounts">
          <ConnectedAccounts />
        </Boundary>
        <About />
      </ScrollView>
    </SafeAreaView>
  );
}

function Body() {
  const profile = useOwnedQuery(api.preferences.get, {});
  const stats = useOwnedQuery(api.preferences.stats, {});
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
        interests: value("interests").split(",").map((s) => s.trim()).filter(Boolean),
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
      <View style={styles.card}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{(displayName || "You").charAt(0).toUpperCase()}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={type.title}>{displayName || "You"}</Text>
          <Text style={type.caption}>{[value("educationLevel"), value("city")].filter(Boolean).join(" · ") || "Add details so actions fit you"}</Text>
        </View>
      </View>

      <View style={styles.stats}>
        <Stat testID="stat-saves" label="Saves" value={stats ? `${stats.saves}${stats.capped ? "+" : ""}` : "–"} />
        <Stat testID="stat-outcomes" label="Outcomes" value={stats ? `${stats.outcomes}${stats.capped ? "+" : ""}` : "–"} />
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
          ["sparkles", "Zapy reads what you save and suggests three actions. Results come from the source you saved; when a fact isn’t in the source (a deadline, a price, an address) we say so instead of guessing."],
          ["lock-closed", "Some links are private or block readers (Instagram, logged-in pages). When that happens, add a screenshot or paste the text."],
          ["share-outline", "Nothing is posted or sent for you. Drafts are copied or shared through your phone’s share sheet."],
          ["phone-portrait-outline", `No account needed: your saves belong to this device (${ownerId.slice(0, 8)}). Deleting the app removes access to them.`],
        ].map(([icon, text]) => (
          <View key={icon} style={styles.aboutRow}>
            <Ionicons name={icon as "sparkles"} size={16} color={colors.textMuted} style={{ marginTop: 2 }} />
            <Text style={[type.caption, { flex: 1, lineHeight: 18 }]}>{text}</Text>
          </View>
        ))}
      </View>
    </Section>
  );
}

function Stat({ testID, label, value }: { testID: string; label: string; value: string }) {
  return (
    <View style={styles.stat} testID={testID}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={type.caption}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.xl, gap: space.xl, paddingBottom: 80 },
  card: { flexDirection: "row", alignItems: "center", gap: space.lg, padding: space.xl, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 26, fontWeight: "800" },
  stats: { flexDirection: "row", gap: space.md },
  stat: { flex: 1, alignItems: "center", paddingVertical: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  statValue: { color: colors.text, fontSize: 26, fontWeight: "800" },
  fieldLabel: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  error: { color: colors.danger, fontWeight: "600" },
  about: { gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  aboutRow: { flexDirection: "row", gap: space.md },
});
