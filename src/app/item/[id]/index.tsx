import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ActionCard } from "../../../components/ActionCard";
import { Boundary } from "../../../components/Boundary";
import { FactRow } from "../../../components/FactRow";
import { Field } from "../../../components/Field";
import { itemTitle } from "../../../components/ItemCard";
import { EmptyState } from "../../../components/EmptyState";
import { errorMessage, pickImages, uploadImage } from "../../../components/media";
import { Tap } from "../../../components/Pressable";
import { ScreenHeader } from "../../../components/ScreenHeader";
import { Section } from "../../../components/Section";
import { Skeleton } from "../../../components/States";
import { StatusPill } from "../../../components/StatusPill";
import { colors, radius, space, type } from "../../../components/tokens";
import { colors as theme } from "../../../theme";
import { Button, ItemRow, pastelFor, typeIconFor } from "../../../components/ui";
import { metaFor, timeAgo } from "../../../components/typeMeta";
import { useOwnedMutation, useOwnedQuery } from "../../../identity/OwnerProvider";
import { IN_PROGRESS_EXTRACTION_STATUSES, type SavedItemView } from "../../../shared/contracts";

export default function ItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <Boundary title="Couldn’t load this save">
        <Detail itemId={id as Id<"savedItems">} />
      </Boundary>
    </SafeAreaView>
  );
}

