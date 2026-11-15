import { oauthHeader, oauthSignature, percentEncode, xAdapter } from "../convex/publishing/x";

// Run: npx tsx tests/x-oauth.test.ts

const DOC = {
  method: "POST",
  url: "https://api.twitter.com/1.1/statuses/update.json",
  consumerKey: "xvz1evFS4wEEPTGEFPHBog",
  consumerSecret: "kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw",
  token: "370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb",
  tokenSecret: "LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE",
  nonce: "kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg",
  timestamp: "1318622958",
};

function fail(message: string): never {
  throw new Error(message);
}
const assert = {
  ok: (cond: unknown, message = "expected truthy") => void (cond || fail(message)),
  equal: (a: unknown, b: unknown) => void (a === b || fail(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`)),
  deepEqual: (a: unknown, b: unknown) =>
    void (JSON.stringify(a) === JSON.stringify(b) || fail(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`)),
  match: (s: string, re: RegExp) => void (re.test(s) || fail(`${s} does not match ${re}`)),
};

const tests: [string, () => Promise<void> | void][] = [];
const test = (name: string, fn: () => Promise<void> | void) => tests.push([name, fn]);

async function hmacBase64(key: string, base: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  return btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(base)))));
}

test("X 'Creating a signature' doc example", async () => {
  const { signature } = await oauthSignature({
    ...DOC,
    params: { include_entities: "true", status: "Hello Ladies + Gentlemen, a signed OAuth request!" },
  });
  assert.equal(signature, "hCtSmYh+iHYCEqBWrE7C7hYmtUk=");
});

test("RFC 3986 percent-encoding", () => {
  assert.equal(percentEncode("Hello Ladies + Gentlemen, a signed OAuth request!"), "Hello%20Ladies%20%2B%20Gentlemen%2C%20a%20signed%20OAuth%20request%21");
  assert.equal(percentEncode("*'()~-._"), "%2A%27%28%29~-._");
  assert.equal(percentEncode("☃"), "%E2%98%83");
});

test("POST /2/tweets: signature covers only the oauth_* params, not the JSON body", async () => {
  const input = { ...DOC, url: "https://api.x.com/2/tweets" };
  const { signature, oauthParams } = await oauthSignature(input);
  const paramString = Object.keys(oauthParams)
    .sort()
    .map((k) => `${k}=${percentEncode(oauthParams[k])}`)
    .join("&");
  const base = `POST&${percentEncode("https://api.x.com/2/tweets")}&${percentEncode(paramString)}`;
  assert.equal(signature, await hmacBase64(`${percentEncode(DOC.consumerSecret)}&${percentEncode(DOC.tokenSecret)}`, base));
  assert.ok(!base.includes("text"), "JSON body must not be in the base string");
  const header = await oauthHeader(input);
  assert.match(header, /^OAuth oauth_consumer_key="xvz1evFS4wEEPTGEFPHBog", /);
  assert.ok(header.includes(`oauth_signature="${percentEncode(signature)}"`));
  assert.ok(header.includes('oauth_signature_method="HMAC-SHA1"') && header.includes('oauth_version="1.0"'));
});

type Call = { url: string; init: RequestInit };
function mockFetch(responses: [number, unknown][]) {
  const calls: Call[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const [status, body] = responses.shift()!;
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
  return calls;
}
function withCreds() {
  process.env.X_API_KEY = "ck";
  process.env.X_API_SECRET = "cs";
  process.env.X_ACCESS_TOKEN = "t";
  process.env.X_ACCESS_TOKEN_SECRET = "ts";
}
function captureErrors() {
  const logged: unknown[][] = [];
  console.error = (...args: unknown[]) => void logged.push(args);
  return logged;
}

test("201 + data.id -> published with https://x.com/i/status/{id}", async () => {
  withCreds();
  const calls = mockFetch([[201, { data: { id: "1857", text: "hi" } }]]);
  const res = await xAdapter.publish("hi", {});
  assert.deepEqual(res, { status: "published", externalPostId: "1857", url: "https://x.com/i/status/1857", externalPostIds: ["1857"] });
  assert.equal(calls[0].url, "https://api.x.com/2/tweets");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(JSON.parse(String(calls[0].init.body)).text, "hi");
  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers["Content-Type"], "application/json");
  assert.match(headers.Authorization, /^OAuth .*oauth_nonce="[0-9a-f]{32}"/);
});

test("200 without data.id is not published", async () => {
  withCreds();
  mockFetch([[200, { data: { id: "1" } }]]);
  captureErrors();
  assert.equal((await xAdapter.publish("hi", {})).status, "failed");
});

for (const [status, body, message] of [
  [401, { title: "Unauthorized", type: "about:blank", status: 401, detail: "Unauthorized" }, "X rejected the credentials or the app lacks Read and Write permission"],
  [403, { title: "Forbidden", type: "about:blank", status: 403, detail: "You are not permitted to perform this action." }, "X rejected the credentials or the app lacks Read and Write permission"],
  [403, { title: "Forbidden", type: "about:blank", detail: "You are not allowed to create a Tweet with duplicate content." }, "X says this is a duplicate post"],
  [429, { title: "Too Many Requests", type: "about:blank", status: 429, detail: "Too Many Requests" }, "X rate limit, try again later"],
] as const) {
  test(`HTTP ${status} ${body.detail} -> mapped message, X detail logged server-side`, async () => {
    withCreds();
    mockFetch([[status, body]]);
    const logged = captureErrors();
    const res = await xAdapter.publish("hi", {});
    assert.deepEqual(res, { status: "failed", error: message });
    const entry = logged[0][1] as Record<string, unknown>;
    assert.equal(entry.status, status);
    assert.equal(entry.title, body.title);
    assert.equal(entry.detail, body.detail);
    assert.equal(entry.type, body.type);
    assert.ok(!message.includes("{"), "user message has no raw JSON");
  });
}

test("not configured -> intent fallback, no request", async () => {
  delete process.env.X_API_KEY;
  const calls = mockFetch([]);
  const res = await xAdapter.publish("hi there", {});
  assert.deepEqual(res, { status: "awaiting_user_action", openUrl: "https://x.com/intent/tweet?text=hi%20there" });
  assert.equal(calls.length, 0);
});

(async () => {
  const realError = console.error;
  let failed = 0;
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`PASS ${name}`);
    } catch (e) {
      failed++;
      console.log(`FAIL ${name}\n  ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      console.error = realError;
    }
  }
  console.log(failed ? `${failed} failed` : `all ${tests.length} passed`);
  process.exit(failed ? 1 : 0);
})();
