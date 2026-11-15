import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Alert, Image, ScrollView, StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { CalendarAgentCard } from "../../../components/agents/CalendarAgent";
import { ActionCard } from "../../../components/ActionCard";
import { Boundary } from "../../../components/Boundary";
import { FactRow } from "../../../components/FactRow";
import { Field } from "../../../components/Field";
import { itemTitle } from "../../../components/ItemCard";
import { EmptyState } from "../../../components/EmptyState";
import { errorMessage, pickImages, uploadImage } from "../../../components/media";
import { Tap } from "../../../components/Pressable";
import { RunRepoCard } from "../../../components/RunRepoCard";
import { ScreenHeader } from "../../../components/ScreenHeader";
import { BouncingDots, Burst, Shimmer, success } from "../../../components/Signature";
import { Skeleton } from "../../../components/States";
import { StatusPill } from "../../../components/StatusPill";
import { fonts, palette } from "../../../theme";
import { AvatarStack, Button, Doodle, Enter, ItemRow, Text, pastelFor, typeIconFor } from "../../../components/ui";
import { metaFor, timeAgo } from "../../../components/typeMeta";
import { useOwnedMutation, useOwnedQuery } from "../../../identity/OwnerProvider";
import { AGENT_ACTIONS, IN_PROGRESS_EXTRACTION_STATUSES, type ExtractionStatus, type SavedItemView } from "../../../shared/contracts";

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

function Block({ title, right, children, index }: { title: string; right?: ReactNode; children: ReactNode; index: number }) {
  return (
    <Enter index={index} style={styles.block}>
      <View style={styles.blockHead}>
        <Text accessibilityRole="header" style={styles.headline}>{title}</Text>
        {right}
      </View>
      {children}
    </Enter>
  );
}

/** Display statement (Archivo Black, caps) with one marker-highlighted keyword. */
function Statement({ title }: { title: string }) {
  const clipped = title.length > 64 ? title.slice(0, 62).replace(/\s+\S*$/, "") + "…" : title;
  const words = clipped.split(/\s+/).filter(Boolean);
  const key = words.reduce((best, w) => (w.replace(/[^\p{L}\p{N}]/gu, "").length > best.replace(/[^\p{L}\p{N}]/gu, "").length ? w : best), "");
  const size = clipped.length <= 36 ? 34 : 26;
  const style = { fontFamily: fonts.display, fontSize: size, lineHeight: size, letterSpacing: -0.5, textTransform: "uppercase" as const, color: palette.ink };
  const markAt = words.indexOf(key);
  return (
    <View testID="item-title" accessibilityRole="header" accessibilityLabel={title} style={styles.statement}>
      {words.map((w, i) => {
        if (i === markAt) {
          return (
            <View key={i} style={styles.marker}>
              <Text style={style}>{w}</Text>
            </View>
          );
        }
        return <Text key={i} style={style}>{w}</Text>;
      })}
    </View>
  );
}

