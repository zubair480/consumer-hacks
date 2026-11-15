import type { ExtractedFact } from "../../../src/shared/contracts";
import { buildDocument, composeDocument, describeProfile, itemBlocks, sourcesFromBlocks } from "./document";
import { callJson } from "./openai";
import { fetchPageText, makeVerifier } from "./sources";
import { ExecutorError, type Executor, type ExecutorInput, type SourceBlock } from "./types";

// OWNER: D+E. Priority 1: scholarship / application preparation.

export async function scholarshipBlocks(input: ExecutorInput): Promise<{ blocks: SourceBlock[]; warnings: string[] }> {
  const blocks = itemBlocks(input);
  const warnings: string[] = [];
  if (input.item.sourceUrl) {
    const page = await fetchPageText(input.item.sourceUrl);
    if (page) blocks.unshift({ label: "Scholarship page", source: input.item.sourceUrl, url: input.item.sourceUrl, text: page });
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

const checkEligibility: Executor = async (input) => {
  const { blocks, warnings } = await scholarshipBlocks(input);
  const hasProfile = Object.keys(input.profileFacts).length > 0 || !!input.inputs.profile?.trim();
  if (!hasProfile) warnings.push("Add details about yourself (GPA, major, year, citizenship) to get a personal verdict.");
  const result = await buildDocument({
    input,
    blocks,
    warnings,
    strictRows: true,
    instruction: `Check the user's eligibility for this scholarship/application.
1. A "checklist" section headed "Eligibility requirements": one item per requirement the SOURCE states (GPA, year, major, citizenship, residency, enrollment, financial need, age, etc.), each with evidence.quote from the source. Set done=true ONLY when the user profile clearly satisfies it; put "Meets", "Does not meet", or "Unknown - confirm" plus a short reason in detail.
2. A "text" section headed "Verdict": likely eligible / not eligible / can't tell yet, and why, based only on the requirements above.
3. A "key_value" section headed "Key facts" with award amount, deadline, and who it is for, ONLY when stated (with evidence).
If the source lists no eligibility requirements, return no checklist and explain in warnings.
USER PROFILE:
${describeProfile(input)}`,
  });
  return { result, status: "succeeded" };
};

const prepareApplication: Executor = async (input) => {
  const { blocks, warnings } = await scholarshipBlocks(input);
  const deadline = await findVerifiedDeadline(input, blocks);
  if (!deadline) warnings.push("No deadline is stated in the source. Check the official page before relying on any date.");
  const result = await buildDocument({
    input,
    blocks,
    warnings,
    strictRows: true,
    prepend: deadline
      ? [{ kind: "key_value", heading: "Verified deadline", rows: [{ label: deadline.label, value: deadline.value, evidence: deadline.evidence }] }]
      : [],
    instruction: `Prepare an application checklist for this scholarship/application.
1. A "checklist" section headed "What the application needs": every document, essay, form, recommendation, transcript, or other material the SOURCE requires, each with evidence.quote. done=false.
2. A "checklist" section headed "Prep tasks": 3-6 practical preparation tasks (draft essay, request letters early, proofread, gather transcripts...) WITHOUT evidence; tailor them to the required materials above.
3. A "steps" section headed "How to apply": the submission process exactly as the source describes it (portal, email, mail). If the source doesn't describe it, omit and warn.
4. A "key_value" section headed "Key facts": award amount, number of awards, contact, only when stated with evidence. Do not repeat the deadline.
5. A "links" section with application/official URLs that appear verbatim in the source.`,
  });
  return { result, status: "succeeded" };
};

const trackDeadline: Executor = async (input) => {
  const { blocks, warnings } = await scholarshipBlocks(input);
  const deadline = await findVerifiedDeadline(input, blocks);
  if (!deadline) throw new ExecutorError("The source does not state a deadline, so there is nothing verified to track.");
  const parsed = Date.parse(deadline.value);
  const rows = [{ label: "Deadline", value: deadline.value, evidence: deadline.evidence }];
  const reminders: { label: string; detail?: string; done: boolean }[] = [];
  if (!Number.isNaN(parsed)) {
    const days = Math.ceil((parsed - input.now) / 86_400_000);
    rows.push({ label: "Time left", value: days >= 0 ? `${days} day${days === 1 ? "" : "s"}` : `Passed ${-days} day${days === -1 ? "" : "s"} ago`, evidence: deadline.evidence });
    if (days < 0) warnings.push("This deadline has already passed according to the source.");
    for (const [offset, what] of [
      [14, "Request recommendation letters and transcripts"],
      [7, "Finish essay drafts and get feedback"],
      [2, "Final review and submit"],
    ] as const) {
      const at = parsed - offset * 86_400_000;
      if (at > input.now) reminders.push({ label: what, detail: `By ${new Date(at).toISOString().slice(0, 10)}`, done: false });
    }
  } else {
    warnings.push("The deadline text could not be read as a calendar date, so no countdown is shown.");
  }
  const title = `Deadline: ${input.analysis?.title ?? input.item.title ?? "Saved item"}`;
  const sections = [
    { kind: "key_value" as const, heading: "Verified deadline", rows },
    ...(reminders.length ? [{ kind: "checklist" as const, heading: "Suggested milestones", items: reminders }] : []),
  ];
  const result = composeDocument(
    "track_deadline",
    title,
    `Tracking the deadline stated by the source: ${deadline.value}.`,
    sections,
    sourcesFromBlocks(input, blocks),
    [...warnings, "Tracked inside AfterScroll only; it has not been added to your calendar."],
  );
  return { result, status: "succeeded" };
};

export const scholarshipExecutors = {
  check_eligibility: checkEligibility,
  prepare_application: prepareApplication,
  track_deadline: trackDeadline,
};
