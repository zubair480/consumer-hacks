import { ACTION_LABELS, type ActionType, type FactEvidence, type ResultSection } from "../../../src/shared/contracts";
import { callJson } from "./openai";
import { makeVerifier } from "./sources";
import type { ActionResultDocument, ExecutorInput, SourceBlock } from "./types";

// OWNER: D+E. Shared LLM -> ActionResultDocument pipeline. The model proposes
// sections; this file checks every cited quote against the real source text
// and drops anything that claims evidence it does not have.

const SECTION_SCHEMA = `Return JSON: {"summary": string, "sections": Section[], "warnings": string[]}
Section is one of:
{"kind":"text","heading"?:string,"body":string}
{"kind":"checklist","heading"?:string,"items":[{"label":string,"detail"?:string,"done":boolean,"evidence"?:{"quote":string}}]}
{"kind":"steps","heading"?:string,"steps":[{"title":string,"detail"?:string,"code"?:string}]}
{"kind":"key_value","heading"?:string,"rows":[{"label":string,"value":string,"evidence"?:{"quote":string}}]}
{"kind":"list","heading"?:string,"items":string[]}
{"kind":"links","heading"?:string,"links":[{"label":string,"url":string}]}
{"kind":"code","heading"?:string,"language"?:string,"code":string}
"code" fields hold only source code or shell commands, never prose. Step titles have no leading numbers.
{"kind":"palette","heading"?:string,"colors":[{"hex":"#RRGGBB","name"?:string}]}`;

const RULES = `Rules:
- Use ONLY the source material below. Never invent deadlines, dates, locations, addresses, hours, prices, amounts, availability, eligibility requirements, qualifications, install commands, or repository instructions.
- Any factual claim taken from the source must carry evidence.quote: a short VERBATIM excerpt (5-25 words) copied exactly from the source material. Quotes are machine-checked; items whose quote is not in the source are deleted.
- If the source does not state something the user would need, say so in "warnings" instead of guessing.
- Guidance or advice that is not a source fact must NOT carry evidence.
- Keep it concise and practical for a phone screen. Output JSON only.`;

type RawEvidence = { quote?: unknown } | undefined;
type RawSection = Record<string, unknown> & { kind?: unknown };

export type BuildOptions = {
  input: ExecutorInput;
  blocks: SourceBlock[];
  instruction: string;
  title?: string;
  /** Verify every line of code against the source (repo instructions). */
  verifyCode?: boolean;
  /** key_value rows must carry verified evidence. */
  strictRows?: boolean;
  prepend?: ResultSection[];
  append?: ResultSection[];
  warnings?: string[];
  useImage?: boolean;
};

function str(x: unknown): string | undefined {
  return typeof x === "string" && x.trim() ? x.trim() : undefined;
}

export function describeInputs(input: ExecutorInput): string {
  const lines: string[] = [];
  for (const [k, val] of Object.entries(input.inputs)) if (val.trim()) lines.push(`- ${k}: ${val.trim()}`);
  return lines.length ? lines.join("\n") : "(none)";
}

export function describeProfile(input: ExecutorInput): string {
  const lines = Object.entries(input.profileFacts).map(([k, val]) => `- ${k}: ${val}`);
  if (input.homeCity) lines.push(`- home city: ${input.homeCity}`);
  if (input.inputs.profile?.trim()) lines.push(`- user says: ${input.inputs.profile.trim()}`);
  return lines.length ? lines.join("\n") : "(the user has not shared any profile details)";
}

export function factsBlock(input: ExecutorInput): SourceBlock | null {
  const facts = input.analysis?.facts ?? [];
  if (!facts.length) return null;
  return {
    label: "Facts extracted at save time (each with its verbatim evidence)",
    source: "analysis",
    text: facts.map((f) => `${f.label}: ${f.value}\n  evidence: "${f.evidence.quote}" (${f.evidence.source})`).join("\n"),
  };
}

export function itemBlocks(input: ExecutorInput): SourceBlock[] {
  const blocks: SourceBlock[] = [];
  if (input.item.rawText) blocks.push({ label: "Text the user saved", source: "user_text", text: input.item.rawText });
  const facts = factsBlock(input);
  if (facts) blocks.push(facts);
  return blocks;
}

function sourceFor(blocks: SourceBlock[], quote: string): string {
  for (const b of blocks) if (makeVerifier(b.text)(quote)) return b.url ?? b.source;
  return blocks[0]?.url ?? blocks[0]?.source ?? "source";
}

