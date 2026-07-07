import { recomputeAllMemberLineage } from "../src/lib/lineage-recompute.server";

console.log("Recomputing lineage for all members (2 passes)…");
await recomputeAllMemberLineage();
console.log("Done.");
