import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Image, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { EmptyState } from "../../../components/EmptyState";
import { Field } from "../../../components/Field";
import { GradientButton } from "../../../components/GradientButton";
import { itemTitle } from "../../../components/ItemCard";
import { errorMessage, pickImage, uploadImage } from "../../../components/media";
import { Tap } from "../../../components/Pressable";
import { ScreenHeader } from "../../../components/ScreenHeader";
import { Section } from "../../../components/Section";
import { StatusPill } from "../../../components/StatusPill";
import { colors, radius, space, type } from "../../../components/tokens";
import { TypeChip } from "../../../components/TypeChip";
import { metaFor, timeAgo } from "../../../components/typeMeta";
import { useOwnedMutation, useOwnedQuery } from "../../../identity/OwnerProvider";
import { IN_PROGRESS_EXTRACTION_STATUSES } from "../../../shared/contracts";

export default function ItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = id as Id<"savedItems">;
  const item = useOwnedQuery(api.items.get, { itemId });
  const retry = useOwnedMutation(api.items.retry);
  const update = useOwnedMutation(api.items.update);
  const remove = useOwnedMutation(api.items.remove);
  const getUploadUrl = useOwnedMutation(api.items.generateUploadUrl);
  const [fallbackText, setFallbackText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const addText = () => run(async () => {
    await update({ itemId, rawText: fallbackText });
    await retry({ itemId });
    setFallbackText("");
  });

  const addScreenshot = () => run(async () => {
    const picked = await pickImage("library");
    if (!picked) return;
    const storageId = (await uploadImage(picked, () => getUploadUrl({}))) as Id<"_storage">;
    await retry({ itemId, imageStorageId: storageId });
  });

  const confirmDelete = () =>
    Alert.alert("Delete this save?", "Its analysis and results will be deleted too.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await remove({ itemId }); router.back(); } },
    ]);

  if (item === undefined) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }

  const m = metaFor(item.primaryType);
  const inProgress = IN_PROGRESS_EXTRACTION_STATUSES.includes(item.extractionStatus);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <ScreenHeader
          title=""
          back
          right={
            <Tap testID="delete-item-button" accessibilityLabel="Delete" onPress={confirmDelete} style={styles.iconBtn}>
              <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
            </Tap>
          }
        />
      </View>
      <ScrollView contentContainerStyle={styles.content} testID="item-detail-screen">
        {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" /> : null}
        <View style={styles.gap}>
          <View style={styles.chips}>
            {item.extractionStatus === "ready" ? item.contentTypes.map((t) => <TypeChip key={t} type={t} />) : <StatusPill status={item.extractionStatus} />}
          </View>
          <Text style={type.display} testID="item-title">{itemTitle(item)}</Text>
          <Text style={type.caption}>Saved {timeAgo(item.createdAt)}{item.sourcePlatform !== "manual" ? ` · ${item.sourcePlatform}` : ""}</Text>
        </View>

        {item.summary ? <Text style={[type.body, styles.summary, { borderLeftColor: m.color }]}>{item.summary}</Text> : null}

        {inProgress ? (
          <View style={styles.progress} testID="item-processing">
            <ActivityIndicator color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={type.heading}>{item.extractionStatus === "analyzing" ? "Understanding what this is…" : item.extractionStatus === "extracting" ? "Reading the source…" : "Queued for analysis…"}</Text>
              <Text style={type.caption}>Actions appear here once it’s understood. You can leave this screen.</Text>
            </View>
          </View>
        ) : null}

        {item.extractionStatus === "needs_input" ? (
          <View style={styles.attention} testID="needs-input-panel">
            <View style={styles.row}><Ionicons name="lock-closed" size={18} color={colors.warning} /><Text style={[type.heading, { color: colors.warning, flex: 1 }]}>We couldn’t read this link</Text></View>
            <Text style={type.caption}>{item.extractionError ?? "The page is private or blocked."} We kept the link. Add a screenshot or paste the text and we’ll continue with that.</Text>
            <GradientButton testID="fallback-screenshot-button" label="Add a screenshot" icon="image" onPress={addScreenshot} loading={busy} />
            <Field testID="fallback-text-input" placeholder="Or paste the text here" value={fallbackText} onChangeText={setFallbackText} multiline />
            <GradientButton testID="fallback-submit-button" label="Continue with this text" variant="secondary" disabled={!fallbackText.trim() || busy} onPress={addText} />
          </View>
        ) : null}

        {item.extractionStatus === "failed" ? (
          <View style={[styles.attention, { borderColor: colors.danger + "55", backgroundColor: colors.danger + "10" }]} testID="failed-panel">
            <View style={styles.row}><Ionicons name="alert-circle" size={18} color={colors.danger} /><Text style={[type.heading, { color: colors.danger }]}>Analysis failed</Text></View>
            {item.extractionError ? <Text style={type.caption}>{item.extractionError}</Text> : null}
            <GradientButton testID="retry-button" label="Retry analysis" icon="refresh" onPress={() => run(() => retry({ itemId }))} loading={busy} />
          </View>
        ) : null}

        {error ? <Text style={styles.error} testID="item-error">{error}</Text> : null}

        {item.extractionStatus === "ready" ? (
          <GradientButton testID="open-actions-button" label="What can I do with this?" icon="sparkles" onPress={() => router.push({ pathname: "/item/[id]/actions", params: { id: item._id } })} />
        ) : null}

        <Section title="Source">
          {item.sourceUrl ? (
            <Tap testID="open-source-button" onPress={() => Linking.openURL(item.sourceUrl!)} style={styles.source}>
              <Ionicons name="link" size={16} color={colors.accent} />
              <Text style={styles.sourceText} numberOfLines={1}>{item.sourceUrl}</Text>
              <Ionicons name="open-outline" size={16} color={colors.textFaint} />
            </Tap>
          ) : null}
          {item.rawText ? <Text style={[type.body, styles.raw]} numberOfLines={12}>{item.rawText}</Text> : null}
          {!item.sourceUrl && !item.rawText && !item.imageUrl ? <EmptyState icon="document-outline" title="No source content" /> : null}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center" },
  top: { paddingHorizontal: space.xl },
  content: { padding: space.xl, gap: space.xl, paddingBottom: 60 },
  gap: { gap: space.sm },
  chips: { flexDirection: "row", gap: space.sm, flexWrap: "wrap" },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surfaceRaised, alignItems: "center", justifyContent: "center" },
  image: { width: "100%", aspectRatio: 4 / 3, borderRadius: radius.lg, backgroundColor: colors.surface },
  summary: { borderLeftWidth: 3, paddingLeft: space.md, color: colors.textMuted },
  progress: { flexDirection: "row", gap: space.md, alignItems: "center", padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  attention: { gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.warning + "55", backgroundColor: colors.warning + "10" },
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
  error: { color: colors.danger, fontWeight: "600" },
  source: { flexDirection: "row", alignItems: "center", gap: 8, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface },
  sourceText: { flex: 1, color: colors.text },
  raw: { color: colors.textMuted, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface },
});
