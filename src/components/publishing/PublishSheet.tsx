import * as Haptics from "expo-haptics";
import { useAction, useMutation } from "convex/react";
import { useState } from "react";
import { Linking, Modal, Pressable, ScrollView, View } from "react-native";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useOwnedQuery, useOwnerId } from "../../identity/OwnerProvider";
import {
  ACCOUNT_LABELS,
  DEFAULT_FALLBACK,
  copyDraft,
  fallbackUrl,
  publishStatusLabel,
  shareDraft,
  type FallbackKind,
} from "../../lib/share";
import type { SocialPlatform } from "../../shared/socialContracts";
import { colors, radius, spacing } from "../../theme";
import { Button, Text } from "../ui";

// OWNER: Thread J (CONS-11). Platform-generic publish sheet: direct publish when the
// platform's adapter is configured, otherwise its fallback (composer link or share sheet).

export type PublishSheetProps = {
  visible: boolean;
  onClose: () => void;
  draftId: Id<"socialDrafts">;
  platform: SocialPlatform;
  /** The exact text that will be posted (the draft's latest revision). */
  text: string;
  /** draft.revision the user is looking at; publishing refuses if the draft changed since. */
  revision: number;
  /** Source link, used by LinkedIn's share-offsite fallback. */
  sourceUrl?: string;
  /** Local image for share_file fallbacks. */
  imageUri?: string;
  /** Uploaded image the adapter attaches when publishing directly (ownership checked server-side). */
  imageStorageId?: Id<"_storage">;
  /** Override the platform's fallback: a kind, or your own handler called with the caption. */
  fallback?: FallbackKind | ((caption: string) => Promise<void>);
};

const STATUS_COLOR: Record<string, string> = {
  draft: colors.textMuted,
  ready_to_share: colors.success,
  awaiting_user_action: colors.warning,
  publishing: colors.info,
  published: colors.success,
  failed: colors.danger,
};

function errorText(e: unknown): string {
  const data = (e as { data?: unknown })?.data;
  if (typeof data === "string") return data;
  return "Something went wrong. Try again.";
}

