import { makeFunctionReference } from "convex/server";
import type { Id } from "../../convex/_generated/dataModel";
import type { ActionResultDocument, ActionSuggestion, ActionType, ExecutionStatus, OwnerArgs } from "../shared/contracts";

export type SuggestionRow = ActionSuggestion & { _id: Id<"actionSuggestions">; itemId: Id<"savedItems"> };
export type ExecutionRow = { _id: Id<"actionExecutions">; itemId: Id<"savedItems">; actionType: ActionType; status: ExecutionStatus; error?: string; createdAt: number; completedAt?: number };
export type ResultRow = { _id: Id<"actionResults">; itemId: Id<"savedItems">; executionId: Id<"actionExecutions">; actionType: ActionType; result: ActionResultDocument; createdAt: number; itemTitle?: string };

export const actionsApi = {
  listSuggestions: makeFunctionReference<"query", OwnerArgs & { itemId: Id<"savedItems"> }, SuggestionRow[]>("actions:listSuggestions"),
  execute: makeFunctionReference<"mutation", OwnerArgs & { suggestionId: Id<"actionSuggestions">; inputs?: Record<string, string> }, Id<"actionExecutions">>("actions:execute"),
  getExecution: makeFunctionReference<"query", OwnerArgs & { executionId: Id<"actionExecutions"> }, ExecutionRow | null>("actions:getExecution"),
  getResult: makeFunctionReference<"query", OwnerArgs & { executionId: Id<"actionExecutions"> }, ResultRow | null>("actions:getResult"),
  listResultsForItem: makeFunctionReference<"query", OwnerArgs & { itemId: Id<"savedItems"> }, ResultRow[]>("actions:listResultsForItem"),
  recentOutcomes: makeFunctionReference<"query", OwnerArgs & { limit?: number }, ResultRow[]>("actions:recentOutcomes"),
};
