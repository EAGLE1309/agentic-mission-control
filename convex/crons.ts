import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { STUCK_SWEEP_MINUTES } from "../src/shared/constants";

const crons = cronJobs();

// No mission stays active forever (tech spec §11).
crons.interval("fail stuck missions", { minutes: STUCK_SWEEP_MINUTES }, internal.engine.state.sweepStuck, {});

// Free models change often (tech spec §7.2).
crons.interval("refresh model catalog", { hours: 24 }, internal.catalog.refresh, {});

export default crons;
