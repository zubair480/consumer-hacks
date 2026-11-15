import type { ExtractedFact, ResultSection } from "../../../src/shared/contracts";
import { buildDocument, composeDocument, describeProfile, itemBlocks, sourcesFromBlocks } from "./document";
import { callJson } from "./openai";
import { fetchPageText, makeVerifier } from "./sources";
import { type Executor, type ExecutorInput, type SourceBlock } from "./types";

// OWNER: D+E. Priority 1: scholarship / application preparation.

export async function scholarshipBlocks(input: ExecutorInput): Promise<{ blocks: SourceBlock[]; warnings: string[] }> {
  const blocks = itemBlocks(input);
  const warnings: string[] = [];
  if (input.item.sourceUrl) {
    const page = await fetchPageText(input.item.sourceUrl);
    if (page) blocks.unshift({ label: "Source page", source: input.item.sourceUrl, url: input.item.sourceUrl, text: page });
    else warnings.push("The saved link could not be read directly, so this uses the details captured when you saved it. Check the official page.");
  }
  return { blocks, warnings };
}

const DEADLINE_KEY = /deadline|due|closes|closing|apply_by|application_date/i;

/** Deadline fact whose evidence quote is found in the real source, or null. */
export async function findVerifiedDeadline(input: ExecutorInput, blocks: SourceBlock[]): Promise<ExtractedFact | null> {
  const sourceBlocks = blocks.filter((b) => b.source !== "analysis");
  const verify = makeVerifier(sourceBlocks.map((b) => b.text).join("\n\n"));
  const facts = (input.analysis?.facts ?? []).filter((f) => DEADLINE_KEY.test(f.key) || DEADLINE_KEY.test(f.label));
  for (const f of facts) {
    if (verify(f.evidence.quote)) return f;
    if (f.evidence.source === "image" && input.imageUrl) return f;
  }
  if (!sourceBlocks.length) return null;
  const { data } = await callJson<{ deadline?: string | null; quote?: string | null }>(
    'Find the application deadline stated in the source. Return JSON {"deadline": string|null, "quote": string|null}. quote must be copied verbatim from the source and contain the date. If no deadline is explicitly stated, return nulls. Never guess.',
    sourceBlocks.map((b) => b.text).join("\n\n").slice(0, 20000),
  );
  if (data.deadline && data.quote && verify(data.quote)) {
    const block = sourceBlocks.find((b) => makeVerifier(b.text)(data.quote!));
    return { key: "deadline", label: "Deadline", value: data.deadline, evidence: { quote: data.quote, source: block?.url ?? block?.source ?? "source" } };
  }
  return null;
}

const PROFILE_FIELDS = [
  ["gpa", "GPA"],
  ["educationLevel", "Education level"],
  ["fieldOfStudy", "Field of study"],
  ["citizenship", "Citizenship"],
  ["country", "Country"],
] as const;

/** Profile with this run's inputs layered on top (the action form pre-fills from Profile). */
function effectiveProfile(input: ExecutorInput): ExecutorInput {
  const profile = { ...input.profile };
  for (const [key] of PROFILE_FIELDS) {
    const value = input.inputs[key]?.trim();
    if (!value) continue;
    if (key === "gpa") {
      const gpa = Number(value);
      if (!Number.isNaN(gpa)) profile.gpa = gpa;
    } else profile[key] = value;
  }
  return { ...input, profile };
}

const checkEligibility: Executor = async (raw) => {
  const input = effectiveProfile(raw);
  const { blocks, warnings } = await scholarshipBlocks(input);
  const missing = PROFILE_FIELDS.filter(([key]) => input.profile[key] === undefined || input.profile[key] === "").map(([, label]) => label);
  const result = await buildDocument({
    input,
    blocks,
    warnings,
    strictRows: true,
    allowStatus: true,
    instruction: `Check the user's eligibility for this opportunity (scholarship, application, or job).
1. A "checklist" section headed "Eligibility requirements": one item per requirement or qualification the SOURCE states (GPA, year, major, citizenship, residency, enrollment, financial need, age, experience, etc.). Every item MUST carry evidence.quote from the source. Set status to "met" only when the user profile clearly satisfies it, "unmet" when the profile clearly contradicts it, otherwise "unknown". Put a one-line reason in detail.
2. A "text" section headed "Verdict": likely eligible / not eligible / can't tell yet, and why, based only on the requirements above.
3. A "key_value" section headed "Key facts" with award amount, deadline, and who it is for, ONLY when stated (with evidence).
If the source lists no requirements, return no checklist and explain in warnings.
USER PROFILE:
${describeProfile(input)}`,
    append: missing.length ? [{ kind: "list", heading: "Missing from your Profile", items: missing }] : [],
  });
  if (missing.length) result.warnings.push(`Add ${missing.join(", ")} to your Profile for a more complete check.`);
  return { result, status: "succeeded" };
};

