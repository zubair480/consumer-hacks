import type { ExtractedFact } from "../../../src/shared/contracts";
import { buildDocument, composeDocument, itemBlocks, sourcesFromBlocks } from "./document";
import { callJson } from "./openai";
import { fetchPageText, makeVerifier } from "./sources";
import { ExecutorError, type Executor, type ExecutorInput, type SourceBlock } from "./types";

// OWNER: D+E. Priority 4: restaurant visit planning.

async function placeBlocks(input: ExecutorInput): Promise<{ blocks: SourceBlock[]; warnings: string[] }> {
  const blocks = itemBlocks(input);
  const warnings: string[] = [];
  if (input.item.sourceUrl && input.item.sourcePlatform !== "instagram" && input.item.sourcePlatform !== "tiktok") {
    const page = await fetchPageText(input.item.sourceUrl);
    if (page) blocks.unshift({ label: "Saved page", source: input.item.sourceUrl, url: input.item.sourceUrl, text: page });
  }
  if (!blocks.length && !input.imageUrl) throw new ExecutorError("There's no readable content for this place yet. Add a screenshot or paste the details.");
  if (!blocks.length) warnings.push("Details come from your screenshot only.");
  return { blocks, warnings };
}

const ADDRESS_KEY = /address|location|where/i;

async function findAddress(input: ExecutorInput, blocks: SourceBlock[]): Promise<{ name: string; fact: ExtractedFact } | null> {
  const name = input.analysis?.title ?? input.item.title ?? "";
  const real = blocks.filter((b) => b.source !== "analysis");
  const verify = makeVerifier(real.map((b) => b.text).join("\n\n"));
  for (const f of input.analysis?.facts ?? []) {
    if (!(ADDRESS_KEY.test(f.key) || ADDRESS_KEY.test(f.label))) continue;
    if (verify(f.evidence.quote) || (f.evidence.source === "image" && input.imageUrl)) return { name, fact: f };
  }
  if (!real.length) return null;
  const { data } = await callJson<{ name?: string | null; address?: string | null; quote?: string | null }>(
    'Find the place name and street address stated in the source. Return JSON {"name": string|null, "address": string|null, "quote": string|null}; quote is copied verbatim from the source and contains the address. Return nulls if no address is stated. Never guess.',
    real.map((b) => b.text).join("\n\n").slice(0, 16000),
  );
  if (!data.address || !data.quote || !verify(data.quote)) return null;
  const block = real.find((b) => makeVerifier(b.text)(data.quote!));
  return {
    name: data.name || name,
    fact: { key: "address", label: "Address", value: data.address, evidence: { quote: data.quote, source: block?.url ?? block?.source ?? "source" } },
  };
}

const planVisit: Executor = async (input) => {
  const { blocks, warnings } = await placeBlocks(input);
  const when = input.inputs.when?.trim();
  const party = input.inputs.party_size?.trim();
  const result = await buildDocument({
    input,
    blocks,
    warnings,
    strictRows: true,
    instruction: `Plan a visit to this restaurant/place${when ? ` on/at "${when}"` : ""}${party ? ` for ${party} people` : ""}.
1. "key_value" headed "Know before you go": address, neighborhood, hours, price range, reservation policy, phone, ONLY when stated, each with evidence.
2. "list" headed "What to order": dishes the source mentions or recommends (no evidence needed in a list, but only dishes named in the source).
3. "checklist" headed "Plan": practical steps (check hours, book a table if reservations are mentioned, plan transit), done=false, guidance only.
4. "text" headed "Best time to go" only if the source gives hints (busy times, specials); otherwise omit.
Missing hours/address/prices go in warnings ("Hours not stated in the source - check before you go").`,
  });
  const place = await findAddress(input, blocks).catch(() => null);
  if (place) {
    const q = encodeURIComponent(`${place.name} ${place.fact.value}`.trim());
    result.sections.push({ kind: "links", heading: "Directions", links: [{ label: "Open in Apple Maps", url: `https://maps.apple.com/?q=${q}` }, { label: "Open in Google Maps", url: `https://www.google.com/maps/search/?api=1&query=${q}` }] });
  }
  return { result, status: "succeeded" };
};

const findLocation: Executor = async (input) => {
  const { blocks, warnings } = await placeBlocks(input);
  const place = await findAddress(input, blocks);
  if (!place) throw new ExecutorError("The source doesn't state an address, so AfterScroll can't verify where this is.");
  const q = encodeURIComponent(`${place.name} ${place.fact.value}`.trim());
  const result = composeDocument(
    "find_location",
    `Location: ${place.name || "Saved place"}`,
    `${place.name ? `${place.name} is at ` : "Address: "}${place.fact.value}.`,
    [
      { kind: "key_value", heading: "Address", rows: [{ label: place.fact.label, value: place.fact.value, evidence: place.fact.evidence }] },
      { kind: "links", heading: "Directions", links: [{ label: "Open in Apple Maps", url: `https://maps.apple.com/?q=${q}` }, { label: "Open in Google Maps", url: `https://www.google.com/maps/search/?api=1&query=${q}` }] },
    ],
    sourcesFromBlocks(input, blocks),
    [...warnings, "Map links search for the stated address; confirm the pin before you go."],
  );
  return { result, status: "succeeded" };
};

const prepareInvitation: Executor = async (input) => {
  const { blocks, warnings } = await placeBlocks(input);
  const when = input.inputs.when?.trim();
  const who = input.inputs.who?.trim();
  const result = await buildDocument({
    input,
    blocks,
    warnings: [...warnings, "Not sent. Copy or share the message yourself when you're ready."],
    strictRows: true,
    instruction: `Draft a short, friendly invitation message the user can send to friends${who ? ` (${who})` : ""} to try this place${when ? ` on "${when}"` : ""}.
1. "text" headed "Message": the invitation (2-4 sentences, casual). Phrase it as wanting to try the place; never claim the user has been there. Include the address only if stated in the source. If no time was given, ask friends when they're free.
2. "key_value" headed "Details" with name/address/hours only when stated, with evidence.`,
  });
  const message = result.sections.find((s) => s.kind === "text");
  if (message && message.kind === "text") result.shareText = message.body;
  return { result, status: "awaiting_approval" };
};

export const restaurantExecutors = {
  plan_visit: planVisit,
  find_location: findLocation,
  prepare_invitation: prepareInvitation,
};
