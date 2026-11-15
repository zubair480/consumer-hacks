import type { Id } from "../../convex/_generated/dataModel";
import type { ActionResultDocument, ActionSuggestion, ActionType, ActivityEventType, ContentType, ExecutionStatus } from "../shared/contracts";

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
  itemPrimaryType?: ContentType | null;
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



