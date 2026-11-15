import { Ionicons } from "@expo/vector-icons";
import { useAction } from "convex/react";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Image, Keyboard, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Field } from "../../../components/Field";
import { Button } from "../../../components/ui";
import { errorMessage, pickImages, uploadImage, type PickedImage } from "../../../components/media";
import { Tap } from "../../../components/Pressable";
import { ScreenHeader } from "../../../components/ScreenHeader";
import { Section } from "../../../components/Section";
import { colors, radius, space, type } from "../../../components/tokens";
import { useOwnedMutation, useOwnedQuery, useOwnerId } from "../../../identity/OwnerProvider";
import { SOCIAL_PLATFORM_LABELS, type MediaAnalysis, type SocialDraftView, type SocialPlatform } from "../../../shared/socialContracts";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const PLATFORMS: { key: SocialPlatform; label: string; icon: IconName }[] = [
  { key: "instagram", label: "Instagram", icon: "logo-instagram" },
  { key: "tiktok", label: "TikTok", icon: "logo-tiktok" },
  { key: "threads", label: "Threads", icon: "at" },
  { key: "x", label: "X", icon: "logo-twitter" },
  { key: "linkedin", label: "LinkedIn", icon: "logo-linkedin" },
];


const STEPS = { upload: "Uploading photo…", analyze: "Looking at your photo…", write: "Writing drafts…" } as const;

