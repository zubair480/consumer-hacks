import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Boundary } from "../../components/Boundary";
import { GradientButton } from "../../components/GradientButton";
import { itemTitle } from "../../components/ItemCard";
import { errorMessage } from "../../components/media";
import { Tap } from "../../components/Pressable";
import { ScreenHeader } from "../../components/ScreenHeader";
import { Section } from "../../components/Section";
import { Skeleton } from "../../components/States";
import { STUDIO_PLATFORMS, platformMeta, type StudioPlatform } from "../../components/studio/platforms";
import { colors, radius, space, type } from "../../components/tokens";
import { useOwnedMutation, useOwnedQuery } from "../../identity/OwnerProvider";

export default function PlatformSelector() {
  const { itemId, mediaId } = useLocalSearchParams<{ itemId?: string; mediaId?: string }>();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.pad}><ScreenHeader title="Where to post" back /></View>
      <Boundary title="Couldn’t load platforms">
        <Selector itemId={itemId as Id<"savedItems"> | undefined} mediaId={mediaId as Id<"mediaAssets"> | undefined} />
      </Boundary>
    </SafeAreaView>
  );
}

function Selector({ itemId, mediaId }: { itemId?: Id<"savedItems">; mediaId?: Id<"mediaAssets"> }) {
  const source = itemId ? { itemId } : { mediaId };
  const item = useOwnedQuery(api.items.get, itemId ? { itemId } : "skip");
  const recs = useOwnedQuery(api.social.drafts.recommendPlatforms, source);
  const generate = useOwnedMutation(api.social.drafts.generate);
  const [picked, setSelected] = useState<StudioPlatform[] | null>(null);
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (recs === undefined) return <View style={styles.pad}><Skeleton rows={5} height={64} /></View>;
  const recommended = recs.filter((r) => r.recommended).map((r) => r.platform);
  const selected: StudioPlatform[] = picked ?? (recommended.length ? recommended : ["linkedin", "x"]);
  const reasons = new Map(recs.map((r) => [r.platform, r]));
  const toggle = (p: StudioPlatform) => setSelected(selected.includes(p) ? selected.filter((x) => x !== p) : [...selected, p]);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const platforms = STUDIO_PLATFORMS.filter((p) => selected.includes(p));
      await generate({ ...source, platforms, context: context.trim() || undefined });
      router.replace({ pathname: "/studio/editor", params: itemId ? { itemId, platform: platforms[0] } : { mediaId: mediaId!, platform: platforms[0] } });
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" testID="studio-platforms-screen">
      {item ? <Text style={type.caption} numberOfLines={2}>From: <Text style={{ color: colors.text, fontWeight: "700" }}>{itemTitle(item)}</Text></Text> : null}
      <Section title="Platforms">
        {STUDIO_PLATFORMS.map((p) => {
          const m = platformMeta(p);
          const on = selected.includes(p);
          const rec = reasons.get(p);
          return (
            <Tap key={p} testID={`studio-platform-${p}`} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={m.label} onPress={() => toggle(p)} style={[styles.row, on && { borderColor: colors.accent, backgroundColor: colors.accent + "14" }]}>
              <View style={[styles.icon, { backgroundColor: m.color + "22" }]}><Ionicons name={m.icon} size={20} color={m.color} /></View>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.titleRow}>
                  <Text style={type.heading}>{m.label}</Text>
                  {rec?.recommended ? <Text style={styles.badge} testID={`studio-recommended-${p}`}>Recommended</Text> : null}
                </View>
                <Text style={type.caption} numberOfLines={2}>{rec?.reason || m.blurb}</Text>
              </View>
              <Ionicons name={on ? "checkmark-circle" : "ellipse-outline"} size={24} color={on ? colors.accent : colors.textFaint} />
            </Tap>
          );
        })}
      </Section>
      <Section title="Anything to add? (optional)">
        <TextInput
          testID="studio-context-input"
          value={context}
          onChangeText={setContext}
          placeholder="e.g. Trying this out for our team’s demo next week"
          placeholderTextColor={colors.textFaint}
          multiline
          style={styles.input}
        />
        <Text style={type.caption}>Drafts only use facts from your save plus what you write here.</Text>
      </Section>
      {error ? <Text style={styles.error} testID="studio-generate-error">{error}</Text> : null}
      <GradientButton testID="studio-generate" label={`Write ${selected.length} draft${selected.length === 1 ? "" : "s"}`} icon="sparkles" loading={busy} disabled={selected.length === 0} onPress={start} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  pad: { paddingHorizontal: space.lg },
  content: { padding: space.lg, gap: space.xl, paddingBottom: 80 },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  badge: { fontSize: 11, fontWeight: "800", color: colors.success, backgroundColor: colors.success + "1F", paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, overflow: "hidden" },
  input: { minHeight: 80, color: colors.text, fontSize: 15, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, textAlignVertical: "top" },
  error: { color: colors.danger, fontWeight: "600" },
});
