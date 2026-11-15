import { v } from "convex/values";
import { internalAction } from "./_generated/server";

// OWNER: Thread B+C. Placeholder entry point so items.create / items.retry
// can schedule ingestion today. B+C replaces the body: fetch the source,
// analyze it (convex/analysis.ts), and move extractionStatus through
// extracting -> analyzing -> ready | needs_input | failed via
// internal.items.setExtraction. Keep the export name and args.
export const run = internalAction({
  args: { itemId: v.id("savedItems") },
  handler: async () => {
    return null;
  },
});
