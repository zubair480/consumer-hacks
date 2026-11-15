import { buildDocument, composeDocument, itemBlocks, sourcesFromBlocks } from "./document";
import { fetchPageText } from "./sources";
import { ExecutorError, type Executor, type ExecutorInput, type SourceBlock } from "./types";

// OWNER: D+E. Priority 3: graphic design analysis.

async function designBlocks(input: ExecutorInput): Promise<SourceBlock[]> {
  const blocks = itemBlocks(input);
  if (!input.imageUrl && input.item.sourceUrl) {
    const page = await fetchPageText(input.item.sourceUrl);
    if (page) blocks.unshift({ label: "Saved page", source: input.item.sourceUrl, url: input.item.sourceUrl, text: page });
  }
  if (!input.imageUrl && !blocks.length) throw new ExecutorError("Add a screenshot of the design so its style can be analyzed.");
  return blocks;
}

const extractStyle: Executor = async (input) => {
  const blocks = await designBlocks(input);
  const warnings = input.imageUrl ? [] : ["No image was saved, so the style is read from text only. Colors may be missing."];
  const result = await buildDocument({
    input,
    blocks,
    warnings,
    instruction: `Extract the visual style of the saved design${input.imageUrl ? " (attached image)" : ""}.
1. "palette" headed "Palette": 4-8 dominant colors actually visible, as #RRGGBB with a short descriptive name. Only colors you can see (or hex codes stated in the text); no palette if there is no image and no stated colors.
2. "key_value" headed "Typography": typeface style (serif/sans/display/mono), weight, case, hierarchy; evidence "image: <what you see>".
3. "key_value" headed "Layout & composition": grid, spacing, alignment, imagery, shapes.
4. "list" headed "Mood": 3-6 adjectives.
5. "list" headed "Reuse tips": 2-4 ways to apply this style (guidance).
Never identify a specific font name unless it is written in the source; describe it instead.`,
  });
  return { result, status: "succeeded" };
};

const createDesignBrief: Executor = async (input) => {
  const blocks = await designBlocks(input);
  const goal = input.inputs.goal?.trim();
  const result = await buildDocument({
    input,
    blocks,
    instruction: `Write a design brief, inspired by the saved design, that the user can hand to a designer${goal ? ` for: "${goal}"` : ""}.
1. "text" headed "Objective": what to design and why${goal ? "" : " (keep general, since the user gave no goal)"}.
2. "palette" headed "Reference palette" with colors visible in the reference.
3. "key_value" headed "Visual direction": typography, layout, imagery, tone.
4. "checklist" headed "Deliverables": suggested deliverables (guidance, done=false).
5. "list" headed "Do / don't".
Describe the reference honestly; do not claim who made it.`,
  });
  return { result, status: "succeeded" };
};

const addToMoodboard: Executor = async (input) => {
  const title = input.analysis?.title ?? input.item.title ?? "Saved design";
  const result = composeDocument(
    "add_to_moodboard",
    "Added to Moodboard",
    `"${title}" is now in your Moodboard collection.`,
    [{ kind: "key_value", heading: "Collection", rows: [{ label: "Moodboard", value: title }] }],
    sourcesFromBlocks(input, []),
    [],
  );
  return { result, status: "succeeded", collect: { kind: "moodboard", name: "Moodboard" } };
};

export const graphicExecutors = {
  extract_style: extractStyle,
  create_design_brief: createDesignBrief,
  add_to_moodboard: addToMoodboard,
};
