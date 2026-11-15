import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Boundary } from "../../components/Boundary";
import { EmptyState } from "../../components/EmptyState";
import { GradientButton } from "../../components/GradientButton";
import { errorMessage } from "../../components/media";
import { Tap } from "../../components/Pressable";
import { ScreenHeader } from "../../components/ScreenHeader";
import { Section } from "../../components/Section";
import { Skeleton } from "../../components/States";
import { DraftStatusPill } from "../../components/studio/DraftStatusPill";
import { platformMeta } from "../../components/studio/platforms";
import { colors, radius, space, type } from "../../components/tokens";
import { useOwnedMutation, useOwnedQuery } from "../../identity/OwnerProvider";
import { publishStatusLabel, useDraftSharing } from "../../lib/share";
import type { SocialDraftView, SocialPlatform } from "../../shared/socialContracts";

type Source = { itemId: Id<"savedItems"> } | { mediaId: Id<"mediaAssets"> };

export default function StudioEditor() {
  const { itemId, mediaId, platform } = useLocalSearchParams<{ itemId?: string; mediaId?: string; platform?: string }>();
  const source: Source = itemId ? { itemId: itemId as Id<"savedItems"> } : { mediaId: mediaId as Id<"mediaAssets"> };
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.pad}><ScreenHeader title="Your drafts" back /></View>
      <Boundary title="Couldn’t load drafts">
        <Editor source={source} initial={platform as SocialPlatform | undefined} />
      </Boundary>
    </SafeAreaView>
  );
}

function Editor({ source, initial }: { source: Source; initial?: SocialPlatform }) {
  const drafts = useOwnedQuery(api.social.drafts.listForSource, source);
  const [active, setActive] = useState<SocialPlatform | undefined>(initial);

  if (drafts === undefined) return <View style={styles.pad}><Skeleton rows={4} /></View>;
  if (drafts.length === 0) {
    return (
      <View style={styles.pad}>
        <EmptyState icon="create-outline" title="No drafts yet" body="Pick platforms to write your first drafts.">
          <GradientButton testID="studio-editor-start" label="Pick platforms" icon="sparkles" onPress={() => router.replace({ pathname: "/studio/platforms", params: source })} style={{ alignSelf: "stretch", marginTop: space.sm }} />
        </EmptyState>
      </View>
    );
  }

  const current = drafts.find((d) => d.platform === active) ?? drafts[0];
  const writing = drafts.filter((d) => d.generationStatus === "generating").length;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} style={styles.tabsWrap}>
        {drafts.map((d) => {
          const m = platformMeta(d.platform);
          const on = d._id === current._id;
          return (
            <Tap key={d._id} testID={`studio-tab-${d.platform}`} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={m.label} onPress={() => setActive(d.platform)} style={[styles.tab, on && styles.tabOn]}>
              {d.generationStatus === "generating" ? <ActivityIndicator size="small" color={colors.textMuted} /> : <Ionicons name={m.icon} size={16} color={on ? colors.text : colors.textMuted} />}
              <Text style={[styles.tabText, on && { color: colors.text }]}>{m.label}</Text>
            </Tap>
          );
        })}
        <Tap testID="studio-add-platform" accessibilityLabel="Add platforms" onPress={() => router.push({ pathname: "/studio/platforms", params: source })} style={styles.tab}>
          <Ionicons name="add" size={18} color={colors.textMuted} />
        </Tap>
      </ScrollView>
      {writing > 0 ? (
        <View style={styles.progress} testID="studio-generation-progress">
          <ActivityIndicator color={colors.accent} />
          <Text style={[type.caption, { flex: 1 }]}>Writing {writing === drafts.length ? "your drafts" : `${writing} more`}… {drafts.length - writing} of {drafts.length} ready.</Text>
        </View>
      ) : null}
      <DraftPanel key={current._id} draft={current} />
    </KeyboardAvoidingView>
  );
}

