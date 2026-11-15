/// <reference types="vitest" />
import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import { ADAPTERS } from "./adapters";
import { itemBrief, mediaBrief, SHARED_RULES, systemPrompt } from "./composer";

const photo = {
  _id: "m1" as Id<"mediaAssets">,
  _creationTime: 0,
  userId: "u1" as Id<"users">,
  storageId: "s1" as Id<"_storage">,
  kind: "photo",
  analysis: { summary: "A tall waterfall in a green forest", subjects: ["waterfall", "forest"], setting: "outdoors", mood: "calm" },
  createdAt: 0,
} as unknown as Doc<"mediaAssets">;

const item = (primaryType: string) =>
  ({ _id: "i1", sourceUrl: "https://example.com", primaryType, title: "T" }) as unknown as Doc<"savedItems">;

describe("photo briefs never assume the user took the photo", () => {
  const brief = mediaBrief(photo);

  it("states the photo is saved, not necessarily theirs", () => {
    expect(brief.relationship).toMatch(/not necessarily theirs/);
    expect(brief.relationship).toMatch(/Never claim or imply they took, captured, shot, filmed or made it, or were present/);
    expect(brief.relationship).toMatch(/Found this shot/);
    expect(brief.relationship).toMatch(/only when brief\.userContext explicitly says so/);
  });

  it("no longer tells the model the user captured it", () => {
    expect(brief.relationship).not.toMatch(/captured this \w+ themselves/);
    expect(brief.title).toBe("A tall waterfall in a green forest");
    expect(mediaBrief({ ...photo, analysis: undefined }).title).toBe("Saved photo");
  });

  it("carries the rule in every platform's system prompt", () => {
    for (const adapter of Object.values(ADAPTERS)) {
      const prompt = systemPrompt(adapter.instructions, "generated");
      expect(prompt).toContain("does not mean they took it, made it or were there");
      expect(prompt).toContain("unless brief.userContext explicitly says so");
    }
    expect(SHARED_RULES).toMatch(/Respect brief\.relationship exactly/);
  });

  it("keeps TikTok's first person as a finder, not a creator", () => {
    expect(ADAPTERS.tiktok.instructions).toMatch(/as someone who found or saved this, not as its creator/);
  });
});

describe("saved-item relationships are unchanged", () => {
  it("restaurant: wants to try, has not eaten there", () => {
    const r = itemBrief(item("restaurant"), null).relationship;
    expect(r).toMatch(/wants to try it/);
    expect(r).toMatch(/have NOT eaten there/);
  });

  it("repository: bookmarked, did not build it", () => {
    const r = itemBrief(item("github_repository"), null).relationship;
    expect(r).toMatch(/found and bookmarked this repository/);
    expect(r).toMatch(/never say 'I built'/);
  });

  it("unknown types fall back to the no-experience default", () => {
    expect(itemBrief(item("general_content"), null).relationship).toMatch(/Do not claim they used, attended, bought, built or experienced it/);
  });
});
