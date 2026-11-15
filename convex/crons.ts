import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("auto-sync import sources", { minutes: 30 }, internal.maintenance.syncAllSources, {});
crons.interval("requeue stuck items", { minutes: 10 }, internal.maintenance.requeueStuck, {});

export default crons;
