/// <reference types="vitest" />
import { describe, expect, it } from "vitest";
import { ADAPTERS } from "./adapters";
import { systemPrompt } from "./composer";
import { capHashtagList, maxHashtags, sanitizeDraftText } from "./sanitize";

describe("sanitizeDraftText strips emoji", () => {
  it("removes pictographs, variation selectors, ZWJ sequences, keycaps, flags and skin tones", () => {
    const text = "Found this place \u{1F35C}\uFE0F and want to try it \u{1F468}\u200D\u{1F373}\u{1F3FD}.\nTop 3\uFE0F\u20E3 picks \u{1F1EF}\u{1F1F5}";
    expect(sanitizeDraftText(text, "instagram")).toBe("Found this place and want to try it.\nTop 3 picks");
  });

  it("keeps plain text, numbers and # inside URLs untouched", () => {
    const text = "Deadline: May 1. See https://example.com/page#section for details.";
    expect(sanitizeDraftText(text, "x")).toBe(text);
  });
});

describe("sanitizeDraftText caps hashtags per platform", () => {
  it("allows none on LinkedIn, X and Threads", () => {
    expect(maxHashtags("linkedin")).toBe(0);
    expect(maxHashtags("x")).toBe(0);
    expect(maxHashtags("threads")).toBe(0);
    expect(sanitizeDraftText("Great repo #opensource #typescript", "x")).toBe("Great repo");
    expect(sanitizeDraftText("Worth a read.\n\nWhat do you think?\n\n#AI #Careers", "linkedin")).toBe("Worth a read.\n\nWhat do you think?");
  });

  it("keeps the first 3 on Instagram and TikTok and removes the rest cleanly", () => {
    expect(sanitizeDraftText("Saved this spot.\n\n#food #ramen #nyc #eats #foodie", "instagram")).toBe("Saved this spot.\n\n#food #ramen #nyc");
    expect(sanitizeDraftText("Hook \u2728  line\n\n\n\nBody \u{1F525}\n\n#a #b #c #d\n\n\u{1F680}", "tiktok")).toBe("Hook line\n\nBody\n\n#a #b #c");
  });

  it("caps structured hashtag lists the same way", () => {
    expect(capHashtagList(["#one", "#two", "#three", "#four"], "instagram")).toEqual(["#one", "#two", "#three"]);
    expect(capHashtagList(["#one", "#two"], "linkedin")).toEqual([]);
  });
});

describe("prompt carries the format rules", () => {
  it("tells every platform no emoji, the hashtag limits and the saved-it first person rule", () => {
    for (const adapter of Object.values(ADAPTERS)) {
      const prompt = systemPrompt(adapter.instructions, "generated");
      expect(prompt).toContain("No emoji.");
      expect(prompt).toContain("Hashtags: none for LinkedIn, X and Threads. At most 3 relevant ones for Instagram and TikTok.");
      expect(prompt).toContain("first person only about what the user actually did, which is that they saved it");
    }
  });
});
