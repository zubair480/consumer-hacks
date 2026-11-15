import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { X_CALLBACK_PATH } from "./imports/xClient";
import { GOOGLE_CALLBACK_PATH } from "./imports/youtubeClient";
import { save } from "./share";
import { GCAL_CALLBACK_PATH, safeReturnUrl } from "./agents/composio";

const http = httpRouter();

function page(message: string, status: number) {
  const body = `<!doctype html><meta name="viewport" content="width=device-width"><body style="font-family:-apple-system,sans-serif;background:#0B0B10;color:#F5F5FA;padding:32px"><h2>Zapy</h2><p>${message}</p></body>`;
  return new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

/** X OAuth 2.0 redirect URI. Finishes the token exchange, then deep-links back into the app. */
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
    return new Response(null, { status: 302, headers: { Location: back.toString() } });
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
    return new Response(null, { status: 302, headers: { Location: back.toString() } });
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

export default http;
