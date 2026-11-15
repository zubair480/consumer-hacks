import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../../convex/_generated/api";
import { Field } from "../../components/Field";
import { GradientButton } from "../../components/GradientButton";
import { Section } from "../../components/Section";
import { ScreenHeader } from "../../components/ScreenHeader";
import { colors, radius, space, type } from "../../components/tokens";
import { metaFor } from "../../components/typeMeta";
import { useOwnedMutation, useOwnedQuery, useOwnerId } from "../../identity/OwnerProvider";
import type { ContentType } from "../../shared/contracts";

export default function Profile() {
  const ownerId = useOwnerId();
  const me = useOwnedQuery(api.users.me, {});
  const items = useOwnedQuery(api.items.list, { limit: 200 });
  const setDisplayName = useOwnedMutation(api.users.setDisplayName);
  const [draft, setName] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const name = draft ?? me?.displayName ?? "";

  const counts = new Map<ContentType, number>();
  for (const i of items ?? []) if (i.primaryType) counts.set(i.primaryType, (counts.get(i.primaryType) ?? 0) + 1);
  const ready = items?.filter((i) => i.extractionStatus === "ready").length ?? 0;
  const initial = (me?.displayName ?? "A").charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} testID="profile-screen">
        <ScreenHeader title="Profile" />
        <View style={styles.card}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initial}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={type.title}>{me?.displayName ?? "You"}</Text>
            <Text style={type.caption}>Member since {me ? new Date(me.createdAt).toLocaleDateString() : "…"}</Text>
          </View>
        </View>

        <View style={styles.stats}>
          <Stat label="Saved" value={items?.length ?? 0} />
          <Stat label="Understood" value={ready} />
          <Stat label="Types" value={counts.size} />
        </View>

        <Section title="Display name">
          <Field testID="display-name-input" placeholder="What should we call you?" value={name} onChangeText={(v) => { setName(v); setSaved(false); }} />
          <GradientButton testID="save-profile-button" label={saved ? "Saved" : "Save name"} icon={saved ? "checkmark" : undefined} variant="secondary" disabled={!name.trim()} onPress={async () => { await setDisplayName({ displayName: name }); setSaved(true); }} />
        </Section>

        {counts.size > 0 ? (
          <Section title="What you save">
            <View style={styles.types}>
              {[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => {
                const m = metaFor(t);
                return (
                  <View key={t} style={[styles.typeChip, { backgroundColor: m.color + "1F" }]}>
                    <Ionicons name={m.icon} size={14} color={m.color} />
                    <Text style={[styles.typeText, { color: m.color }]}>{m.label} · {n}</Text>
                  </View>
                );
              })}
            </View>
          </Section>
        ) : null}

        <Section title="This device">
          <View style={styles.device}>
            <Ionicons name="phone-portrait-outline" size={18} color={colors.textMuted} />
            <Text style={[type.caption, { flex: 1 }]} numberOfLines={1}>No account needed. Your saves are tied to this device ({ownerId.slice(0, 8)}).</Text>
          </View>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={type.caption}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.xl, gap: space.xl, paddingBottom: 60 },
  card: { flexDirection: "row", alignItems: "center", gap: space.lg, padding: space.xl, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 26, fontWeight: "800" },
  stats: { flexDirection: "row", gap: space.md },
  stat: { flex: 1, alignItems: "center", paddingVertical: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  statValue: { color: colors.text, fontSize: 26, fontWeight: "800" },
  types: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  typeChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill },
  typeText: { fontWeight: "700", fontSize: 13 },
  device: { flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.lg, borderRadius: radius.md, backgroundColor: colors.surface },
});
