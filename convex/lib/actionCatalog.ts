import {
  ACTION_LABELS,
  actionsForType,
  FALLBACK_ACTIONS,
  type ActionSuggestion,
  type ActionType,
  type ContentType,
  type ExtractedFact,
  type RequiredInput,
} from "../../src/shared/contracts";

// OWNER: D+E. Turns an item's analysis into its three ranked contextual
// actions. Every action has an executor in convex/lib/executors; canExecute is
// false only when the source lacks what the action needs (e.g. no stated
// deadline to track).

type ActionSpec = { requiredInputs: RequiredInput[]; requiresApproval: boolean };

const none: ActionSpec = { requiredInputs: [], requiresApproval: false };

export const ACTION_SPECS: Record<ActionType, ActionSpec> = {
  plan_visit: {
    requiresApproval: false,
    requiredInputs: [
      { key: "when", label: "When are you going?", kind: "date", required: false },
      { key: "party_size", label: "How many people?", kind: "number", required: false },
    ],
  },
  find_location: none,
  prepare_invitation: {
    requiresApproval: true,
    requiredInputs: [
      { key: "who", label: "Who are you inviting?", kind: "text", required: false },
      { key: "when", label: "When?", kind: "date", required: false },
    ],
  },
  understand_project: none,
  extract_setup_guide: none,
  prepare_integration_plan: {
    requiresApproval: false,
    requiredInputs: [{ key: "your_project", label: "What are you building? (stack, goal)", kind: "text", required: false }],
  },
  check_eligibility: {
    requiresApproval: false,
    requiredInputs: [{ key: "profile", label: "About you (GPA, major, year, citizenship)", kind: "text", required: false }],
  },
  prepare_application: none,
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

const DEADLINE_FACT = /deadline|due|closes|closing|apply_by|application_date/i;

export function deadlineFact(facts: ExtractedFact[]): ExtractedFact | undefined {
  return facts.find((f) => (DEADLINE_FACT.test(f.key) || DEADLINE_FACT.test(f.label)) && f.evidence.quote.trim());
}

/** The three ranked suggestions for an item, without itemId. */
export function buildSuggestions(primaryType: ContentType | undefined, facts: ExtractedFact[]): Omit<ActionSuggestion, "itemId">[] {
  const actions = primaryType ? actionsForType(primaryType) : FALLBACK_ACTIONS;
  return actions.map((actionType, rank) => {
    const label = ACTION_LABELS[actionType];
    const spec = ACTION_SPECS[actionType];
    let { description } = label;
    let canExecute = true;
    if (actionType === "track_deadline") {
      const deadline = deadlineFact(facts);
      canExecute = !!deadline;
      description = deadline ? `Deadline stated by the source: ${deadline.value}.` : "No deadline is stated in the source.";
    }
    return {
      actionType,
      title: label.title,
      description,
      requiredInputs: spec.requiredInputs,
      canExecute,
      requiresApproval: spec.requiresApproval,
      rank,
    };
  });
}

/** Whether actionType is one of the item's routed actions. */
export function isRoutedAction(primaryType: ContentType | undefined, actionType: ActionType): boolean {
  return (primaryType ? actionsForType(primaryType) : FALLBACK_ACTIONS).includes(actionType) || FALLBACK_ACTIONS.includes(actionType);
}
