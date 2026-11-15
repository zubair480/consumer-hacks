import { useAction } from "convex/react";
import { useState } from "react";
import { Linking, Modal, Pressable, View } from "react-native";
import { api } from "../../../convex/_generated/api";
import type { PublishResult } from "../../../convex/publishing/types";
import { useOwnerId } from "../../identity/OwnerProvider";
import { ACCOUNT_LABELS } from "../../lib/share";
import { colors, radius, spacing } from "../../theme";
import { Button, Text } from "../ui";

// OWNER: Thread A (CONS-4). Confirm sheet for Profile → Connected accounts → "Send test post".

export type TestPostPlatform = "x" | "linkedin";

export function localTimeNow(d = new Date()): string {
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, "0")).join(":");
}

type Props = { platform: TestPostPlatform; localTime: string; onClose: () => void };

export function TestPostSheet({ platform, localTime, onClose }: Props) {
  const ownerId = useOwnerId();
  const sendTestPost = useAction(api.publishing.testPost.sendTestPost);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<PublishResult | null>(null);
  const label = ACCOUNT_LABELS[platform];
  const text = `Testing Zapy ${localTime}`;

  async function confirm() {
    if (!ownerId || sending) return;
    setSending(true);
    try {
      setResult(await sendTestPost({ ownerId, platform, localTime }));
    } catch {
      setResult({ status: "failed", error: "Could not send the test post. Try again." });
    } finally {
      setSending(false);
    }
  }

  const posted = result?.status === "published" && result.externalPostId ? result : null;
  const error = result && !posted ? (result.status === "failed" ? result.error : "The platform did not return a post id.") : null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={onClose} testID="test-post-backdrop" />
      <View
        testID="test-post-sheet"
        style={{
          backgroundColor: colors.surface,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          padding: spacing.xl,
          paddingBottom: spacing.xxxl,
          gap: spacing.md,
        }}
      >
        <Text variant="heading">Send test post to {label}</Text>
        <View style={{ backgroundColor: colors.surfaceRaised, borderRadius: radius.md, padding: spacing.lg }}>
          <Text testID="test-post-text" selectable>
            {text}
          </Text>
        </View>
        <Text variant="caption" tone="warning" testID="test-post-notice">
          Posts publicly to your {label} account
        </Text>

        {posted ? (
          <View testID="test-post-success" style={{ gap: spacing.sm }}>
            <Text variant="bodyStrong" color={colors.success}>
              Posted to {label}
            </Text>
            <Text variant="caption" tone="muted" testID="test-post-id" selectable>
              Post id: {posted.externalPostId}
            </Text>
            <Button title="View post" icon="open-outline" variant="secondary" testID="test-post-view" onPress={() => Linking.openURL(posted.url)} />
            <Button title="Done" variant="ghost" testID="test-post-done" onPress={onClose} />
          </View>
        ) : (
          <>
            {error ? (
              <Text variant="caption" color={colors.danger} testID="test-post-error">
                {error}
              </Text>
            ) : null}
            <Button
              title={error ? "Try again" : "Confirm"}
              testID="test-post-confirm"
              loading={sending}
              disabled={!ownerId}
              onPress={confirm}
            />
            <Button title="Cancel" variant="ghost" testID="test-post-cancel" disabled={sending} onPress={onClose} />
          </>
        )}
      </View>
    </Modal>
  );
}