function timeline(deadline: ExtractedFact, now: number): ResultSection | null {
  const at = Date.parse(deadline.value);
  if (Number.isNaN(at) || at <= now) return null;
  const day = 86_400_000;
  const milestones: [number, string][] = [
    [28, "Read the requirements and list every document you need"],
    [21, "Request recommendation letters and transcripts"],
    [14, "Write a full draft of each essay"],
    [7, "Revise essays and get feedback"],
    [3, "Fill in the application form and upload documents"],
    [1, "Final review and submit"],
  ];
  const steps = milestones
    .filter(([offset]) => at - offset * day > now)
    .map(([offset, title]) => ({ title, detail: `By ${new Date(at - offset * day).toISOString().slice(0, 10)}` }));
  steps.push({ title: "Deadline", detail: deadline.value });
  return { kind: "steps", heading: "Timeline (working back from the verified deadline)", steps };
}

const prepareApplication: Executor = async (input) => {
  const { blocks, warnings } = await scholarshipBlocks(input);
  const deadline = await findVerifiedDeadline(input, blocks);
  if (!deadline) warnings.push("No deadline found in the source. Check the official page before relying on any date.");
  const plan = deadline ? timeline(deadline, input.now) : null;
  const prompt = input.inputs.essay_prompt?.trim();
  const result = await buildDocument({
    input,
    blocks,
    warnings,
    strictRows: true,
    prepend: deadline
      ? [{ kind: "key_value", heading: "Verified deadline", rows: [{ label: deadline.label, value: deadline.value, evidence: deadline.evidence }] }]
      : [],
    append: plan ? [plan] : [],
    instruction: `Prepare an application checklist for this opportunity (scholarship, application, or job).
1. A "checklist" section headed "What the application needs": every document, essay, form, recommendation, transcript, or other material the SOURCE requires, each with evidence.quote.
2. A "checklist" section headed "Prep tasks": 3-6 practical preparation tasks WITHOUT evidence, tailored to the required materials above.
3. A "steps" section headed "How to apply": the submission process exactly as the source describes it (portal, email, mail). If the source doesn't describe it, omit and warn.
4. ${prompt ? `A "steps" section headed "Essay outline" for this essay prompt from the user: "${prompt}". 4-6 steps (hook, story, evidence of fit, goals, close).` : `If the SOURCE states an essay prompt, a "steps" section headed "Essay outline": first step quotes the prompt with evidence, then 4-6 outline steps. Otherwise no outline.`}
5. A "key_value" section headed "Key facts": award amount, number of awards, contact, only when stated with evidence. Do not repeat the deadline.
6. A "links" section with application/official URLs that appear verbatim in the source.`,
  });
  if (!prompt) {
    result.sections = result.sections.filter((sec) => !(sec.kind === "steps" && /essay outline/i.test(sec.heading ?? "") && !sec.steps[0]?.evidence));
    Object.assign(result, composeDocument(result.actionType, result.title, result.summary, result.sections, result.sources, result.warnings));
  }
  return { result, status: "succeeded" };
};

const trackDeadline: Executor = async (input) => {
  const { blocks, warnings } = await scholarshipBlocks(input);
  const deadline = await findVerifiedDeadline(input, blocks);
  const name = input.analysis?.title ?? input.item.title ?? "Saved item";
  if (!deadline) {
    const result = composeDocument(
      "track_deadline",
      `Deadline: ${name}`,
      "No deadline found in the source, so nothing is being tracked.",
      [
        {
          kind: "checklist",
          heading: "Next steps",
          items: [
            { label: "Check the official page for the deadline", checked: false },
            { label: "Paste the deadline text into this save, then run this again", checked: false },
          ],
        },
      ],
      sourcesFromBlocks(input, blocks),
      ["No deadline found in the source"],
    );
    return { result, status: "succeeded" };
  }
  const parsed = Date.parse(deadline.value);
  const rows: { label: string; value: string; evidence?: ExtractedFact["evidence"] }[] = [{ label: "Deadline", value: deadline.value, evidence: deadline.evidence }];
  if (!Number.isNaN(parsed)) {
    const days = Math.ceil((parsed - input.now) / 86_400_000);
    rows.push({ label: "Time left", value: days >= 0 ? `${days} day${days === 1 ? "" : "s"}` : `Passed ${-days} day${days === -1 ? "" : "s"} ago` });
    if (days < 0) warnings.push("This deadline has already passed according to the source.");
  } else {
    warnings.push("The deadline text could not be read as a calendar date, so no countdown is shown.");
  }
  const plan = timeline(deadline, input.now);
  const result = composeDocument(
    "track_deadline",
    `Deadline: ${name}`,
    `Tracking the deadline stated by the source: ${deadline.value}.`,
    [{ kind: "key_value", heading: "Verified deadline", rows }, ...(plan ? [plan] : [])],
    sourcesFromBlocks(input, blocks),
    [...warnings, "Tracked inside Zapy only; it has not been added to your calendar."],
  );
  return { result, status: "succeeded" };
};

export const scholarshipExecutors = {
  check_eligibility: checkEligibility,
  prepare_application: prepareApplication,
  track_deadline: trackDeadline,
};