export function PublishSheet({
  visible,
  onClose,
  draftId,
  platform,
  text,
  revision,
  sourceUrl,
  imageUri,
  imageStorageId,
  fallback,
}: PublishSheetProps) {
  const ownerId = useOwnerId();
  const status = useOwnedQuery(api.publishing.jobs.statusForDraft, visible ? { draftId } : "skip");
  const accounts = useOwnedQuery(api.publishing.jobs.connectedAccounts, visible ? {} : "skip");
  const publish = useAction(api.publishing.jobs.publish);
  const startShare = useMutation(api.publishing.jobs.startShare);
  const confirmPosted = useMutation(api.publishing.jobs.confirmUserPosted);
  const [busy, setBusy] = useState<null | "publish" | "fallback" | "confirm">(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const label = ACCOUNT_LABELS[platform];
  const direct = accounts?.find((a) => a.platform === platform)?.connected ?? false;
  const fallbackKind = typeof fallback === "string" ? fallback : DEFAULT_FALLBACK[platform];
  const intentUrl = fallbackUrl(platform, text, sourceUrl);
  const s = status?.status ?? "draft";
  const published = s === "published" && !!status?.url;

  async function run(kind: "publish" | "fallback" | "confirm", fn: () => Promise<unknown>) {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  const onPublish = () =>
    run("publish", async () => {
      const result = await publish({ ownerId, draftId, revision, imageStorageId });
      if (result.status === "published") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });

  const onFallback = () =>
    run("fallback", async () => {
      await startShare({ ownerId, draftId });
      if (typeof fallback === "function") return await fallback(text);
      if (fallbackKind === "intent_url" && intentUrl) {
        if (platform === "linkedin") await copyDraft(text);
        return await Linking.openURL(intentUrl);
      }
      await copyDraft(text);
      await shareDraft({ text, imageUri, url: imageUri ? undefined : sourceUrl });
    });

  const onCopy = async () => {
    await copyDraft(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const fallbackLabel =
    typeof fallback === "function" || fallbackKind === "share_file" || !intentUrl
      ? `Share to ${label}`
      : `Open in ${label}`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: colors.overlay }}
        onPress={onClose}
        testID="publish-sheet-backdrop"
      />
      <View
        testID="publish-sheet"
        style={{
          backgroundColor: colors.surface,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          padding: spacing.xl,
          paddingBottom: spacing.xxxl,
          gap: spacing.md,
          maxHeight: "85%",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text variant="heading">{direct ? `Publish to ${label}` : `Share to ${label}`}</Text>
          <View
            testID={`publish-status-${s}`}
            style={{
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xxs,
              borderRadius: radius.pill,
              backgroundColor: (STATUS_COLOR[s] ?? colors.textMuted) + "22",
            }}
          >
            <Text variant="caption" color={STATUS_COLOR[s] ?? colors.textMuted}>
              {publishStatusLabel(status ?? { status: "draft" })}
            </Text>
          </View>
        </View>

        <ScrollView
          style={{ maxHeight: 240, backgroundColor: colors.surfaceRaised, borderRadius: radius.md }}
          contentContainerStyle={{ padding: spacing.lg }}
        >
          <Text testID="publish-sheet-text" selectable>
            {text}
          </Text>
        </ScrollView>

        {direct ? (
          <Text variant="caption" tone="warning" testID="publish-sheet-notice">
            Posts publicly to your {label} account.
          </Text>
        ) : (
          <Text variant="caption" tone="muted" testID="publish-sheet-notice">
            {label} isn’t connected, so Zapy can’t post for you. Open it, post it yourself, then tap “I posted
            it”.
          </Text>
        )}

        {s === "failed" && status?.error ? (
          <Text variant="caption" tone="danger" testID="publish-sheet-error">
            {status.error}
          </Text>
        ) : null}
        {error ? (
          <Text variant="caption" tone="danger" testID="publish-sheet-action-error">
            {error}
          </Text>
        ) : null}

        {published ? (
          <Button
            title={`View on ${label}`}
            icon="open-outline"
            fullWidth
            onPress={() => void Linking.openURL(status!.url!)}
            testID="publish-sheet-view"
          />
        ) : direct ? (
          <Button
            title={s === "failed" ? "Retry" : "Confirm and publish"}
            icon={s === "failed" ? "refresh" : "paper-plane"}
            fullWidth
            loading={busy === "publish" || s === "publishing"}
            disabled={busy !== null || s === "publishing"}
            onPress={onPublish}
            testID={s === "failed" ? "publish-sheet-retry" : "publish-sheet-confirm"}
          />
        ) : (
          <Button
            title={fallbackLabel}
            icon="open-outline"
            fullWidth
            loading={busy === "fallback"}
            disabled={busy !== null}
            onPress={onFallback}
            testID="publish-sheet-fallback"
          />
        )}

        {!direct && s === "awaiting_user_action" && !status?.userReportedPostedAt ? (
          <Button
            title="I posted it"
            variant="secondary"
            icon="checkmark"
            fullWidth
            loading={busy === "confirm"}
            disabled={busy !== null}
            onPress={() => run("confirm", () => confirmPosted({ ownerId, draftId }))}
            testID="publish-sheet-confirm-posted"
          />
        ) : null}

        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Button
            title={copied ? "Copied" : "Copy"}
            variant="secondary"
            icon={copied ? "checkmark" : "copy-outline"}
            onPress={onCopy}
            style={{ flex: 1 }}
            testID="publish-sheet-copy"
          />
          <Button title="Close" variant="ghost" onPress={onClose} style={{ flex: 1 }} testID="publish-sheet-close" />
        </View>
      </View>
    </Modal>
  );
}