function DraftPanel({ draft }: { draft: SocialDraftView }) {
  const draftId = draft._id as Id<"socialDrafts">;
  const update = useOwnedMutation(api.social.drafts.update);
  const regenerate = useOwnedMutation(api.social.drafts.regenerate);
  const publish = useOwnedQuery(api.publishing.statusForDraft, draft.generationStatus === "ready" ? { draftId } : "skip");
  const sharing = useDraftSharing(draftId);
  const m = platformMeta(draft.platform);
  const [text, setText] = useState(draft.draftText);
  const [seen, setSeen] = useState(draft.draftText);
  const [busy, setBusy] = useState<null | "save" | "regen" | "share">(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (seen !== draft.draftText) {
    if (text === seen) setText(draft.draftText);
    setSeen(draft.draftText);
  }
  const dirty = text !== draft.draftText;

  const run = async (kind: "save" | "regen" | "share", fn: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    setNote(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const save = () => run("save", async () => {
    await update({ draftId, draftText: text, markReady: true });
    setNote("Saved as a new version.");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  });

  const doRegenerate = () => run("regen", async () => {
    setText(draft.draftText);
    await regenerate({ draftId });
  });
  const askRegenerate = () =>
    Alert.alert(`Rewrite the ${m.label} draft?`, dirty ? "Your unsaved changes here will be dropped. Saved versions and other platforms stay as they are." : "Other platforms and your saved versions stay as they are.", [
      { text: "Cancel", style: "cancel" },
      { text: "Rewrite", onPress: doRegenerate },
    ]);

  const copy = async () => {
    await sharing.copy(text);
    setNote("Copied. Paste it into " + m.label + ".");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };
  const share = () => run("share", async () => {
    if (dirty) {
      await update({ draftId, draftText: text, markReady: true });
    }
    const result = await sharing.share({ text });
    setNote(result.outcome === "shared" ? `Sent to the share sheet. Post it in ${m.label} yourself.` : null);
  });

  if (draft.generationStatus === "generating") {
    return (
      <View style={styles.content} testID={`studio-draft-generating-${draft.platform}`}>
        <View style={styles.genHead}>
          <ActivityIndicator color={m.color} />
          <Text style={type.heading}>Writing your {m.label} draft…</Text>
        </View>
        <Skeleton rows={3} height={56} />
      </View>
    );
  }

  if (draft.generationStatus === "failed" && !draft.draftText) {
    return (
      <View style={styles.content}>
        <EmptyState icon="alert-circle-outline" title={`Couldn’t write the ${m.label} draft`} body={draft.generationError ?? "Something went wrong."}>
          <GradientButton testID="studio-retry-generate" label="Try again" icon="refresh" variant="secondary" loading={busy === "regen"} onPress={doRegenerate} style={{ alignSelf: "stretch", marginTop: space.sm }} />
        </EmptyState>
      </View>
    );
  }

  const over = text.length > m.limit && !(draft.platform === "x" && draft.output?.thread?.length);
  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" testID={`studio-editor-${draft.platform}`}>
      <View style={styles.metaRow}>
        <DraftStatusPill status={publish?.status ?? draft.status} label={publish ? publishStatusLabel(publish) : undefined} testID={`studio-status-${draft.platform}`} />
        <Text style={type.caption} testID="studio-revision">v{draft.revision} · {draft.revisionSource === "user_edit" ? "edited by you" : draft.revisionSource === "regenerated" ? "rewritten" : "generated"}</Text>
      </View>
      {draft.generationStatus === "failed" ? <Text style={styles.error}>Last rewrite failed: {draft.generationError ?? "unknown error"}. Showing your previous version.</Text> : null}
      <TextInput
        testID={`studio-draft-input-${draft.platform}`}
        value={text}
        onChangeText={setText}
        multiline
        scrollEnabled={false}
        style={styles.input}
        placeholder="Write your post"
        placeholderTextColor={colors.textFaint}
      />
      <View style={styles.metaRow}>
        <Text style={[type.caption, over && { color: colors.danger }]} testID="studio-char-count">{text.length} / {m.limit}</Text>
        {dirty ? <Text style={[type.caption, { color: colors.warning }]}>Unsaved changes</Text> : note ? <Text style={[type.caption, { color: colors.success }]} testID="studio-note">{note}</Text> : null}
      </View>
      {error ? <Text style={styles.error} testID="studio-error">{error}</Text> : null}

      <View style={styles.actions}>
        <GradientButton testID="studio-save" label={dirty ? "Save edit" : "Saved"} icon="checkmark" loading={busy === "save"} disabled={!dirty} onPress={save} style={{ flex: 1 }} />
        <GradientButton testID="studio-share" label="Share" icon="share-outline" variant="secondary" loading={busy === "share"} disabled={!text.trim()} onPress={share} style={{ flex: 1 }} />
      </View>
      <View style={styles.smallActions}>
        <Small testID="studio-copy" icon="copy-outline" label="Copy" onPress={copy} />
        <Small testID="studio-preview" icon="eye-outline" label="Preview" onPress={() => router.push({ pathname: "/studio/preview", params: { draftId, text: dirty ? text : undefined } })} />
        <Small testID="studio-regenerate" icon="refresh" label="Rewrite" onPress={askRegenerate} busy={busy === "regen"} />
      </View>
      <Text style={type.caption}>Nothing is posted for you. Share opens the iOS share sheet; you post it yourself.</Text>

      {draft.output?.hashtags?.length ? (
        <Section title="Hashtags">
          <Text style={[type.body, { color: colors.accent }]}>{draft.output.hashtags.map((h) => (h.startsWith("#") ? h : "#" + h)).join(" ")}</Text>
        </Section>
      ) : null}
      {draft.output?.mediaSuggestions?.length ? (
        <Section title="Media ideas">
          {draft.output.mediaSuggestions.map((s, i) => <Text key={i} style={type.caption}>• {s}</Text>)}
        </Section>
      ) : null}
      {draft.provenance.length ? (
        <Section title="Facts used">
          <View style={styles.facts} testID="studio-facts">
            {draft.provenance.map((f, i) => (
              <View key={i} style={styles.fact}>
                <Text style={type.label}>{f.label}</Text>
                <Text style={type.body}>{f.value}</Text>
                <Text style={type.caption} numberOfLines={1}>Source: {f.source}</Text>
              </View>
            ))}
          </View>
        </Section>
      ) : null}
    </ScrollView>
  );
}

function Small({ testID, icon, label, onPress, busy }: { testID: string; icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; onPress: () => void; busy?: boolean }) {
  return (
    <Tap testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={busy} style={styles.small}>
      {busy ? <ActivityIndicator size="small" color={colors.text} /> : <Ionicons name={icon} size={18} color={colors.text} />}
      <Text style={styles.smallText}>{label}</Text>
    </Tap>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  pad: { paddingHorizontal: space.lg },
  tabsWrap: { flexGrow: 0 },
  tabs: { paddingHorizontal: space.lg, paddingVertical: space.sm, gap: space.sm },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: space.md, height: 38, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tabOn: { backgroundColor: colors.accent + "26", borderColor: colors.accent },
  tabText: { color: colors.textMuted, fontWeight: "700", fontSize: 14 },
  progress: { flexDirection: "row", alignItems: "center", gap: space.md, marginHorizontal: space.lg, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  content: { padding: space.lg, gap: space.lg, paddingBottom: 120 },
  genHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
  input: { minHeight: 200, color: colors.text, fontSize: 16, lineHeight: 23, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, textAlignVertical: "top" },
  actions: { flexDirection: "row", gap: space.sm },
  smallActions: { flexDirection: "row", gap: space.sm },
  small: { flex: 1, alignItems: "center", gap: 4, paddingVertical: space.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  smallText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  error: { color: colors.danger, fontWeight: "600" },
  facts: { gap: space.sm },
  fact: { gap: 2, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
});
