import type { ContentType } from "../../src/shared/contracts";

// Demo flow (ZAPY DEMO FLOW SPEC, thread B). Pure helpers shared by convex/demo.ts,
// convex/http.ts, the form-fill agent and the calendar agent.

export const DEMO_EVENT_TEXT = "Zapy Demo Night · Sunday Nov 15, 7:00–9:00 PM · San Francisco. Come see Zapy turn saved posts into done tasks.";
export const DEMO_REPO_URL = "https://github.com/zubair480/zapy-hello-world";
export const DEMO_FORM_PATH = "/demo/apply";
export const DEMO_SITE_FALLBACK = "https://pleasant-lark-678.convex.site";

export const demoSiteUrl = () => process.env.CONVEX_SITE_URL || DEMO_SITE_FALLBACK;
export const demoFormUrl = (site = demoSiteUrl()) => `${site.replace(/\/$/, "")}${DEMO_FORM_PATH}`;

export type DemoSave = { key: "code" | "forms" | "events"; sourceUrl?: string; rawText?: string };
export const demoSaves = (site = demoSiteUrl()): DemoSave[] => [
  { key: "code", sourceUrl: DEMO_REPO_URL },
  { key: "forms", sourceUrl: demoFormUrl(site) },
  { key: "events", rawText: DEMO_EVENT_TEXT },
];

export type Box = "code" | "forms" | "events" | "jobs" | "learn" | "other";
export const emptyBoxes = (): Record<Box, number> => ({ code: 0, forms: 0, events: 0, jobs: 0, learn: 0, other: 0 });

export function boxFor(type: ContentType | undefined): Box {
  switch (type) {
    case "github_repository":
    case "code_snippet":
      return "code";
    case "application":
    case "scholarship":
      return "forms";
    case "event":
      return "events";
    case "job":
      return "jobs";
    case "tutorial":
    case "research":
      return "learn";
    default:
      return "other";
  }
}

export type AgentActionKind = "run_repo" | "fill_form" | "calendar";

/** The one big agent action an item leads with, or null when its top routed action leads instead. */
export function primaryAgentAction(type: ContentType | undefined): { kind: AgentActionKind; label: string } | null {
  if (type === "github_repository") return { kind: "run_repo", label: "Run it for me" };
  if (type === "application" || type === "scholarship") return { kind: "fill_form", label: "Fill it for me" };
  if (type === "event") return { kind: "calendar", label: "Add to my calendar" };
  return null;
}

/** True only for our own hosted demo form, the one page the agent may submit after approval. */
export function isDemoFormUrl(url: string, site = demoSiteUrl()): boolean {
  try {
    const target = new URL(url);
    const ours = new URL(site);
    return target.protocol === "https:" && target.host === ours.host && target.pathname.replace(/\/$/, "") === DEMO_FORM_PATH;
  } catch {
    return false;
  }
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n: number) => String(n).padStart(2, "0");

function findDate(text: string, year: number): string | null {
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const named = text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?/i);
  if (named) {
    const month = MONTHS.indexOf(named[1].slice(0, 3).toLowerCase()) + 1;
    const day = Number(named[2]);
    if (month > 0 && day >= 1 && day <= 31) return `${named[3] ?? year}-${pad(month)}-${pad(day)}`;
  }
  const us = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (us) return `${us[3]}-${pad(Number(us[1]))}-${pad(Number(us[2]))}`;
  return null;
}

const to24 = (h: number, ampm?: string) => {
  const p = ampm?.toLowerCase();
  if (p === "pm" && h < 12) return h + 12;
  if (p === "am" && h === 12) return 0;
  return h;
};

function findTime(text: string): { start: number; end?: number } | null {
  const range = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:[–—-]|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (range) {
    const endH = to24(Number(range[4]), range[6]);
    let startH = to24(Number(range[1]), range[3] ?? range[6]);
    if (!range[3] && startH > endH) startH -= 12;
    return { start: startH * 60 + Number(range[2] ?? 0), end: endH * 60 + Number(range[5] ?? 0) };
  }
  const single = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (single) return { start: to24(Number(single[1]), single[3]) * 60 + Number(single[2] ?? 0) };
  const clock = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (clock) return { start: Number(clock[1]) * 60 + Number(clock[2]) };
  return null;
}

