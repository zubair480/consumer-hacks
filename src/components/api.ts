import { makeFunctionReference } from "convex/server";
import type { Id } from "../../convex/_generated/dataModel";
import type { ActionResultDocument, ActionSuggestion, ActionType, ActivityEventType, ContentType, ExecutionStatus, OwnerArgs } from "../shared/contracts";

export type LatestExecution = { _id: Id<"actionExecutions">; status: ExecutionStatus; error: string | null; resultId: Id<"actionResults"> | null; createdAt: number };
export type SuggestionRow = ActionSuggestion & { _id: Id<"actionSuggestions">; itemId: Id<"savedItems">; latestExecution: LatestExecution | null };
export type ExecutionRow = { _id: Id<"actionExecutions">; itemId: Id<"savedItems">; actionType: ActionType; status: ExecutionStatus; error?: string; createdAt: number; completedAt?: number; resultId: Id<"actionResults"> | null };
export type ResultRow = {
  _id: Id<"actionResults">;
  itemId: Id<"savedItems">;
  executionId: Id<"actionExecutions">;
  actionType: ActionType;
  result: ActionResultDocument;
  createdAt: number;
  updatedAt: number;
  itemTitle?: string;
  itemPrimaryType?: ContentType;
  status?: ExecutionStatus;
};
export type ActivityRow = {
  _id: Id<"activityEvents">;
  type: ActivityEventType;
  title: string;
  detail: string | null;
  itemId: Id<"savedItems"> | null;
  executionId: Id<"actionExecutions"> | null;
  resultId: Id<"actionResults"> | null;
  createdAt: number;
};

const q = makeFunctionReference;

export const actionsApi = {
  listSuggestions: q<"query", OwnerArgs & { itemId: Id<"savedItems"> }, SuggestionRow[]>("actions:listSuggestions"),
  execute: q<"mutation", OwnerArgs & { suggestionId: Id<"actionSuggestions">; inputs?: Record<string, string> }, Id<"actionExecutions">>("actions:execute"),
  getExecution: q<"query", OwnerArgs & { executionId: Id<"actionExecutions"> }, ExecutionRow | null>("actions:getExecution"),
  getResult: q<"query", OwnerArgs & { executionId: Id<"actionExecutions"> }, ResultRow | null>("actions:getResult"),
  listResultsForItem: q<"query", OwnerArgs & { itemId: Id<"savedItems"> }, ResultRow[]>("actions:listResultsForItem"),
  recentOutcomes: q<"query", OwnerArgs & { limit?: number }, ResultRow[]>("actions:recentOutcomes"),
};


