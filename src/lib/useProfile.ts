import { api } from "../../convex/_generated/api";
import { useOwnedQuery } from "../identity/OwnerProvider";
import { palette } from "../theme";

/** Interests offered at onboarding and on Profile, each with its pastel. */
export const INTERESTS: { key: string; label: string; color: string }[] = [
  { key: "scholarships", label: "Scholarships", color: palette.butter },
  { key: "code", label: "Code", color: palette.lavender },
  { key: "food", label: "Food", color: palette.peach },
  { key: "design", label: "Design", color: palette.mint },
  { key: "events", label: "Events", color: palette.lime },
  { key: "jobs", label: "Jobs", color: palette.butter },
];

export const interestColor = (interest?: string) => INTERESTS.find((i) => i.key === interest?.toLowerCase() || i.label.toLowerCase() === interest?.toLowerCase())?.color ?? palette.mint;

/** The owner's personalization: displayName, interests, and whether onboarding ever ran. undefined while loading. */
export function useProfile() {
  const profile = useOwnedQuery(api.preferences.get, {});
  if (profile === undefined) return undefined;
  const displayName = profile.name?.trim() || undefined;
  const interests = profile.interests ?? [];
  return { profile, displayName, interests, topInterest: interests[0], onboarded: profile.updatedAt !== undefined };
}
