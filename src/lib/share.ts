import * as Clipboard from "expo-clipboard";
import { Platform, Share } from "react-native";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useOwnedMutation } from "../identity/OwnerProvider";
import { SOCIAL_PLATFORM_LABELS, type SocialDraftStatus, type SocialPlatform } from "../shared/socialContracts";

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
  const startShare = useOwnedMutation(api.publishing.jobs.startShare);
  const confirm = useOwnedMutation(api.publishing.jobs.confirmUserPosted);
  return {
    copy: copyDraft,
    share: (input: ShareDraftInput) => shareDraft(input, draftId ? () => startShare({ draftId }) : undefined),
    confirmPosted: () => (draftId ? confirm({ draftId }) : Promise.resolve(null)),
  };
}

export type AccountPlatform = SocialPlatform | "youtube";

export const ACCOUNT_LABELS: Record<AccountPlatform, string> = { ...SOCIAL_PLATFORM_LABELS, youtube: "YouTube" };

/**
 * How a platform is shared when it can't post directly.
 * intent_url: open the platform's composer link. share_file: copy the caption and open the share sheet with the image.
 */
export type FallbackKind = "intent_url" | "share_file";

/** Composer link for intent_url platforms, or null when it can't be built (LinkedIn needs a source URL). */
export function fallbackUrl(platform: AccountPlatform, text: string, sourceUrl?: string): string | null {
  switch (platform) {
    case "x":
      return "https://x.com/intent/tweet?text=" + encodeURIComponent(text);
    case "linkedin":
      return sourceUrl ? "https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(sourceUrl) : null;
    case "threads":
      return "https://www.threads.net/intent/post?text=" + encodeURIComponent(text);
    default:
      return null;
  }
}

export const DEFAULT_FALLBACK: Record<AccountPlatform, FallbackKind> = {
  x: "intent_url",
  linkedin: "intent_url",
  threads: "intent_url",
  instagram: "share_file",
  tiktok: "share_file",
  youtube: "share_file",
};
