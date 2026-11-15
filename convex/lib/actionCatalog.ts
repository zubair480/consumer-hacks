import {
  ACTION_LABELS,
  ACTION_ROUTING,
  FALLBACK_ACTIONS,
  type ActionSuggestion,
  type ActionType,
  type ContentType,
  type ExtractedFact,
  type RequiredInput,
} from "../../src/shared/contracts";

// OWNER: D+E. Turns an item's analysis into its three ranked contextual
// actions. Every action type has an executor in convex/lib/executors.

type ActionSpec = { requiredInputs: RequiredInput[]; requiresApproval: boolean };

const none: ActionSpec = { requiredInputs: [], requiresApproval: false };

export const ACTION_SPECS: Record<ActionType, ActionSpec> = {
  plan_visit: {
    requiresApproval: false,
    requiredInputs: [
      { key: "date", label: "When are you going?", kind: "date", required: false },
      { key: "party_size", label: "How many people?", kind: "number", required: false },
      { key: "starting_from", label: "Starting from", kind: "location", required: false, prefillFrom: "profile.city" },
    ],
  },
  find_location: none,
  prepare_invitation: {
    requiresApproval: true,
    requiredInputs: [
      { key: "who", label: "Who are you inviting?", kind: "text", required: false },
      { key: "date", label: "When?", kind: "date", required: false },
    ],
  },
  understand_project: none,
  extract_setup_guide: none,
  prepare_integration_plan: {
    requiresApproval: false,
    requiredInputs: [{ key: "your_project", label: "What are you building?", kind: "text", required: false }],
  },
  check_eligibility: {
    requiresApproval: false,
    requiredInputs: [
      { key: "gpa", label: "GPA", kind: "number", required: false, prefillFrom: "profile.gpa" },
      { key: "educationLevel", label: "Education level", kind: "text", required: false, prefillFrom: "profile.educationLevel" },
      { key: "fieldOfStudy", label: "Field of study", kind: "text", required: false, prefillFrom: "profile.fieldOfStudy" },
      { key: "citizenship", label: "Citizenship", kind: "text", required: false, prefillFrom: "profile.citizenship" },
      { key: "country", label: "Country", kind: "text", required: false, prefillFrom: "profile.country" },
      { key: "profile", label: "Anything else about you", kind: "text", required: false },
    ],
  },
  prepare_application: {
    requiresApproval: false,
    requiredInputs: [{ key: "essay_prompt", label: "Essay prompt (if any)", kind: "text", required: false }],
  },
  track_deadline: none,
  extract_style: none,
  create_design_brief: {
    requiresApproval: false,
    requiredInputs: [{ key: "goal", label: "What do you want designed?", kind: "text", required: false }],
  },
  add_to_moodboard: none,
  create_shopping_list: {
    requiresApproval: false,
    requiredInputs: [{ key: "servings", label: "Servings", kind: "number", required: false }],
  },
  show_cooking_steps: none,
  plan_meal: {
    requiresApproval: false,
    requiredInputs: [
      {
        key: "day",
        label: "Which day?",
        kind: "choice",
        required: false,
        options: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      },
    ],
  },
  explain_code: none,
  suggest_test_cases: none,
  prepare_reusable_example: none,
  summarize: none,
  extract_key_points: none,
  add_to_collection: {
    requiresApproval: false,
    requiredInputs: [{ key: "collection", label: "Collection name", kind: "text", required: false }],
  },
};

type Trio = readonly [ActionType, ActionType, ActionType];

/** The spec's routes plus defaults for every other content type. */
export const CATALOG_ROUTING: Record<ContentType, Trio> = {
  restaurant: ACTION_ROUTING.restaurant!,
  github_repository: ACTION_ROUTING.github_repository!,
  scholarship: ACTION_ROUTING.scholarship!,
  application: ACTION_ROUTING.application!,
  graphic: ACTION_ROUTING.graphic!,
  recipe: ACTION_ROUTING.recipe!,
  code_snippet: ACTION_ROUTING.code_snippet!,
  job: ["check_eligibility", "prepare_application", "track_deadline"],
  event: ["find_location", "prepare_invitation", "track_deadline"],
  travel: ["find_location", "extract_key_points", "add_to_collection"],
  product: ["extract_key_points", "summarize", "add_to_collection"],
  research: ["summarize", "extract_key_points", "add_to_collection"],
  tutorial: ["summarize", "extract_key_points", "add_to_collection"],
  general_content: FALLBACK_ACTIONS,
};

export function routeFor(primaryType: ContentType | undefined): Trio {
  return primaryType ? CATALOG_ROUTING[primaryType] : FALLBACK_ACTIONS;
}

const DEADLINE_FACT = /deadline|due|closes|closing|apply_by|application_date|event_date/i;

export function deadlineFact(facts: ExtractedFact[]): ExtractedFact | undefined {
  return facts.find((f) => (DEADLINE_FACT.test(f.key) || DEADLINE_FACT.test(f.label)) && f.evidence.quote.trim());
}

/** The three ranked suggestions for an item, without itemId. */
export function buildSuggestions(primaryType: ContentType | undefined, facts: ExtractedFact[]): Omit<ActionSuggestion, "itemId">[] {
  return routeFor(primaryType).map((actionType, rank) => {
    const label = ACTION_LABELS[actionType];
    const spec = ACTION_SPECS[actionType];
    let { description } = label;
    if (actionType === "track_deadline") {
      const deadline = deadlineFact(facts);
      description = deadline ? `Deadline stated by the source: ${deadline.value}.` : "No deadline found in the source.";
    }
    return {
      actionType,
      title: label.title,
      description,
      requiredInputs: spec.requiredInputs,
      canExecute: true,
      requiresApproval: spec.requiresApproval,
      rank,
    };
  });
}

/** Whether actionType may run on an item: one of its routed actions or a fallback. */
export function isRoutedAction(primaryType: ContentType | undefined, actionType: ActionType): boolean {
  return routeFor(primaryType).includes(actionType) || FALLBACK_ACTIONS.includes(actionType);
}
