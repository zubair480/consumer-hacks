import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { X_CALLBACK_PATH } from "./imports/xClient";
import { GOOGLE_CALLBACK_PATH } from "./imports/youtubeClient";
import { save } from "./share";
import { GCAL_CALLBACK_PATH, safeReturnUrl } from "./agents/composio";
import { DEMO_FORM_PATH, SUMMIT_POST_PATH, applyFormHtml, parseSubmission, submissionsHtml, summitPostHtml, thanksHtml } from "./lib/demo";

const http = httpRouter();

function page(message: string, status: number) {
  const body = `<!doctype html><meta name="viewport" content="width=device-width"><body style="font-family:-apple-system,sans-serif;background:#0B0B10;color:#F5F5FA;padding:32px"><h2>Zapy</h2><p>${message}</p></body>`;
  return new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * Sends the browser back to the app. Android Custom Tabs often refuse a server 302 to a custom
 * scheme (exp://, zapy://), leaving a blank page, so this is a 200 page that navigates by script
 * and also shows a tappable "Return to Zapy" button (plus an Android intent:// fallback).
 */
function returnToApp(returnUrl: string, message: string) {
  const scheme = returnUrl.slice(0, returnUrl.indexOf(":"));
  const intentUrl = `intent:${returnUrl.slice(scheme.length + 1)}#Intent;scheme=${scheme};end`;
  const href = escapeHtml(returnUrl);
  const body = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Zapy</title><body style="font-family:-apple-system,Roboto,sans-serif;background:#0B0B10;color:#F5F5FA;padding:32px;text-align:center"><h2>Zapy</h2><p>${escapeHtml(message)}</p><a id="return" href="${href}" style="display:block;margin:32px auto 16px;max-width:360px;padding:20px;border-radius:999px;background:#F5F5FA;color:#0B0B10;font-size:20px;font-weight:700;text-decoration:none">Return to Zapy</a><a href="${escapeHtml(intentUrl)}" style="color:#9A9AB0;font-size:14px">Still here? Tap to open the app</a><script>window.location.replace(${JSON.stringify(returnUrl).replace(/</g, "\\u003c")});</script></body>`;
  return new Response(body, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

/** X OAuth 2.0 redirect URI. Finishes the token exchange, then sends the browser back into the app. */
http.route({
  path: X_CALLBACK_PATH,
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const params = new URL(req.url).searchParams;
    const state = params.get("state");
    if (!state) return page("This link is missing its sign-in state. Go back to Zapy and tap Connect again.", 400);
    const outcome = await ctx.runAction(internal.imports.connections.completeXConnect, {
      state,
      code: params.get("code") ?? undefined,
      error: params.get("error") ?? undefined,
    });
    if (!outcome) return page("This sign-in link expired or was already used. Go back to Zapy and tap Connect again.", 400);
    const back = new URL(outcome.returnUrl);
    back.searchParams.set("x", outcome.ok ? "connected" : "error");
    if (outcome.message) back.searchParams.set("message", outcome.message);
    return returnToApp(back.toString(), outcome.ok ? "X is connected." : (outcome.message ?? "Couldn't connect X."));
  }),
});

/** Google OAuth 2.0 redirect URI for YouTube import. Same shape as the X callback. */
http.route({
  path: GOOGLE_CALLBACK_PATH,
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const params = new URL(req.url).searchParams;
    const state = params.get("state");
    if (!state) return page("This link is missing its sign-in state. Go back to Zapy and tap Connect again.", 400);
    const outcome = await ctx.runAction(internal.imports.youtube.completeConnect, {
      state,
      code: params.get("code") ?? undefined,
      error: params.get("error") ?? undefined,
    });
    if (!outcome) return page("This sign-in link expired or was already used. Go back to Zapy and tap Connect again.", 400);
    const back = new URL(outcome.returnUrl);
    back.searchParams.set("youtube", outcome.ok ? "connected" : "error");
    if (outcome.message) back.searchParams.set("message", outcome.message);
    return returnToApp(back.toString(), outcome.ok ? "YouTube is connected." : (outcome.message ?? "Couldn't connect YouTube."));
  }),
});

/** Composio Google Calendar connect callback: 302s back to an allow-listed app deep link. */
http.route({
  path: GCAL_CALLBACK_PATH,
  method: "GET",
  handler: httpAction(async (_ctx, req) => {
    const params = new URL(req.url).searchParams;
    const back = safeReturnUrl(params.get("return"));
    if (!back) return page("This link is invalid. Go back to Zapy and tap Connect again.", 400);
    const url = new URL(back);
    url.searchParams.set("gcal", params.get("status") === "success" ? "connected" : "error");
    return new Response(null, { status: 302, headers: { Location: url.toString() } });
  }),
});

/** Share to Zapy: the iOS Shortcut posts links, text, and images here with a bearer share token. */
http.route({ path: "/save", method: "POST", handler: save });

const html = (body: string, status = 200) => new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });

/** Demo flow: the hosted application form the Browserbase agent fills. */
http.route({ path: DEMO_FORM_PATH, method: "GET", handler: httpAction(async (_ctx, req) => html(applyFormHtml(new URL(req.url).searchParams.get("program")))) });

/** Demo flow: the saved "post" for the calendar task. */
http.route({ path: SUMMIT_POST_PATH, method: "GET", handler: httpAction(async () => html(summitPostHtml())) });

http.route({
  path: DEMO_FORM_PATH,
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const submission = parseSubmission(new URLSearchParams(await req.text()));
    if (!submission) return html(applyFormHtml(), 400);
    const createdAt = await ctx.runMutation(internal.demo.recordSubmission, submission);
    return html(thanksHtml(submission.name, createdAt));
  }),
});

http.route({
  path: "/demo/submissions",
  method: "GET",
  handler: httpAction(async (ctx) => html(submissionsHtml(await ctx.runQuery(internal.demo.recentSubmissions, {})))),
});

export default http;
