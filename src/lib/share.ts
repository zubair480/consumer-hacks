import * as Clipboard from "expo-clipboard";
import { Platform, Share } from "react-native";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useOwnedMutation } from "../identity/OwnerProvider";
import type { SocialDraftStatus } from "../shared/socialContracts";

// OWNER: Thread J (CONS-11). Copy + native share sheet only; no platform publishing APIs.

export type { SocialDraftStatus };

export const PUBLISH_STATUS_LABELS: Record<SocialDraftStatus, string> = {
  draft: "Draft",
  ready_to_share: "Ready to share",
  awaiting_user_action: "Awaiting user action",
  publishing: "Publishing",
  published: "Published",
  failed: "Failed",
};

/** Label for a publishing.statusForDraft view. "I posted it" stays user-reported, never "Published". */
export function publishStatusLabel(
  view: { status: SocialDraftStatus; userReportedPostedAt?: number | null } | null | undefined,
): string {
  if (!view) return PUBLISH_STATUS_LABELS.draft;
  if (view.userReportedPostedAt && view.status === "awaiting_user_action") return "Posted by you (not verified)";
  return PUBLISH_STATUS_LABELS[view.status];
}

export async function copyDraft(text: string): Promise<void> {
  await Clipboard.setStringAsync(text);
}

/** "shared": the user picked a share target. "dismissed": they closed the sheet. Neither means the post went live. */
export type ShareOutcome = { outcome: "shared"; activityType?: string } | { outcome: "dismissed" };

export type ShareDraftInput = { text: string; url?: string; imageUri?: string };

/**
 * Opens the native share sheet. iOS takes one url, so an image wins and a link is
 * appended to the text. onOpened runs before the sheet opens (startShare).
 */
export async function shareDraft(
  { text, url, imageUri }: ShareDraftInput,
  onOpened?: () => Promise<unknown>,
): Promise<ShareOutcome> {
  if (onOpened) await onOpened();
  const attachUrl = Platform.OS === "ios" ? (imageUri ?? url) : undefined;
  const linkInText = url && attachUrl !== url ? `${text}\n\n${url}` : text;
  const result = await Share.share(attachUrl ? { message: linkInText, url: attachUrl } : { message: linkInText });
  if (result.action === Share.dismissedAction) return { outcome: "dismissed" };
  return { outcome: "shared", activityType: result.activityType ?? undefined };
}

/** Hook wiring shareDraft to publishing.startShare and confirmUserPosted for one draft. */
export function useDraftSharing(draftId: Id<"socialDrafts"> | undefined) {
  const startShare = useOwnedMutation(api.publishing.startShare);
  const confirm = useOwnedMutation(api.publishing.confirmUserPosted);
  return {
    copy: copyDraft,
    share: (input: ShareDraftInput) => shareDraft(input, draftId ? () => startShare({ draftId }) : undefined),
    confirmPosted: () => (draftId ? confirm({ draftId }) : Promise.resolve(null)),
  };
}
