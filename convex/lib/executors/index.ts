import type { ActionType } from "../../../src/shared/contracts";
import { genericExecutors } from "./generic";
import { githubExecutors } from "./github";
import { graphicExecutors } from "./graphic";
import { restaurantExecutors } from "./restaurant";
import { scholarshipExecutors } from "./scholarship";
import type { Executor } from "./types";

// OWNER: D+E. Every action type has an executor; the catalog reads this map.

export const EXECUTORS: Record<ActionType, Executor> = {
  ...scholarshipExecutors,
  ...githubExecutors,
  ...graphicExecutors,
  ...restaurantExecutors,
  ...genericExecutors,
};

export { ExecutorError } from "./types";
export type { ExecutorInput, ExecutorOutput } from "./types";
