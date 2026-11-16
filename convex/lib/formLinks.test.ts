/// <reference types="vitest" />
import { describe, expect, it } from "vitest";
import { canFill } from "../formFill";
import { extractUrls, isFormLike, isSocialPostUrl, pickFormLink, xStatusId } from "./formLinks";

describe("pickFormLink", () => {
  it("finds the form in an X post's text", () => {
    const text = "Post by @HuebitsT62075 on X\n\nApplications open! Apply here: https://forms.gle/8AfbBc4msaECqWRz8. Deadline Friday https://x.com/HuebitsT62075/status/2121118714745716905";
    expect(pickFormLink([text])).toBe("https://forms.gle/8AfbBc4msaECqWRz8");
  });
  it("recognizes the supported form hosts and paths", () => {
    for (const url of [
      "https://docs.google.com/forms/d/e/abc/viewform",
      "https://acme.typeform.com/to/xyz",
      "https://form.jotform.com/123",
      "https://tally.so/r/abc",
      "https://example.org/apply",
      "https://example.org/events/register?ref=x",
      "https://example.org/signup",
      "https://example.org/my-webform",
    ]) expect(isFormLike(url)).toBe(true);
    for (const url of ["https://x.com/a/status/1", "https://docs.google.com/document/d/1", "https://example.org/blog/applying-tips", "https://t.co/abc"]) expect(isFormLike(url)).toBe(false);
  });
  it("skips non-form links and returns null when there is none", () => {
    expect(pickFormLink(["see https://example.com/about and https://t.co/abc"])).toBeNull();
    expect(pickFormLink(["first https://example.com/news then (https://tally.so/r/q1)"])).toBe("https://tally.so/r/q1");
  });
  it("extracts URLs without trailing punctuation", () => {
    expect(extractUrls(["Go: https://forms.gle/abc. Or https://x.com/a/status/1!"])).toEqual(["https://forms.gle/abc", "https://x.com/a/status/1"]);
  });
  it("reads X status ids", () => {
    expect(xStatusId("https://x.com/HuebitsT62075/status/2121118714745716905")).toBe("2121118714745716905");
    expect(xStatusId("https://twitter.com/a/status/42?s=20")).toBe("42");
    expect(xStatusId("https://forms.gle/abc")).toBeNull();
    expect(isSocialPostUrl("https://x.com/a/status/1")).toBe(true);
    expect(isSocialPostUrl("https://forms.gle/abc")).toBe(false);
  });
});

describe("canFill", () => {
  it("accepts applications, posts with a form link, and X posts; rejects others", () => {
    expect(canFill({ contentTypes: ["scholarship"] })).toBe(true);
    expect(canFill({ contentTypes: ["event"], rawText: "Register: https://forms.gle/abc" })).toBe(true);
    expect(canFill({ contentTypes: [], sourceUrl: "https://x.com/HuebitsT62075/status/2121118714745716905" })).toBe(true);
    expect(canFill({ contentTypes: ["recipe"], sourceUrl: "https://example.com/pasta", rawText: "Great pasta" })).toBe(false);
  });
});
