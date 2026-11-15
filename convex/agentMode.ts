"use node";

import { CommandExitError, Sandbox } from "e2b";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { buildRunRepoResult, runRepoInSandbox, type Runner } from "./lib/runRepo";

// Agent mode: "Run it for me" on a GitHub save, in an E2B sandbox.
// Started by agentRuns.startRunRepo; reuses actions.startRun/completeRun/failRun.

export const runRepo = internalAction({
  args: { executionId: v.id("actionExecutions") },
  handler: async (ctx, { executionId }) => {
    const input = await ctx.runMutation(internal.actions.startRun, { executionId, now: Date.now() });
    if (!input) return null;
    const apiKey = process.env.E2B_API_KEY;
    if (!apiKey) {
      await ctx.runMutation(internal.actions.failRun, { executionId, error: "Run it for me isn't configured on this server." });
      return null;
    }
    let sbx: Sandbox | null = null;
    try {
      sbx = await Sandbox.create({ apiKey, timeoutMs: 5 * 60_000 });
      const sandbox = sbx;
      const runner: Runner = async (command, opts) => {
        const started = Date.now();
        try {
          const r = await sandbox.commands.run(command, { cwd: opts?.cwd, timeoutMs: opts?.timeoutMs ?? 60_000 });
          return { command, exitCode: r.exitCode, stdout: r.stdout, stderr: r.stderr, durationMs: Date.now() - started };
        } catch (error) {
          if (error instanceof CommandExitError) {
            return { command, exitCode: error.exitCode, stdout: error.stdout, stderr: error.stderr, durationMs: Date.now() - started };
          }
          const message = error instanceof Error ? error.message : String(error);
          return { command, exitCode: -1, stdout: "", stderr: `Command did not finish: ${message}`, durationMs: Date.now() - started };
        }
      };
      const report = await runRepoInSandbox(runner, input.item.sourceUrl ?? "");
      await ctx.runMutation(internal.actions.completeRun, { executionId, result: buildRunRepoResult(report), status: "succeeded" });
    } catch (error) {
      console.error("run_repo failed", error);
      await ctx.runMutation(internal.actions.failRun, { executionId, error: "The sandbox couldn't start. Please try again." });
    } finally {
      await sbx?.kill().catch(() => {});
    }
    return null;
  },
});
