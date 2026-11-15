import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Boundary } from "../../components/Boundary";
import { Button, DisplayTitle, InkPill } from "../../components/ui";
import { elevation, studioText } from "../../components/studio/studioStyles";
import { palette } from "../../theme";
import { itemTitle } from "../../components/ItemCard";
import { errorMessage } from "../../components/media";
import { Tap } from "../../components/Pressable";
import { ScreenHeader } from "../../components/ScreenHeader";
import { Section } from "../../components/Section";
import { Skeleton } from "../../components/States";
import { STUDIO_PLATFORMS, platformMeta, type StudioPlatform } from "../../components/studio/platforms";
import { colors, radius, space } from "../../components/tokens";
import { useOwnedMutation, useOwnedQuery } from "../../identity/OwnerProvider";

export default function PlatformSelector() {
  const { itemId, mediaId } = useLocalSearchParams<{ itemId?: string; mediaId?: string }>();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.pad}><ScreenHeader title="" back /></View>
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
  const [focused, setFocused] = useState(false);
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
      <View style={styles.header}>
        <InkPill label="Create" />
        <DisplayTitle highlight="post" highlightColor={palette.lavender} size={34}>{"Where to post"}</DisplayTitle>
        {item ? <Text style={studioText.footnote} numberOfLines={2}>From: <Text style={studioText.callout}>{itemTitle(item)}</Text></Text> : null}
      </View>
      <Section title="Platforms">
        {STUDIO_PLATFORMS.map((p) => {
          const m = platformMeta(p);
          const on = selected.includes(p);
          const rec = reasons.get(p);
          return (
            <Tap key={p} testID={`studio-platform-${p}`} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={m.label} onPress={() => toggle(p)} style={[styles.row, on && styles.rowOn]}>
              <View style={[styles.icon, { backgroundColor: m.color }]}><Ionicons name={m.icon} size={22} color={m.fg} /></View>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.titleRow}>
                  <Text style={studioText.headline}>{m.label}</Text>
                  {rec?.recommended ? <Text style={styles.badge} testID={`studio-recommended-${p}`}>Recommended</Text> : null}
                </View>
                <Text style={studioText.footnote} numberOfLines={2}>{rec?.reason || m.blurb}</Text>
              </View>
              <View style={[styles.check, on && { backgroundColor: m.color }]}>{on ? <Ionicons name="checkmark" size={16} color={m.fg} /> : null}</View>
            </Tap>
          );
        })}
      </Section>
      <Section title="Anything to add? Optional">
        <TextInput
          testID="studio-context-input"
          value={context}
          onChangeText={setContext}
          placeholder="For example, trying this for our team demo next week"
          placeholderTextColor={colors.textFaint}
          multiline
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, focused && styles.inputFocused]}
        />
        <Text style={studioText.footnote}>Drafts only use facts from your save plus what you write here.</Text>
      </Section>
      {error ? <Text style={styles.error} testID="studio-generate-error">{error}</Text> : null}
      <Button testID="studio-generate" title={`Write ${selected.length} draft${selected.length === 1 ? "" : "s"}`} icon="arrow-forward" loading={busy} disabled={selected.length === 0} onPress={start}  fullWidth />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  pad: { paddingHorizontal: space.lg },
  content: { paddingHorizontal: space.xl, gap: 28, paddingBottom: 120 },
  header: { gap: space.md },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 72, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  rowOn: { borderWidth: 2, borderColor: colors.text, ...elevation.e2 },
  icon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.text, alignItems: "center", justifyContent: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  badge: { ...studioText.overline, backgroundColor: palette.mint, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, overflow: "hidden" },
  input: { ...studioText.body, minHeight: 88, padding: space.lg, borderRadius: radius.lg, backgroundColor: palette.grey, borderWidth: 1.5, borderColor: palette.grey, textAlignVertical: "top" },
  inputFocused: { backgroundColor: palette.white, borderColor: palette.ink, ...elevation.e1 },
  error: studioText.error,
});