/** Pastel header card. Opens at 0.96 and fades in; while understanding it sits on grey, and on Ready the pastel floods in from the left with a doodle burst. */
function HeaderCard({ status, pastel, children, pill, top }: { status: ExtractionStatus; pastel: string; children: ReactNode; pill: ReactNode; top: ReactNode }) {
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const working = IN_PROGRESS_EXTRACTION_STATUSES.includes(status);
  const flood = useSharedValue(working ? 0 : 1);
  const enter = useSharedValue(0);
  const [burst, setBurst] = useState(0);
  const prev = useRef(status);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    enter.set(withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) }));
  }, [enter]);

  useEffect(() => {
    const was = IN_PROGRESS_EXTRACTION_STATUSES.includes(prev.current);
    prev.current = status;
    if (working) {
      flood.set(0);
      return;
    }
    flood.set(withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }));
    if (was && status === "ready") {
      success();
      setBurst((b) => b + 1);
    }
  }, [status, working, flood]);

  const cardStyle = useAnimatedStyle(() => ({ opacity: enter.value, transform: [{ scale: reduce ? 1 : 0.96 + enter.value * 0.04 }] }));
  const floodStyle = useAnimatedStyle(() => (reduce ? { opacity: flood.value, width } : { width: width * flood.value }));

  return (
    <View style={[styles.hero, { paddingTop: insets.top }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} testID="item-header-card">
      <Animated.View pointerEvents="none" style={[styles.flood, { backgroundColor: pastel }, floodStyle]} />
      {working ? <Shimmer color={pastel} width={160} /> : null}
      <View pointerEvents="none" style={[styles.doodles, { top: insets.top + 56 }]}>
        <View style={{ transform: [{ rotate: "10deg" }] }}><Doodle kind="star" size={40} fill={palette.white} /></View>
        <View style={{ transform: [{ rotate: "-8deg" }], marginTop: 18 }}><Doodle kind="burst" size={36} /></View>
        <View style={{ position: "absolute", top: 40, right: 26, transform: [{ rotate: "6deg" }] }}><Doodle kind="squiggle" size={40} /></View>
      </View>
      {top}
      <Animated.View style={[styles.heroBody, cardStyle]}>
      <Burst play={burst}>{pill}</Burst>
      {children}
      </Animated.View>
    </View>
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
            <Ionicons name="trash-outline" size={20} color={palette.ink} />
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
            <Button testID="item-deleted-back-button" title="Back" icon="chevron-back" variant="secondary" fullWidth onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={{ marginTop: 8 }} />
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
  const ready = item.extractionStatus === "ready";
  const keyFacts = [
    ["Deadline", item.deadline],
    ["Location", item.location],
    ["Price", item.price],
  ].filter((f): f is [string, string] => !!f[1]);
  const icon = typeIconFor(item.primaryType);

  return (
    <ScrollView contentContainerStyle={styles.scroll} testID="item-detail-screen" keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>
        <HeaderCard
          status={item.extractionStatus}
          pastel={pastel}
          pill={<StatusPill status={item.extractionStatus} />}
          top={
            <ScreenHeader
              title=""
              back
              right={
                <Tap testID="delete-item-button" accessibilityLabel="Delete save" onPress={confirmDelete} style={styles.iconBtn}>
                  <Ionicons name="trash-outline" size={20} color={palette.ink} />
                </Tap>
              }
            />
          }
        >
          <View style={styles.chips}>
            <View style={styles.typePill}>
              <Ionicons name={icon} size={14} color={palette.ink} />
              <Text style={styles.overline}>{m.label}</Text>
            </View>
            {item.contentTypes.filter((t) => t !== item.primaryType).map((t) => (
              <View key={t} style={styles.typePill}><Text style={styles.overline}>{metaFor(t).label}</Text></View>
            ))}
          </View>
          <Statement title={itemTitle(item)} />
          <AvatarStack labels={[domain || item.sourcePlatform, m.label, itemTitle(item)]} />
          {item.summary ? <Text style={styles.body} numberOfLines={3} testID="item-summary">{item.summary}</Text> : null}
          <Text style={styles.meta} numberOfLines={1}>{domain || (item.sourcePlatform !== "manual" ? item.sourcePlatform : "Saved")} · {timeAgo(item.createdAt)}</Text>
        </HeaderCard>
      <View style={styles.content}>
        {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" testID="item-image" /> : null}

        {inProgress ? (
          <View style={styles.progress} testID="item-processing">
            <Shimmer color={pastel} width={200} />
            <View style={styles.row}>
              <Text style={styles.headline}>Understanding…</Text>
              <BouncingDots />
            </View>
            <Text style={styles.body}>{item.extractionStatus === "extracting" ? "Reading the source." : item.extractionStatus === "analyzing" ? "Figuring out what this is and what you can do with it." : "Starting up."} Actions appear here when it’s ready. You can leave this screen.</Text>
          </View>
        ) : null}

        {item.extractionStatus === "needs_input" ? <NeedsInfo item={item} /> : null}
        {item.extractionStatus === "failed" ? <Failed item={item} /> : null}

        {ready ? (
          <Boundary title="Couldn’t load actions">
            <Actions item={item} />
          </Boundary>
        ) : null}

        {ready ? <Boundary fallback={null}><CalendarAgentCard itemId={itemId} primaryType={item.primaryType} /></Boundary> : null}

        {ready ? (
          <Button testID="create-post" title="Create post" icon="create-outline" variant="secondary" fullWidth onPress={() => router.push({ pathname: "/studio/platforms", params: { itemId } })} />
        ) : null}

        {ready || item.extractionStatus === "needs_input" ? (
          <Boundary fallback={null}>
            <Facts itemId={itemId} color={pastel} keyFacts={keyFacts} />
          </Boundary>
        ) : keyFacts.length > 0 ? (
          <KeyFacts keyFacts={keyFacts} color={pastel} />
        ) : null}

        {ready ? (
          <Boundary fallback={null}>
            <PreviousResults itemId={itemId} type={item.primaryType} />
          </Boundary>
        ) : null}

        <Block title="Source" index={4}>
          {item.sourceUrl ? (
            <Tap testID="open-source-button" accessibilityLabel="Open source" onPress={() => WebBrowser.openBrowserAsync(item.sourceUrl!).catch(() => {})} style={styles.source}>
              <Ionicons name="link-outline" size={18} color={palette.ink} />
              <Text style={styles.sourceText} numberOfLines={1}>{item.sourceUrl}</Text>
              <Ionicons name="open-outline" size={18} color={palette.ink} />
            </Tap>
          ) : null}
          {item.rawText ? <Text style={[styles.body, styles.raw]} numberOfLines={12}>{item.rawText}</Text> : null}
          {!item.sourceUrl && !item.rawText && !item.imageUrl ? <Text style={styles.meta}>No source content.</Text> : null}
        </Block>
      </View>
    </ScrollView>
  );
}

function KeyFacts({ keyFacts, color }: { keyFacts: [string, string][]; color: string }) {
  return (
    <View style={styles.grid} testID="key-facts">
      {keyFacts.map(([label, value]) => (
        <View key={label} style={[styles.keyFact, { backgroundColor: color + "80" }]}>
          <Text style={styles.overline}>{label}</Text>
          <Text style={styles.value}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

const FACTS_PREVIEW = 4;

function Facts({ itemId, color, keyFacts }: { itemId: Id<"savedItems">; color: string; keyFacts: [string, string][] }) {
  const analysis = useOwnedQuery(api.analysis.getForItem, { itemId });
  const [showAll, setShowAll] = useState(false);
  const facts = analysis?.facts ?? [];
  if (facts.length === 0 && keyFacts.length === 0) return null;
  const shown = showAll ? facts : facts.slice(0, FACTS_PREVIEW);
  return (
    <Block title="Facts" index={2} right={facts.length > 0 ? <Text style={styles.meta}>Tap to see the quote</Text> : null}>
      {keyFacts.length > 0 ? <KeyFacts keyFacts={keyFacts} color={color} /> : null}
      {facts.length > 0 ? (
        <View testID="facts-list" style={styles.grid}>
          {shown.map((f, i) => <FactRow key={f.key + i} fact={f} index={i} color={color} />)}
          {facts.length > FACTS_PREVIEW ? (
            <Tap testID="facts-show-all" accessibilityRole="button" haptic="none" onPress={() => setShowAll(!showAll)} style={styles.showAll}>
              <Text style={styles.callout}>{showAll ? "Show less" : `Show all (${facts.length})`}</Text>
              <Ionicons name={showAll ? "chevron-up" : "chevron-down"} size={18} color={palette.ink} />
            </Tap>
          ) : null}
        </View>
      ) : null}
    </Block>
  );
}

function Actions({ item }: { item: SavedItemView }) {
  const itemId = item._id as Id<"savedItems">;
  const suggestions = useOwnedQuery(api.actions.listSuggestions, { itemId });
  const profile = useOwnedQuery(api.preferences.get, {});
  const color = pastelFor(item.primaryType);
  return (
    <Block
      title="Do something"
      index={1}
      right={<Tap testID="open-actions-button" hitSlop={10} onPress={() => router.push({ pathname: "/item/[id]/actions", params: { id: item._id } })}><Text style={styles.link}>Details</Text></Tap>}
    >
      {suggestions === undefined ? (
        <Skeleton rows={3} height={72} />
      ) : suggestions.length === 0 ? (
        <View style={styles.progress}>
          <Shimmer color={color} width={200} />
          <View style={styles.row}><Text style={styles.body}>Picking the best actions for this save</Text><BouncingDots /></View>
        </View>
      ) : (
        [...suggestions].sort((a, b) => a.rank - b.rank).map((s) => <ActionCard key={s._id} suggestion={s} color={color} profile={profile} item={item} />)
      )}
      {suggestions && suggestions.length > 0 && item.primaryType && AGENT_ACTIONS.run_repo?.contentTypes.includes(item.primaryType) ? <RunRepoCard itemId={itemId} color={color} /> : null}
    </Block>
  );
}

function PreviousResults({ itemId, type: contentType }: { itemId: Id<"savedItems">; type: SavedItemView["primaryType"] }) {
  const results = useOwnedQuery(api.actions.listResultsForItem, { itemId });
  if (!results || results.length === 0) return null;
  return (
    <Block title="Results" index={3}>
      {results.map((r) => (
        <ItemRow
          key={r._id}
          testID={`outcome-${r._id}`}
          type={contentType}
          status="ready"
          title={r.result.title}
          meta={`Result · ${timeAgo(r.createdAt)}`}
          onPress={() => router.push({ pathname: "/result/[id]", params: { id: r.executionId } })}
        />
      ))}
    </Block>
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
      <View style={styles.row}><Ionicons name="lock-closed-outline" size={18} color={palette.ink} /><Text style={[styles.headline, { flex: 1 }]}>Needs more info</Text></View>
      <Text style={styles.body}>
        {item.sourceUrl ? "We couldn’t read this link" : "We couldn’t get enough from this"}{item.extractionError ? ` (${item.extractionError})` : ""}. We kept it. Add a screenshot or paste the text and we’ll run the analysis again.
      </Text>
      {item.missingInfo && item.missingInfo.length > 0 ? <Text style={styles.body}>Missing: {item.missingInfo.join(", ")}</Text> : null}
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
      {error ? <Text style={styles.body} testID="needs-info-error">{error}</Text> : null}
    </View>
  );
}

function Failed({ item }: { item: SavedItemView }) {
  const retry = useOwnedMutation(api.items.retry);
  const { busy, error, run } = useRun();
  return (
    <View style={[styles.attention, { backgroundColor: palette.peach }]} testID="failed-panel">
      <View style={styles.row}><View style={styles.redDot} /><Text style={styles.headline}>Analysis failed</Text></View>
      {item.extractionError ? <Text style={styles.body}>{item.extractionError}</Text> : null}
      <Button testID="retry-button" title="Retry analysis" icon="refresh" fullWidth onPress={() => run(() => retry({ itemId: item._id as Id<"savedItems"> }))} loading={busy} />
      {error ? <Text style={styles.body}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.white },
  top: { paddingHorizontal: 20 },
  scroll: { paddingBottom: 120 },
  content: { paddingHorizontal: 20, paddingTop: 28, gap: 28 },
  block: { gap: 12 },
  blockHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  headline: { fontFamily: fonts.extraBold, fontSize: 18, lineHeight: 24, color: palette.ink },
  body: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22, color: palette.ink },
  callout: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 20, color: palette.ink },
  meta: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: palette.ink },
  overline: { fontFamily: fonts.extraBold, fontSize: 11, lineHeight: 14, letterSpacing: 0.9, textTransform: "uppercase", color: palette.ink },
  value: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: palette.ink },
  link: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 20, color: palette.ink, textDecorationLine: "underline" },
  hero: { paddingHorizontal: 20, paddingBottom: 32, overflow: "hidden", backgroundColor: palette.grey, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  heroBody: { gap: 12, paddingTop: 8 },
  doodles: { position: "absolute", right: 20, flexDirection: "row", gap: 6 },
  flood: { position: "absolute", top: 0, left: 0, bottom: 0 },
  statement: { flexDirection: "row", flexWrap: "wrap", columnGap: 8, rowGap: 4, paddingRight: 64 },
  marker: { backgroundColor: palette.white, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 2, transform: [{ rotate: "-1.5deg" }] },
  chips: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  typePill: { flexDirection: "row", alignItems: "center", gap: 6, height: 28, backgroundColor: palette.white, paddingHorizontal: 12, borderRadius: 999 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  keyFact: { width: "48%", flexGrow: 1, minHeight: 72, gap: 4, padding: 14, borderRadius: 18 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: palette.grey, alignItems: "center", justifyContent: "center" },
  image: { width: "100%", height: 160, maxHeight: 160, borderRadius: 28, backgroundColor: palette.grey },
  progress: { gap: 8, padding: 20, borderRadius: 20, backgroundColor: palette.grey, overflow: "hidden" },
  attention: { gap: 12, padding: 20, borderRadius: 20, backgroundColor: palette.butter },
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
  redDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#E5484D" },
  showAll: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44 },
  source: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 52, paddingHorizontal: 16, borderRadius: 999, backgroundColor: palette.grey },
  sourceText: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: palette.ink },
  raw: { padding: 16, borderRadius: 20, backgroundColor: palette.white, borderWidth: 1, borderColor: palette.hairline },
});