export default function PhotoStudio() {
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [context, setContext] = useState("");
  const [platforms, setPlatforms] = useState<SocialPlatform[]>(["instagram", "tiktok"]);
  const [step, setStep] = useState<keyof typeof STEPS | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<MediaAnalysis | null>(null);
  const [mediaId, setMediaId] = useState<Id<"mediaAssets"> | null>(null);
  const [requested, setRequested] = useState<SocialPlatform[]>([]);
  const getUploadUrl = useOwnedMutation(api.media.generateUploadUrl);
  const createAsset = useOwnedMutation(api.media.createMediaAsset);
  const ownerId = useOwnerId();
  const analyze = useAction(api.media.analyzeMedia);
  const generate = useOwnedMutation(api.social.drafts.generate);
  const allDrafts = useOwnedQuery(api.social.drafts.listForSource, mediaId ? { mediaId } : "skip");
  const drafts = mediaId ? (allDrafts ?? []).filter((d) => requested.includes(d.platform)) : null;
  const writing = !!drafts?.some((d) => d.generationStatus === "generating");

  const choose = async (source: "library" | "camera") => {
    setError(null);
    try {
      const [picked] = await pickImages(source);
      if (picked) {
        setPhoto(picked);
        setMediaId(null);
        setAnalysis(null);
      }
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const toggle = (p: SocialPlatform) =>
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const run = async () => {
    if (!photo || !platforms.length) return;
    Keyboard.dismiss();
    setError(null);
    setMediaId(null);
    setAnalysis(null);
    try {
      setStep("upload");
      const storageId = await uploadImage(photo, () => getUploadUrl({}));
      const mediaId = await createAsset({ storageId: storageId as Id<"_storage">, context: context.trim() || undefined });
      setStep("analyze");
      setAnalysis(await analyze({ ownerId, mediaId }));
      setStep("write");
      await generate({ mediaId, platforms, context: context.trim() || undefined });
      setRequested(platforms);
      setMediaId(mediaId);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setStep(null);
    }
  };

  const busy = step !== null || writing;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" testID="photo-studio-scroll">
        <ScreenHeader title="Post from a photo" back />

        <Section title="Photo">
          {photo ? (
            <View style={styles.previewWrap}>
              <Image source={{ uri: photo.uri }} style={[styles.preview, { aspectRatio: Math.max(0.6, Math.min(1.6, photo.width / photo.height)) }]} testID="photo-preview" />
              <Tap testID="photo-change-button" accessibilityLabel="Change photo" onPress={() => choose("library")} style={styles.change} disabled={busy}>
                <Ionicons name="swap-horizontal" size={16} color={colors.text} />
                <Text style={styles.changeLabel}>Change</Text>
              </Tap>
            </View>
          ) : (
            <View style={styles.pickRow}>
              <PickTile testID="photo-pick-library" icon="images" label="Choose from library" onPress={() => choose("library")} />
              <PickTile testID="photo-pick-camera" icon="camera" label="Take a photo" onPress={() => choose("camera")} />
            </View>
          )}
        </Section>

        <Section title="Where or what is this? (optional)">
          <Field
            testID="photo-context-input"
            value={context}
            onChangeText={setContext}
            placeholder="e.g. Found this cafe on a walk and want to come back"
            multiline
            maxLength={500}
            style={styles.contextField}
            editable={!busy}
          />
          <Text style={type.caption}>Drafts only state what’s in the photo and what you write here.</Text>
        </Section>

        <Section title="Platforms">
          <View style={styles.chips}>
            {PLATFORMS.map((p) => {
              const on = platforms.includes(p.key);
              return (
                <Tap
                  key={p.key}
                  testID={`photo-platform-${p.key}`}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={p.label}
                  onPress={() => toggle(p.key)}
                  disabled={busy}
                  style={[styles.chip, on && styles.chipOn]}
                >
                  <Ionicons name={p.icon} size={16} color={on ? colors.text : colors.textMuted} />
                  <Text style={[styles.chipLabel, on && { color: colors.text }]}>{p.label}</Text>
                </Tap>
              );
            })}
          </View>
        </Section>

        {error ? (
          <View style={styles.error} testID="photo-error">
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={[type.body, { color: colors.danger, flex: 1 }]}>{error}</Text>
          </View>
        ) : null}

        <Button
          testID="photo-generate-button"
          title={step ? STEPS[step] : writing ? STEPS.write : drafts ? "Create new drafts" : "Create drafts"}
          icon="arrow-forward"
          loading={busy}
          disabled={!photo || !platforms.length}
          onPress={run}
         fullWidth />

        {analysis ? <AnalysisCard analysis={analysis} context={context.trim()} /> : null}
        {drafts?.map((d) =>
          d.generationStatus === "generating" ? (
            <PendingCard key={d._id} platform={d.platform} />
          ) : d.generationStatus === "failed" ? (
            <FailedCard key={d._id} draft={d} />
          ) : d.platform === "tiktok" ? (
            <TikTokCard key={d._id} draft={d} />
          ) : (
            <CaptionCard key={d._id} draft={d} />
          ),
        )}
        {mediaId && drafts?.length && !writing ? (
          <Button
            testID="photo-open-editor"
            title="Edit and share drafts"
            icon="create-outline"
            variant="secondary"
            onPress={() => router.push({ pathname: "/studio/editor", params: { mediaId, platform: drafts[0].platform } })}
           fullWidth />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function PickTile({ testID, icon, label, onPress }: { testID: string; icon: IconName; label: string; onPress: () => void }) {
  return (
    <Tap testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.tile}>
      <View style={styles.tileIcon}>
        <Ionicons name={icon} size={24} color={colors.text} />
      </View>
      <Text style={styles.tileLabel}>{label}</Text>
    </Tap>
  );
}

function AnalysisCard({ analysis, context }: { analysis: MediaAnalysis; context: string }) {
  const facts = [
    analysis.summary,
    analysis.setting && `Setting: ${analysis.setting}`,
    analysis.mood && `Mood: ${analysis.mood}`,
    analysis.textInImage && `Text in photo: ${analysis.textInImage}`,
  ].filter((f): f is string => !!f);
  return (
    <View style={styles.card} testID="photo-analysis-card">
      <View style={styles.cardHead}>
        <Ionicons name="eye" size={16} color={colors.text} />
        <Text style={type.label}>What’s in the photo · facts</Text>
      </View>
      {facts.map((f) => (
        <Text key={f} style={type.body}>{f}</Text>
      ))}
      {analysis.subjects.length ? (
        <View style={styles.tags}>
          {analysis.subjects.map((s) => (
            <Text key={s} style={styles.tag}>{s}</Text>
          ))}
        </View>
      ) : null}
      <Text style={type.caption}>{context ? `Source: the photo and your note "${context}"` : "Source: the photo only"}</Text>
    </View>
  );
}

function PendingCard({ platform }: { platform: SocialPlatform }) {
  return (
    <View style={[styles.card, styles.pending]} testID={`photo-draft-${platform}-pending`}>
      <ActivityIndicator color={colors.text} />
      <Text style={type.body}>Writing the {SOCIAL_PLATFORM_LABELS[platform]} draft…</Text>
    </View>
  );
}

function FailedCard({ draft }: { draft: SocialDraftView }) {
  const regenerate = useOwnedMutation(api.social.drafts.regenerate);
  return (
    <View style={styles.card} testID={`photo-draft-${draft.platform}-failed`}>
      <Text style={type.heading}>{SOCIAL_PLATFORM_LABELS[draft.platform]}</Text>
      <Text style={[type.body, { color: colors.danger }]}>{draft.generationError ?? "This draft couldn't be written."}</Text>
      <Button testID={`photo-retry-${draft.platform}`} title="Try again" icon="refresh" variant="secondary" onPress={() => regenerate({ draftId: draft._id as Id<"socialDrafts"> })}  fullWidth />
    </View>
  );
}

function CopyButton({ testID, text }: { testID: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Tap
      testID={testID}
      accessibilityLabel="Copy"
      onPress={async () => {
        await Clipboard.setStringAsync(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      style={styles.copy}
    >
      <Ionicons name={copied ? "checkmark" : "copy-outline"} size={15} color={copied ? colors.success : colors.text} />
      <Text style={styles.copyLabel}>{copied ? "Copied" : "Copy"}</Text>
    </Tap>
  );
}

function CardHeader({ platform, copyText }: { platform: SocialPlatform; copyText: string }) {
  const meta = PLATFORMS.find((p) => p.key === platform);
  return (
    <View style={styles.cardHead}>
      <Ionicons name={meta?.icon ?? "create"} size={18} color={colors.text} />
      <Text style={[type.heading, { flex: 1 }]}>{meta?.label ?? platform}</Text>
      <Text style={styles.status}>Draft</Text>
      <CopyButton testID={`photo-copy-${platform}`} text={copyText} />
    </View>
  );
}

function CaptionCard({ draft }: { draft: SocialDraftView }) {
  const slides = draft.output?.slides ?? [];
  return (
    <View style={styles.card} testID={`photo-draft-${draft.platform}`}>
      <CardHeader platform={draft.platform} copyText={draft.draftText} />
      <Text style={type.body} selectable testID={`photo-draft-${draft.platform}-text`}>{draft.draftText}</Text>
      {slides.length ? (
        <View style={{ gap: space.xs }}>
          <Text style={type.label}>Carousel</Text>
          {slides.map((slide, i) => (
            <Text key={i} style={type.caption}>{`${i + 1}. ${slide.title}: ${slide.body}`}</Text>
          ))}
        </View>
      ) : null}
      <FactsUsed draft={draft} />
    </View>
  );
}

function TikTokCard({ draft }: { draft: SocialDraftView }) {
  const s = draft.output?.script;
  return (
    <View style={styles.card} testID="photo-draft-tiktok">
      <CardHeader platform="tiktok" copyText={draft.draftText} />
      {s ? (
        <>
          <Block label="Hook" body={s.hook} highlight />
          {s.shots.length ? (
            <View style={{ gap: space.sm }}>
              <Text style={type.label}>Shots</Text>
              {s.shots.map((shot, i) => (
                <View key={i} style={styles.shot}>
                  <Text style={styles.shotNum}>{i + 1}</Text>
                  <Text style={[type.body, { flex: 1 }]}>{shot.visual}</Text>
                  {shot.durationSec ? <Text style={type.caption}>{shot.durationSec}s</Text> : null}
                </View>
              ))}
            </View>
          ) : null}
          {s.voiceover ? <Block label="Voiceover" body={s.voiceover} /> : null}
          {s.onScreenText.length ? <Block label="On-screen text" body={s.onScreenText.join("\n")} /> : null}
          {s.caption ? <Block label="Caption" body={s.caption} /> : null}
        </>
      ) : (
        <Text style={type.body} selectable>{draft.draftText}</Text>
      )}
      <FactsUsed draft={draft} />
    </View>
  );
}

function FactsUsed({ draft }: { draft: SocialDraftView }) {
  if (!draft.provenance.length) return null;
  return (
    <View style={styles.facts}>
      <Text style={type.label}>Facts used</Text>
      {draft.provenance.map((f, i) => (
        <Text key={i} style={type.caption}>{`${f.label}: ${f.value} · ${f.source.replace("_", " ")}`}</Text>
      ))}
    </View>
  );
}

function Block({ label, body, highlight }: { label: string; body: string; highlight?: boolean }) {
  return (
    <View style={{ gap: space.xs }}>
      <Text style={type.label}>{label}</Text>
      <Text style={[type.body, highlight && styles.hook]} selectable>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.xl, paddingBottom: 80 },
  pickRow: { flexDirection: "row", gap: space.md },
  tile: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: space.lg, gap: space.md, alignItems: "flex-start", minHeight: 120 },
  tileIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceRaised, alignItems: "center", justifyContent: "center" },
  tileLabel: { ...type.heading, fontSize: 15 },
  previewWrap: { borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  preview: { width: "100%", backgroundColor: colors.surface },
  change: { position: "absolute", right: space.md, bottom: space.md, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill },
  changeLabel: { color: colors.text, fontWeight: "700", fontSize: 13 },
  contextField: { minHeight: 90 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipOn: { borderColor: colors.text, backgroundColor: colors.surfaceRaised },
  chipLabel: { color: colors.textMuted, fontWeight: "700", fontSize: 14 },
  error: { flexDirection: "row", gap: space.sm, alignItems: "flex-start", padding: space.md, borderRadius: radius.md, backgroundColor: colors.surfaceRaised },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  cardHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  status: { ...type.caption, fontWeight: "700", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised, overflow: "hidden" },
  copy: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised },
  copyLabel: { color: colors.text, fontSize: 13, fontWeight: "700" },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  tag: { ...type.caption, color: colors.text, backgroundColor: colors.surfaceRaised, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, overflow: "hidden" },
  shot: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  shotNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surfaceRaised, color: colors.text, textAlign: "center", lineHeight: 24, fontWeight: "800", fontSize: 13, overflow: "hidden" },
  hook: { fontSize: 18, fontWeight: "700" },
  pending: { flexDirection: "row", alignItems: "center" },
  facts: { gap: space.xs, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.md },
});
