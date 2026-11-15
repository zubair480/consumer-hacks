import { escapeLittleText, linkedinAdapter } from "../../convex/publishing/linkedin";

const assert = {
  ok(value: unknown, message = "expected truthy") {
    if (!value) throw new Error(message);
  },
  equal(actual: unknown, expected: unknown, message = "") {
    if (actual !== expected) throw new Error(`${message} expected ${String(expected)}, got ${String(actual)}`);
  },
  deepEqual(actual: unknown, expected: unknown, message = "") {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) throw new Error(`${message}\n  expected ${e}\n  got      ${a}`);
  },
};

type Call = { url: string; method?: string; headers: Record<string, string>; body?: unknown };

const calls: Call[] = [];
let queue: Array<() => Response> = [];
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  calls.push({
    url: String(input),
    method: init?.method,
    headers: (init?.headers ?? {}) as Record<string, string>,
    body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
  });
  const next = queue.shift();
  if (!next) throw new Error("unexpected fetch " + String(input));
  return next();
}) as typeof fetch;

const errors: unknown[][] = [];
console.error = (...args: unknown[]) => {
  errors.push(args);
};

const reset = (...responses: Array<() => Response>) => {
  calls.length = 0;
  errors.length = 0;
  queue = responses;
};
const created = (id: string) => () => new Response(null, { status: 201, headers: { "x-restli-id": id } });
const status = (code: number, body: string) => () => new Response(body, { status: code });

const tests: Array<[string, () => Promise<void>]> = [];
const test = (name: string, fn: () => Promise<void>) => tests.push([name, fn]);

const expectedBody = (author: string, commentary: string) => ({
  author,
  commentary,
  visibility: "PUBLIC",
  distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
  lifecycleState: "PUBLISHED",
  isReshareDisabledByAuthor: false,
});

test("without a token it falls back to share-offsite and is not configured", async () => {
  delete process.env.LINKEDIN_ACCESS_TOKEN;
  delete process.env.LINKEDIN_PERSON_URN;
  reset();
  assert.equal(linkedinAdapter.isConfigured(), false);
  const res = await linkedinAdapter.publish("hi", { sourceUrl: "https://github.com/pmndrs/zustand" });
  assert.deepEqual(res, {
    status: "awaiting_user_action",
    openUrl: "https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fgithub.com%2Fpmndrs%2Fzustand",
  });
  assert.equal(calls.length, 0);
});

test("escapes every little-format reserved character", async () => {
  assert.equal(escapeLittleText("a(b)c[d]e{f}g<h>i@j|k~l_m*n#o\\p"), "a\\(b\\)c\\[d\\]e\\{f\\}g\\<h\\>i\\@j\\|k\\~l\\_m\\*n\\#o\\\\p");
  assert.equal(escapeLittleText("plain text, no specials."), "plain text, no specials.");
});

test("uses LINKEDIN_PERSON_URN without calling userinfo", async () => {
  process.env.LINKEDIN_ACCESS_TOKEN = "test-token";
  process.env.LINKEDIN_PERSON_URN = "urn:li:person:fromenv";
  reset(created("urn:li:share:1"));
  await linkedinAdapter.publish("hi", {});
  assert.equal(calls.length, 1);
  assert.equal((calls[0].body as { author: string }).author, "urn:li:person:fromenv");
  delete process.env.LINKEDIN_PERSON_URN;
});

test("posts to /rest/posts with the spec headers and body, author from userinfo", async () => {
  assert.equal(linkedinAdapter.isConfigured(), true);
  reset(() => Response.json({ sub: "abc123" }), created("urn:li:share:7000"));
  const res = await linkedinAdapter.publish("Saved (via Zapy) #tools @me", {});

  assert.equal(calls[0].url, "https://api.linkedin.com/v2/userinfo");
  assert.equal(calls[0].headers.Authorization, "Bearer test-token");

  const post = calls[1];
  assert.equal(post.url, "https://api.linkedin.com/rest/posts");
  assert.equal(post.method, "POST");
  assert.deepEqual(post.headers, {
    Authorization: "Bearer test-token",
    "X-Restli-Protocol-Version": "2.0.0",
    "Linkedin-Version": "202610",
    "Content-Type": "application/json",
  });
  assert.deepEqual(post.body, expectedBody("urn:li:person:abc123", "Saved \\(via Zapy\\) \\#tools \\@me"));

  assert.deepEqual(res, {
    status: "published",
    externalPostId: "urn:li:share:7000",
    externalPostIds: ["urn:li:share:7000"],
    url: "https://www.linkedin.com/feed/update/urn:li:share:7000/",
  });
});

test("caches the person URN", async () => {
  reset(created("urn:li:share:2"));
  await linkedinAdapter.publish("again", {});
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.linkedin.com/rest/posts");
  assert.equal((calls[0].body as { author: string }).author, "urn:li:person:abc123");
});

test("success only on 201 with x-restli-id", async () => {
  reset(status(200, "{}"));
  assert.equal((await linkedinAdapter.publish("x", {})).status, "failed");
  reset(() => new Response(null, { status: 201 }));
  assert.deepEqual(await linkedinAdapter.publish("x", {}), { status: "failed", error: "LinkedIn did not return a post id" });
});

test("falls back to /v2/ugcPosts on a version error", async () => {
  const versionError = '{"status":426,"code":"NONEXISTENT_VERSION","message":"Requested version 20261000 is not active"}';
  reset(status(426, versionError), created("urn:li:ugcPost:55"));
  const res = await linkedinAdapter.publish("a_b (c)", {});
  const legacy = calls[1];
  assert.equal(legacy.url, "https://api.linkedin.com/v2/ugcPosts");
  assert.equal(legacy.method, "POST");
  assert.equal(legacy.headers["X-Restli-Protocol-Version"], "2.0.0");
  assert.equal(legacy.headers.Authorization, "Bearer test-token");
  assert.equal(legacy.headers["Linkedin-Version"], undefined);
  assert.deepEqual(legacy.body, {
    author: "urn:li:person:abc123",
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": { shareCommentary: { text: "a_b (c)" }, shareMediaCategory: "NONE" },
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
  });
  assert.deepEqual(res, {
    status: "published",
    externalPostId: "urn:li:ugcPost:55",
    externalPostIds: ["urn:li:ugcPost:55"],
    url: "https://www.linkedin.com/feed/update/urn:li:ugcPost:55/",
  });
  assert.ok(errors.some((e) => e.includes(versionError)), "version error body logged");
});

for (const [code, message] of [
  [401, "LinkedIn token expired or invalid, reconnect"],
  [403, "LinkedIn app is missing the Share on LinkedIn product"],
  [429, "LinkedIn rate limit (150 posts/day)"],
] as const) {
  test(`maps HTTP ${code} and logs the raw body server-side`, async () => {
    const raw = `{"status":${code},"message":"raw provider body"}`;
    reset(status(code, raw));
    const res = await linkedinAdapter.publish("x", {});
    assert.deepEqual(res, { status: "failed", error: message });
    assert.equal(calls.length, 1, "no ugcPosts retry");
    assert.ok(errors.some((e) => e.includes(raw)), "raw body logged");
    assert.ok(!JSON.stringify(res).includes("raw provider body"), "raw body not returned");
  });
}

void (async () => {
  let failed = 0;
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log("ok", name);
    } catch (err) {
      failed++;
      console.log("FAIL", name, err);
    }
  }
  console.log(failed ? `${failed} failed` : `all ${tests.length} passed`);
  process.exit(failed ? 1 : 0);
})();
