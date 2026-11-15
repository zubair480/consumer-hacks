import type { ActionType } from "../../../src/shared/contracts";
import { buildDocument, composeDocument, itemBlocks, sourcesFromBlocks } from "./document";
import { fetchGithubRepo, fetchPageText, parseGithubRepo } from "./sources";
import type { Executor, ExecutorInput, SourceBlock } from "./types";

// OWNER: D+E. Generic structured LLM executor for recipe, code snippet, and fallback actions.

async function genericBlocks(input: ExecutorInput): Promise<{ blocks: SourceBlock[]; warnings: string[] }> {
  const blocks = itemBlocks(input);
  const warnings: string[] = [];
  const url = input.item.sourceUrl;
  if (url) {
    if (parseGithubRepo(url)) {
      const repo = await fetchGithubRepo(url);
      if (repo?.readme) blocks.unshift({ label: "README", source: repo.url, url: repo.url, text: repo.readme });
    } else {
      const page = await fetchPageText(url);
      if (page) blocks.unshift({ label: "Saved page", source: url, url, text: page });
      else if (!input.item.rawText) warnings.push("The saved link couldn't be read directly; this uses the details captured at save time.");
    }
  }
  return { blocks, warnings };
}

const INSTRUCTIONS: Partial<Record<ActionType, (input: ExecutorInput) => string>> = {
  create_shopping_list: (i) => `Create a shopping list from this recipe${i.inputs.servings ? ` scaled for ${i.inputs.servings} servings (show the scaling in detail)` : ""}.
1. One "checklist" per store section (Produce, Dairy, Pantry, Meat & fish, Other): each ingredient with quantity as stated, evidence.quote from the recipe.
2. "list" headed "Equipment" only if the recipe names equipment.
Only ingredients the source lists; if no ingredient list is present, return no checklist and warn.`,
  show_cooking_steps: () => `Rewrite this recipe's method as clean numbered cooking steps.
1. "key_value" headed "Overview": servings, prep time, cook time, oven temperature ONLY when stated, with evidence.
2. "steps" headed "Steps": every step in order, with times/temperatures exactly as the source states.
3. "list" headed "Tips" only for tips stated in the source.
If the source has no method, warn instead of inventing one.`,
  plan_meal: (i) => `Help the user fit this recipe into their week${i.inputs.day ? ` (they want it on ${i.inputs.day})` : ""}.
1. "key_value" headed "Recipe facts": servings and total time ONLY when stated, with evidence.
2. "checklist" headed "Meal plan": when to shop, prep ahead, cook, and leftovers (guidance).
3. "list" headed "Pairs well with": 2-4 simple sides (guidance).`,
  explain_code: () => `Explain the saved code snippet.
1. "text" headed "What it does": 2-3 sentences.
2. "code" with the snippet exactly as saved (language set).
3. "steps" headed "Walkthrough": key parts in order, each title naming the line/construct and detail explaining it.
4. "list" headed "Watch out for": pitfalls or assumptions in this code.`,
  suggest_test_cases: () => `Suggest test cases for the saved code snippet.
1. "checklist" headed "Test cases": 5-10 cases (happy path, edge cases, error cases); label = a short name for the case, detail = input and expected outcome.
2. "code" headed "Example test": one runnable test in a common framework for the snippet's language, testing behavior that the snippet actually implements.`,
  prepare_reusable_example: () => `Turn the saved code snippet into a clean reusable example.
1. "code" headed "Reusable version": cleaned-up, parameterized, with clear names; keep the original behavior.
2. "list" headed "Changes": what you changed and why.
3. "code" headed "Usage": a short usage example.`,
  summarize: () => `Summarize the saved content.
1. "text" headed "Summary": 3-5 sentences.
2. "list" headed "Why it matters": 2-3 takeaways.`,
  extract_key_points: () => `Extract the key points from the saved content.
1. "key_value" headed "Key facts": the most important stated facts (names, dates, numbers, places), each with evidence.
2. "list" headed "Takeaways": 3-6 points.
3. "links" with important URLs that appear verbatim in the source.`,
};

function generic(actionType: ActionType): Executor {
  return async (input) => {
    const { blocks, warnings } = await genericBlocks(input);
    const result = await buildDocument({
      input,
      blocks,
      warnings,
      strictRows: true,
      instruction: INSTRUCTIONS[actionType]!(input),
    });
    return { result, status: "succeeded" };
  };
}

const addToCollection: Executor = async (input) => {
  const name = input.inputs.collection?.trim() || "Saved for later";
  const title = input.analysis?.title ?? input.item.title ?? "Saved item";
  const result = composeDocument(
    "add_to_collection",
    `Added to ${name}`,
    `"${title}" is now in your ${name} collection.`,
    [{ kind: "key_value", heading: "Collection", rows: [{ label: name, value: title }] }],
    sourcesFromBlocks(input, []),
    [],
  );
  return { result, status: "succeeded", collect: { kind: "custom", name } };
};

export const genericExecutors = {
  create_shopping_list: generic("create_shopping_list"),
  show_cooking_steps: generic("show_cooking_steps"),
  plan_meal: generic("plan_meal"),
  explain_code: generic("explain_code"),
  suggest_test_cases: generic("suggest_test_cases"),
  prepare_reusable_example: generic("prepare_reusable_example"),
  summarize: generic("summarize"),
  extract_key_points: generic("extract_key_points"),
  add_to_collection: addToCollection,
};
