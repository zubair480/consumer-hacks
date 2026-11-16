"use node";
import Browserbase from "@browserbasehq/sdk";
import { browserbase, Stagehand } from "@browserbasehq/stagehand";
import { v } from "convex/values";
import { z } from "zod/v4";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import { HOLD_MS, assertSafeInstruction, isSensitiveLabel } from "./lib/formGuard";
import { isDemoFormUrl } from "./lib/demo";
import { callLLMJson, getLLMModel } from "./lib/llm";

type Field = { label: string; kind: string; value?: string; state: "filled" | "skipped" | "failed"; note?: string };

const DEMO_FIELDS = [
  { name: "name", label: "Full name" },
  { name: "email", label: "Email" },
  { name: "phone", label: "Phone number" },
  { name: "studying", label: "What are you studying?" },
];
const ACTION_BUDGET_MS = 9.5 * 60 * 1000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const run = internalAction({
  args: { runId: v.id("formFillRuns"), holdMs: v.optional(v.number()), pollMs: v.optional(v.number()) },
  handler: async (ctx, { runId, holdMs = HOLD_MS, pollMs = 3000 }) => {
    const startedAt = Date.now();
    const set = (a: Record<string, unknown>) => ctx.runMutation(internal.formFill.setState, { runId, ...a } as never);
    const context = await ctx.runQuery(internal.formFill.loadContext, { runId });
    if (!context || context.status !== "queued") return null;
    const apiKey = process.env.BROWSERBASE_API_KEY;
    const projectId = process.env.BROWSERBASE_PROJECT_ID;
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || !projectId || !openaiKey) {
      await set({ status: "failed", message: "Browser agent is not configured" });
      return null;
    }
    await set({ status: "filling", onlyFrom: ["queued"] });

    let browser: Awaited<ReturnType<typeof browserbase.launch>> | undefined;
    let stagehand: Stagehand | undefined;
    const screenshotIds: Id<"_storage">[] = [];
    try {
      try {
        browser = await browserbase.launch({ apiKey, projectId, browserSettings: { solveCaptchas: false } });
        stagehand = await Stagehand.create({ browser, model: { modelName: `openai/${getLLMModel()}`, apiKey: openaiKey } });
      } catch (e) {
        if (!isDemoFormUrl(context.url)) throw e;
        const names = DEMO_FIELDS.map((f) => f.label);
        const drafted = await callLLMJson<{ values: Record<string, string | null> }>({
          system: "You fill a short application form for the user. Use ONLY the profile facts; return null when a fact is missing, never invent one.",
          user: JSON.stringify({ profile: context.profile, fields: names }),
          schemaHint: '{"values": {"<field label>": "text or null"}}',
        });
        const fields: Field[] = DEMO_FIELDS.map((f) => {
          const value = drafted.values?.[f.label];
          return value ? { label: f.label, kind: "text", value, state: "filled" as const } : { label: f.label, kind: "text", state: "skipped" as const, note: "Needs you" };
        });
        const deadline = Math.min(Date.now() + holdMs, startedAt + ACTION_BUDGET_MS);
        await set({
          status: "needs_approval",
          fields,
          expiresAt: deadline,
          message: "Browser agent unavailable, so these values are prepared without a browser. Approving sends them straight to our demo form.",
          onlyFrom: ["filling"],
        });
        while (Date.now() < deadline) {
          await sleep(pollMs);
          const status = await ctx.runQuery(internal.formFill.getStatus, { runId });
          if (status === "cancelled") return null;
          if (status !== "approved") continue;
          const body = new URLSearchParams(Object.fromEntries(DEMO_FIELDS.map((f, i) => [f.name, fields[i].value ?? ""])));
          const res = await fetch(context.url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
          await set(res.ok ? { status: "submitted", message: "Sent to the demo form (no browser)", onlyFrom: ["approved"] } : { status: "failed", message: `Demo form said ${res.status}`, onlyFrom: ["approved"] });
          return null;
        }
        await set({ status: "expired", message: "The session timed out", onlyFrom: ["needs_approval"] });
        return null;
      }
      const [page] = await browser.context.pages();
      let liveViewUrl: string | undefined;
      try {
        liveViewUrl = (await new Browserbase({ apiKey }).sessions.debug(browser.sessionId!)).debuggerFullscreenUrl;
      } catch {}
      if (liveViewUrl) await set({ status: "filling", liveViewUrl, onlyFrom: ["filling"] });

      const shoot = async () => {
        screenshotIds.push(await ctx.storage.store(new Blob([new Uint8Array(await page.screenshot())], { type: "image/png" })));
      };

      await page.goto(context.url);
      const wall = (await stagehand.extract(
        "Is this page blocked by a login wall, a CAPTCHA or human check, or a paywall, so that no form can be filled without signing in or paying? Answer blocked=false if a form is visible.",
        z.object({ blocked: z.boolean(), reason: z.string() }),
      )) as unknown as { data: { blocked: boolean; reason: string } };
      if (wall.data.blocked) {
        await shoot();
        await set({ status: "blocked", screenshotIds, message: wall.data.reason || "This page needs a login, CAPTCHA or payment" });
        return null;
      }

      const extracted = (await stagehand.extract(
        "List every visible input of the application form (not buttons), in page order.",
        z.object({
          fields: z.array(z.object({ label: z.string(), kind: z.enum(["text", "email", "textarea", "select", "checkbox", "radio", "file", "other"]) })),
        }),
      )) as unknown as { data: { fields: { label: string; kind: string }[] } };
      const found = extracted.data.fields.slice(0, 20);
      if (found.length === 0) {
        await set({ status: "blocked", screenshotIds, message: "No form fields found on this page" });
        return null;
      }

      const fillable = found.filter((f) => !["file", "other", "checkbox", "radio"].includes(f.kind) && !isSensitiveLabel(f.label));
      const drafted = await callLLMJson<{ values: Record<string, string | null> }>({
        system:
          "You fill a web application form for the user. Use ONLY the profile facts for factual fields (name, email, phone, what they are studying, school, GPA); return null when a fact is missing, never invent one. For essay or long-answer fields write a short honest draft (max 120 words) grounded in the profile and the page summary. Never output passwords or ID numbers.",
        user: JSON.stringify({ form: context.title, summary: context.summary, profile: context.profile, fields: fillable.map((f) => ({ label: f.label, kind: f.kind })) }),
        schemaHint: '{"values": {"<field label>": "text to enter or null"}}',
      });

      await shoot();
      const fields: Field[] = [];
      for (const f of found) {
        const value = drafted.values?.[f.label];
        if (!fillable.includes(f) || !value) {
          fields.push({ label: f.label, kind: f.kind, state: "skipped", note: isSensitiveLabel(f.label) ? "Sensitive: fill it yourself" : "Needs you" });
          continue;
        }
        const instruction = f.kind === "select" ? `Select %value% in the "${f.label}" field` : `Type %value% into the "${f.label}" field`;
        try {
          assertSafeInstruction(instruction);
          await stagehand.act(instruction, { variables: { value } });
          fields.push({ label: f.label, kind: f.kind, value, state: "filled" });
        } catch (e) {
          fields.push({ label: f.label, kind: f.kind, value, state: "failed", note: e instanceof Error ? e.message.slice(0, 120) : "Could not fill" });
        }
      }
      await shoot();

      const approvalAt = Date.now();
      const deadline = Math.min(approvalAt + holdMs, startedAt + ACTION_BUDGET_MS);
      await set({ status: "needs_approval", fields, screenshotIds, expiresAt: deadline, onlyFrom: ["filling"] });

      while (Date.now() < deadline) {
        await sleep(pollMs);
        const status = await ctx.runQuery(internal.formFill.getStatus, { runId });
        if (status === "cancelled") return null;
        if (status === "approved" && isDemoFormUrl(context.url)) {
          await stagehand.act("Click the Submit application button");
          await sleep(2500);
          await shoot();
          await set({ status: "submitted", screenshotIds, message: "Submitted", onlyFrom: ["approved"] });
          return null;
        }
      }
      await set({ status: "expired", message: "The session timed out", onlyFrom: ["needs_approval"] });
      return null;
    } catch (e) {
      await set({ status: "failed", screenshotIds, message: e instanceof Error ? e.message.slice(0, 200) : "Fill failed" });
      return null;
    } finally {
      await stagehand?.close().catch(() => {});
      await browser?.close().catch(() => {});
    }
  },
});