export function sectionToText(s: ResultSection): string {
  const head = s.heading ? `${s.heading}\n` : "";
  switch (s.kind) {
    case "text":
      return head + s.body;
    case "checklist":
      return head + s.items.map((i) => `${i.done ? "[x]" : "[ ]"} ${i.label}${i.detail ? ` - ${i.detail}` : ""}`).join("\n");
    case "steps":
      return head + s.steps.map((st, i) => `${i + 1}. ${st.title}${st.detail ? ` - ${st.detail}` : ""}${st.code ? `\n   ${st.code.replace(/\n/g, "\n   ")}` : ""}`).join("\n");
    case "key_value":
      return head + s.rows.map((r) => `${r.label}: ${r.value}`).join("\n");
    case "list":
      return head + s.items.map((i) => `- ${i}`).join("\n");
    case "links":
      return head + s.links.map((l) => `${l.label}: ${l.url}`).join("\n");
    case "code":
      return head + s.code;
    case "palette":
      return head + s.colors.map((c) => `${c.hex}${c.name ? ` ${c.name}` : ""}`).join("\n");
  }
}

export function composeDocument(
  actionType: ActionType,
  title: string,
  summary: string,
  sections: ResultSection[],
  sources: ActionResultDocument["sources"],
  warnings: string[],
  shareText?: string,
): ActionResultDocument {
  const text =
    shareText ??
    [title, summary, ...sections.map(sectionToText), sources.length ? `Sources:\n${sources.map((s) => `- ${s.label}${s.url ? ` ${s.url}` : ""}`).join("\n")}` : ""]
      .filter(Boolean)
      .join("\n\n");
  return { version: 1, actionType, title, summary, sections, sources, shareText: text, warnings: [...new Set(warnings)] };
}

export function sourcesFromBlocks(input: ExecutorInput, blocks: SourceBlock[]): ActionResultDocument["sources"] {
  const out: ActionResultDocument["sources"] = [];
  const seen = new Set<string>();
  const add = (label: string, url?: string) => {
    const key = url ?? label;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(url ? { label, url } : { label });
  };
  for (const b of blocks) if (b.url) add(b.label, b.url);
  if (input.item.sourceUrl) add("Saved link", input.item.sourceUrl);
  if (input.item.rawText) add("Your saved text");
  if (input.imageUrl) add("Your saved image");
  return out;
}