/**
 * Start (YYYY-MM-DDTHH:MM:SS) and duration from the saved facts and text. Uses the stated date and start time,
 * falls back to 09:00 only when no time was found, and to 60 minutes when no end time is given.
 * startDateTime is "" when no date was found, so the user fills it in.
 */
export function eventTiming(texts: string[], dateHint: string | undefined, now = Date.now()): { startDateTime: string; durationMinutes: number } {
  const joined = texts.filter(Boolean).join("\n");
  const date = (dateHint && /^\d{4}-\d{2}-\d{2}/.test(dateHint) ? dateHint.slice(0, 10) : null) ?? findDate(joined, new Date(now).getUTCFullYear());
  const time = findTime(joined);
  const start = time?.start ?? 9 * 60;
  const duration = time?.end !== undefined && time.end > start ? time.end - start : 60;
  return { startDateTime: date ? `${date}T${pad(Math.floor(start / 60))}:${pad(start % 60)}:00` : "", durationMinutes: duration };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const shell = (title: string, body: string) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>
body{margin:0;background:#fff;color:#111;font-family:-apple-system,Roboto,"Helvetica Neue",Arial,sans-serif}
main{max-width:480px;margin:0 auto;padding:32px 20px 56px}
h1{font-size:26px;line-height:1.2;margin:0 0 8px}
p{color:#5B5B63;font-size:15px;line-height:1.5}
label{display:block;font-weight:700;font-size:14px;margin:20px 0 8px}
input{width:100%;box-sizing:border-box;height:50px;border:1px solid #ECECEC;border-radius:14px;background:#F4F4F5;padding:0 16px;font-size:16px;color:#111}
input:focus{outline:none;border:1.5px solid #111;background:#fff}
button{margin-top:28px;width:100%;height:54px;border:0;border-radius:999px;background:#111;color:#fff;font-size:16px;font-weight:700}
table{width:100%;border-collapse:collapse;font-size:14px;margin-top:16px}
th,td{text-align:left;padding:10px 8px;border-bottom:1px solid #ECECEC;vertical-align:top}
th{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#5B5B63}
</style></head><body><main>${body}</main></body></html>`;

export function applyFormHtml(): string {
  return shell(
    "Zapy Demo Program: quick application",
    `<h1>Zapy Demo Program: quick application</h1><p>Four quick questions and you're in.</p>
<form method="POST" action="${DEMO_FORM_PATH}">
<label for="name">Full name</label><input id="name" name="name" type="text" autocomplete="name" required>
<label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" required>
<label for="phone">Phone number</label><input id="phone" name="phone" type="tel" autocomplete="tel" required>
<label for="studying">What are you studying?</label><input id="studying" name="studying" type="text" required>
<button type="submit">Submit application</button>
</form>`,
  );
}

export function thanksHtml(name: string, at: number): string {
  return shell("Application received", `<h1>Thanks, ${esc(name || "there")}! Your application was received.</h1><p>Received ${esc(new Date(at).toISOString())}</p>`);
}

export type Submission = { name: string; email: string; phone: string; studying: string; createdAt: number };

export function submissionsHtml(rows: Submission[]): string {
  const body = rows.length
    ? rows.map((r) => `<tr><td>${esc(new Date(r.createdAt).toISOString())}</td><td>${esc(r.name)}</td><td>${esc(r.email)}</td><td>${esc(r.phone)}</td><td>${esc(r.studying)}</td></tr>`).join("")
    : `<tr><td colspan="5">No submissions yet.</td></tr>`;
  return shell(
    "Zapy Demo Program: submissions",
    `<h1>Latest applications</h1><p>The 10 most recent, newest first.</p><table><thead><tr><th>When</th><th>Name</th><th>Email</th><th>Phone</th><th>Studying</th></tr></thead><tbody>${body}</tbody></table>`,
  );
}

const FIELD_MAX = 200;
export function parseSubmission(form: URLSearchParams): Omit<Submission, "createdAt"> | null {
  const get = (k: string) => (form.get(k) ?? "").trim().slice(0, FIELD_MAX);
  const s = { name: get("name"), email: get("email"), phone: get("phone"), studying: get("studying") };
  return s.name && s.email ? s : null;
}
