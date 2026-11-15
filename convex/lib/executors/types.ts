import type {
  ActionResultDocument,
  ActionType,
  CollectionKind,
  ContentType,
  ExtractedFact,
  ResultSection,
  SourcePlatform,
  UserProfile,
} from "../../../src/shared/contracts";

// OWNER: D+E.

export type ExecutorInput = {
  actionType: ActionType;
  item: {
    title?: string;
    summary?: string;
    sourceUrl?: string;
    sourcePlatform: SourcePlatform;
    rawText?: string;
    primaryType?: ContentType;
    contentTypes: ContentType[];
  };
  imageUrl: string | null;
  analysis: { title: string; summary: string; facts: ExtractedFact[]; primaryType: ContentType } | null;
  profile: UserProfile;
  profileFacts: Record<string, string>;
  inputs: Record<string, string>;
  now: number;
};

export type ExecutorOutput = {
  result: ActionResultDocument;
  /** awaiting_approval when the user still has to do the external step (send, share). */
  status: "succeeded" | "awaiting_approval";
  /** Internal side effect applied when the result is saved. */
  collect?: { kind: CollectionKind; name: string };
};

export type Executor = (input: ExecutorInput) => Promise<ExecutorOutput>;

/** A failure whose message is safe and useful to show to the user. */
export class ExecutorError extends Error {}

export type SourceBlock = { label: string; source: string; url?: string; text: string };

export type { ActionResultDocument, ResultSection };