export async function buildDocument(opts: BuildOptions): Promise<ActionResultDocument> {
  const { input, blocks } = opts;
  const image = opts.useImage !== false ? input.imageUrl : null;
  if (!blocks.some((b) => b.text.trim()) && !image) {
    throw new Error("There is no readable content for this save yet. Add text or a screenshot and try again.");
  }
  const corpus = blocks.map((b) => b.text).join("\n\n");
  const verify = makeVerifier(corpus);
  const label = ACTION_LABELS[input.actionType];
  const system = `You are AfterScroll's "${label.title}" executor. ${label.description}\n${SECTION_SCHEMA}\n${RULES}`;
  const user = [
    `TASK:\n${opts.instruction}`,
    `TODAY: ${new Date(input.now).toISOString().slice(0, 10)}`,
    `ITEM: ${input.analysis?.title ?? input.item.title ?? "(untitled)"}${input.item.sourceUrl ? ` (${input.item.sourceUrl})` : ""}`,
    `USER INPUTS:\n${describeInputs(input)}`,
    ...blocks.map((b) => `=== SOURCE: ${b.label}${b.url ? ` <${b.url}>` : ""} ===\n${b.text}`),
    image ? "An image the user saved is attached; you may cite it with evidence.quote describing the visible element, prefixed with 'image:'." : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const { data } = await callJson<{ summary?: unknown; sections?: unknown; warnings?: unknown }>(system, user, image);
  const warnings = [...(opts.warnings ?? [])];
  let dropped = 0;

  const evidence = (raw: RawEvidence): FactEvidence | undefined | false => {
    const quote = str(raw?.quote);
    if (!quote) return undefined;
    if (image && /^image:/i.test(quote)) return { quote: quote.replace(/^image:\s*/i, ""), source: "image" };
    if (!verify(quote)) return false;
    return { quote, source: sourceFor(blocks, quote) };
  };
  const urlAllowed = (url: string) => /^https?:\/\//i.test(url) && (corpus.includes(url) || url === input.item.sourceUrl);
  const codeAllowed = (code: string) =>
    code
      .split("\n")
      .map((l) => l.replace(/^\s*[$>]\s*/, "").trim())
      .filter((l) => l && !l.startsWith("#"))
      .every((l) => verify(l));

  const sections: ResultSection[] = [];
  for (const raw of Array.isArray(data.sections) ? (data.sections as RawSection[]) : []) {
    const heading = str(raw.heading);
    const h = heading ? { heading } : {};
    switch (raw.kind) {
      case "text": {
        const body = str(raw.body);
        if (body) sections.push({ kind: "text", ...h, body });
        break;
      }
      case "checklist": {
        const items: Extract<ResultSection, { kind: "checklist" }>["items"] = [];
        for (const it of Array.isArray(raw.items) ? (raw.items as Record<string, unknown>[]) : []) {
          const lbl = str(it.label);
          if (!lbl) continue;
          const ev = evidence(it.evidence as RawEvidence);
          if (ev === false) {
            dropped++;
            continue;
          }
          const detail = str(it.detail);
          items.push({ label: lbl, done: it.done === true, ...(detail ? { detail } : {}), ...(ev ? { evidence: ev } : {}) });
        }
        if (items.length) sections.push({ kind: "checklist", ...h, items });
        break;
      }
      case "steps": {
        const steps: Extract<ResultSection, { kind: "steps" }>["steps"] = [];
        for (const st of Array.isArray(raw.steps) ? (raw.steps as Record<string, unknown>[]) : []) {
          const t = str(st.title)?.replace(/^\d+[.)]\s*/, "");
          if (!t) continue;
          const detail = str(st.detail);
          let code = str(st.code);
          if (code && (code === detail || detail?.includes(code))) code = undefined;
          if (code && opts.verifyCode && !codeAllowed(code)) {
            dropped++;
            code = undefined;
          }
          steps.push({ title: t, ...(detail ? { detail } : {}), ...(code ? { code } : {}) });
        }
        if (steps.length) sections.push({ kind: "steps", ...h, steps });
        break;
      }
      case "key_value": {
        const rows: Extract<ResultSection, { kind: "key_value" }>["rows"] = [];
        for (const r of Array.isArray(raw.rows) ? (raw.rows as Record<string, unknown>[]) : []) {
          const lbl = str(r.label);
          const value = str(r.value);
          if (!lbl || !value) continue;
          const ev = evidence(r.evidence as RawEvidence);
          if (ev === false || (opts.strictRows && !ev)) {
            dropped++;
            continue;
          }
          rows.push({ label: lbl, value, ...(ev ? { evidence: ev } : {}) });
        }
        if (rows.length) sections.push({ kind: "key_value", ...h, rows });
        break;
      }
      case "list": {
        const items = (Array.isArray(raw.items) ? raw.items : []).map(str).filter((x): x is string => !!x);
        if (items.length) sections.push({ kind: "list", ...h, items });
        break;
      }
      case "links": {
        const links: { label: string; url: string }[] = [];
        for (const l of Array.isArray(raw.links) ? (raw.links as Record<string, unknown>[]) : []) {
          const url = str(l.url);
          if (!url) continue;
          if (links.some((x) => x.url === url)) continue;
          if (!urlAllowed(url)) {
            dropped++;
            continue;
          }
          links.push({ label: str(l.label) ?? url, url });
        }
        if (links.length) sections.push({ kind: "links", ...h, links });
        break;
      }
      case "code": {
        const code = str(raw.code);
        if (!code) break;
        if (opts.verifyCode && !codeAllowed(code)) {
          dropped++;
          break;
        }
        const language = str(raw.language);
        sections.push({ kind: "code", ...h, ...(language ? { language } : {}), code });
        break;
      }
      case "palette": {
        const colors: { hex: string; name?: string }[] = [];
        for (const c of Array.isArray(raw.colors) ? (raw.colors as Record<string, unknown>[]) : []) {
          const hex = str(c.hex)?.toUpperCase();
          if (!hex || !/^#[0-9A-F]{6}$/.test(hex)) continue;
          const name = str(c.name);
          colors.push({ hex, ...(name ? { name } : {}) });
        }
        if (colors.length) sections.push({ kind: "palette", ...h, colors });
        break;
      }
    }
  }
  for (const w of Array.isArray(data.warnings) ? data.warnings : []) {
    const s = str(w);
    if (s) warnings.push(s);
  }
  if (dropped) warnings.push(`${dropped} item${dropped === 1 ? " was" : "s were"} removed because ${dropped === 1 ? "it" : "they"} could not be matched to the source.`);
  const all = [...(opts.prepend ?? []), ...sections, ...(opts.append ?? [])];
  if (!all.length) throw new Error("The source did not contain enough information to complete this action.");
  return composeDocument(
    input.actionType,
    opts.title ?? `${label.title}: ${input.analysis?.title ?? input.item.title ?? "Saved item"}`,
    str(data.summary) ?? label.description,
    all,
    sourcesFromBlocks(input, blocks),
    warnings,
  );
}
