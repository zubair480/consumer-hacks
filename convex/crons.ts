import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("embed recent saves", { minutes: 1 }, internal.similar.sweepRecent, {});

export default crons;