function Detail({ itemId }: { itemId: Id<"savedItems"> }) {
  const insets = useSafeAreaInsets();
  const item = useOwnedQuery(api.items.get, { itemId });
  const remove = useOwnedMutation(api.items.remove);

  const confirmDelete = () =>
    Alert.alert("Delete this save?", "Its analysis and results will be deleted too.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await remove({ itemId });
            router.back();
          } catch (e) {
            Alert.alert("Couldn’t delete this save", errorMessage(e));
          }
        },
      },
    ]);

  const header = (
    <View style={[styles.top, { paddingTop: insets.top }]}>
      <ScreenHeader
        title=""
        back
        right={item ? (
          <Tap testID="delete-item-button" accessibilityLabel="Delete save" onPress={confirmDelete} style={styles.iconBtn}>
            <Ionicons name="trash-outline" size={18} color={colors.text} />
          </Tap>
        ) : null}
      />
    </View>
  );

  if (item === undefined) return <>{header}<View style={styles.content}><Skeleton rows={4} /></View></>;
  if (item === null) {
    return (
      <>
        {header}
        <View style={styles.content} testID="item-deleted">
          <EmptyState icon="trash-outline" title="This item was deleted" body="It’s no longer in your Library.">
            <Button testID="item-deleted-back-button" title="Back" icon="chevron-back" variant="secondary" fullWidth onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={{ marginTop: space.sm }} />
          </EmptyState>
        </View>
      </>
    );
  }

  const pastel = pastelFor(item.primaryType);
  const m = metaFor(item.primaryType);
  let domain = "";
  try {
    domain = item.sourceUrl ? new URL(item.sourceUrl).hostname.replace(/^www\./, "") : "";
  } catch {}
  const inProgress = IN_PROGRESS_EXTRACTION_STATUSES.includes(item.extractionStatus);
  const keyFacts = [
    ["Deadline", item.deadline],
    ["Location", item.location],
    ["Price", item.price],
  ].filter((f): f is [string, string] => !!f[1]);

  return (
    <>
      <ScrollView contentContainerStyle={styles.scroll} testID="item-detail-screen" keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>
        <View style={[styles.hero, { backgroundColor: pastel, paddingTop: insets.top }]}>
          <Ionicons name={(typeIconFor(item.primaryType).startsWith("logo-") ? typeIconFor(item.primaryType) : `${typeIconFor(item.primaryType)}-outline`) as typeof m.icon} size={120} color={colors.text} style={styles.glyph} />
          <ScreenHeader
            title=""
            back
            right={
              <Tap testID="delete-item-button" accessibilityLabel="Delete save" onPress={confirmDelete} style={styles.iconBtn}>
                <Ionicons name="trash-outline" size={18} color={colors.text} />
              </Tap>
            }
          />
          <View style={styles.chips}>
            <View style={styles.typePill}><Text style={styles.typePillText}>{m.label}</Text></View>
            {item.contentTypes.filter((t) => t !== item.primaryType).map((t) => (
              <View key={t} style={styles.typePill}><Text style={styles.typePillText}>{metaFor(t).label}</Text></View>
            ))}
            <StatusPill status={item.extractionStatus} />
          </View>
          <Text style={styles.heroTitle} numberOfLines={3} testID="item-title">{itemTitle(item)}</Text>
          {item.summary ? <Text style={styles.heroSummary} testID="item-summary">{item.summary}</Text> : null}
          <View style={styles.row}>
            <View style={styles.sourceDot}><Ionicons name={item.sourceUrl ? "link" : "bookmark"} size={11} color={colors.text} /></View>
            <Text style={styles.heroMeta} numberOfLines={1}>{domain || (item.sourcePlatform !== "manual" ? item.sourcePlatform : "Saved")} · {timeAgo(item.createdAt)}</Text>
          </View>
        </View>
        <View style={styles.content}>
        {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" testID="item-image" /> : null}

        {inProgress ? (
          <View style={styles.progress} testID="item-processing">
            <ActivityIndicator color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={type.heading}>Understanding…</Text>
              <Text style={type.caption}>{item.extractionStatus === "extracting" ? "Reading the source." : item.extractionStatus === "analyzing" ? "Figuring out what this is and what you can do with it." : "Starting up."} Actions appear here when it’s ready; you can leave this screen.</Text>
            </View>
          </View>
        ) : null}

        {item.extractionStatus === "needs_input" ? <NeedsInfo item={item} /> : null}
        {item.extractionStatus === "failed" ? <Failed item={item} /> : null}

        {item.extractionStatus === "ready" ? (
          <Boundary title="Couldn’t load actions">
            <Actions item={item} />
          </Boundary>
        ) : null}

        {item.extractionStatus === "ready" ? (
          <Button testID="create-post" title="Create post" icon="create-outline" variant="secondary" fullWidth onPress={() => router.push({ pathname: "/studio/platforms", params: { itemId } })} />
        ) : null}

        {keyFacts.length > 0 ? (
          <View style={styles.keyFacts}>
            {keyFacts.map(([label, value]) => (
              <View key={label} style={styles.keyFact}>
                <Text style={type.label}>{label}</Text>
                <Text style={type.heading}>{value}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {item.extractionStatus === "ready" || item.extractionStatus === "needs_input" ? (
          <Boundary fallback={null}>
            <Facts itemId={itemId} color={pastel} />
          </Boundary>
        ) : null}

        {item.extractionStatus === "ready" ? (
          <Boundary fallback={null}>
            <PreviousResults itemId={itemId} type={item.primaryType} />
          </Boundary>
        ) : null}

        <Section title="Source">
          {item.sourceUrl ? (
            <Tap testID="open-source-button" accessibilityLabel="Open source" onPress={() => WebBrowser.openBrowserAsync(item.sourceUrl!).catch(() => {})} style={styles.source}>
              <Ionicons name="link" size={16} color={colors.text} />
              <Text style={styles.sourceText} numberOfLines={1}>{item.sourceUrl}</Text>
              <Ionicons name="open-outline" size={16} color={colors.textFaint} />
            </Tap>
          ) : null}
          {item.rawText ? <Text style={[type.body, styles.raw]} numberOfLines={12}>{item.rawText}</Text> : null}
          {!item.sourceUrl && !item.rawText && !item.imageUrl ? <Text style={type.caption}>No source content.</Text> : null}
        </Section>
        </View>
      </ScrollView>
    </>
  );
}

const FACTS_PREVIEW = 4;

function Facts({ itemId, color }: { itemId: Id<"savedItems">; color: string }) {
  const analysis = useOwnedQuery(api.analysis.getForItem, { itemId });
  const [showAll, setShowAll] = useState(false);
  if (!analysis || analysis.facts.length === 0) return null;
  const facts = showAll ? analysis.facts : analysis.facts.slice(0, FACTS_PREVIEW);
  return (
    <Section title="Facts">
      <View testID="facts-list" style={styles.grid}>
        {facts.map((f, i) => <FactRow key={f.key + i} fact={f} index={i} color={color} />)}
        {analysis.facts.length > FACTS_PREVIEW ? (
          <Tap testID="facts-show-all" accessibilityRole="button" haptic="none" onPress={() => setShowAll(!showAll)} style={styles.showAll}>
            <Text style={styles.link}>{showAll ? "Show less" : `Show all (${analysis.facts.length})`}</Text>
            <Ionicons name={showAll ? "chevron-up" : "chevron-down"} size={16} color={colors.text} />
          </Tap>
        ) : null}
      </View>
    </Section>
  );
}

function Actions({ item }: { item: SavedItemView }) {
  const itemId = item._id as Id<"savedItems">;
  const suggestions = useOwnedQuery(api.actions.listSuggestions, { itemId });
  const profile = useOwnedQuery(api.preferences.get, {});
  const color = pastelFor(item.primaryType);
  return (
    <Section
      title="Do something"
      right={<Tap testID="open-actions-button" onPress={() => router.push({ pathname: "/item/[id]/actions", params: { id: item._id } })}><Text style={styles.link}>Details</Text></Tap>}
    >
      {suggestions === undefined ? (
        <Skeleton rows={3} height={110} />
      ) : suggestions.length === 0 ? (
        <View style={styles.progress}><ActivityIndicator color={colors.accent} /><Text style={type.caption}>Picking the best actions for this save…</Text></View>
      ) : (
        [...suggestions].sort((a, b) => a.rank - b.rank).map((s) => <ActionCard key={s._id} suggestion={s} color={color} profile={profile} item={item} />)
      )}
    </Section>
  );
}

function PreviousResults({ itemId, type: contentType }: { itemId: Id<"savedItems">; type: SavedItemView["primaryType"] }) {
  const results = useOwnedQuery(api.actions.listResultsForItem, { itemId });
  if (!results || results.length === 0) return null;
  return (
    <Section title="Previous results">
      {results.map((r) => (
        <ItemRow
          key={r._id}
          testID={`outcome-${r._id}`}
          type={contentType}
          title={r.result.title}
          meta={`Result · ${timeAgo(r.createdAt)}`}
          onPress={() => router.push({ pathname: "/result/[id]", params: { id: r.executionId } })}
        />
      ))}
    </Section>
  );
}

function useRun() {
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
  return { busy, error, run };
}

function NeedsInfo({ item }: { item: SavedItemView }) {
  const itemId = item._id as Id<"savedItems">;
  const retry = useOwnedMutation(api.items.retry);
  const update = useOwnedMutation(api.items.update);
  const getUploadUrl = useOwnedMutation(api.items.generateUploadUrl);
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState("");
  const { busy, error, run } = useRun();

  const addScreenshot = () =>
    run(async () => {
      const [picked] = await pickImages("library");
      if (!picked) return;
      const storageId = (await uploadImage(picked, () => getUploadUrl({}))) as Id<"_storage">;
      await retry({ itemId, imageStorageId: storageId });
    });

  const submitText = () =>
    run(async () => {
      await update({ itemId, rawText: text });
      await retry({ itemId });
      setText("");
      setPasting(false);
    });

  return (
    <View style={styles.attention} testID="needs-input-panel">
      <View style={styles.row}><Ionicons name="lock-closed" size={18} color={colors.text} /><Text style={[type.heading, { flex: 1 }]}>Needs more info</Text></View>
      <Text style={type.caption}>
        {item.sourceUrl ? "We couldn’t read this link" : "We couldn’t get enough from this"}{item.extractionError ? ` (${item.extractionError})` : ""}. We kept it. Add a screenshot or paste the text and we’ll run the analysis again.
      </Text>
      {item.missingInfo && item.missingInfo.length > 0 ? <Text style={type.caption}>Missing: {item.missingInfo.join(", ")}</Text> : null}
      <View style={styles.row}>
        <Button testID="needs-info-add-screenshot-button" title="Add screenshot" icon="image" onPress={addScreenshot} loading={busy && !pasting} style={{ flex: 1 }} />
        <Button testID="needs-info-paste-text-button" title="Paste text" icon="document-text" variant="secondary" onPress={() => setPasting(true)} style={{ flex: 1 }} />
      </View>
      {pasting ? (
        <>
          <Field testID="needs-info-text-input" placeholder="Paste the text from the page" value={text} onChangeText={setText} multiline autoFocus />
          <Button testID="needs-info-submit-button" title="Analyze this text" icon="arrow-forward" fullWidth disabled={text.trim().length < 10} loading={busy} onPress={submitText} />
        </>
      ) : null}
      {error ? <Text style={styles.error} testID="needs-info-error">{error}</Text> : null}
    </View>
  );
}

function Failed({ item }: { item: SavedItemView }) {
  const retry = useOwnedMutation(api.items.retry);
  const { busy, error, run } = useRun();
  return (
    <View style={[styles.attention, { backgroundColor: theme.dangerSoft }]} testID="failed-panel">
      <View style={styles.row}><Ionicons name="alert-circle" size={18} color={colors.danger} /><Text style={[type.heading, { color: colors.danger }]}>Analysis failed</Text></View>
      {item.extractionError ? <Text style={type.caption}>{item.extractionError}</Text> : null}
      <Button testID="retry-button" title="Retry analysis" icon="refresh" fullWidth onPress={() => run(() => retry({ itemId: item._id as Id<"savedItems"> }))} loading={busy} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  top: { paddingHorizontal: space.xl },
  scroll: { paddingBottom: 80 },
  content: { padding: space.xl, gap: space.xl },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  glyph: { position: "absolute", right: -10, bottom: -14, opacity: 0.1 },
  typePill: { backgroundColor: "rgba(255,255,255,0.6)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  typePillText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase", color: colors.text },
  sourceDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  chips: { flexDirection: "row", gap: space.sm, flexWrap: "wrap" },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  image: { width: "100%", aspectRatio: 4 / 3, borderRadius: radius.xl, backgroundColor: colors.surfaceRaised },
  hero: { paddingHorizontal: space.xl, paddingBottom: space.xxl, gap: space.md, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: "hidden" },
  heroTitle: { fontSize: 28, lineHeight: 32, fontWeight: "900", letterSpacing: -0.6, color: colors.text },
  heroSummary: { fontSize: 15, lineHeight: 21, color: "rgba(14,14,16,0.7)" },
  heroMeta: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.text },
  keyFacts: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  keyFact: { flexGrow: 1, minWidth: "45%", gap: 4, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  progress: { flexDirection: "row", gap: space.md, alignItems: "center", padding: space.xl, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  attention: { gap: space.md, padding: space.xl, borderRadius: radius.xl, backgroundColor: theme.warningSoft },
  row: { flexDirection: "row", gap: space.sm, alignItems: "center" },
  error: { color: colors.danger, fontWeight: "600" },
  link: { color: colors.text, fontWeight: "700", fontSize: 14, textDecorationLine: "underline" },
  showAll: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: space.md },
  source: { flexDirection: "row", alignItems: "center", gap: 8, padding: space.lg, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  sourceText: { flex: 1, color: colors.text },
  raw: { color: colors.textMuted, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
});
