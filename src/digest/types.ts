export type RunStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  // Owner of the latest event, including an explicit null.
  owner: string | null;
  // Each valid event is one run; retries and failures are subsets of runs.
  runs: number;
  retries: number;
  failures: number;
  lastStatus: RunStatus;
  // Most recent supplied error, retained even after a later successful run.
  lastError: string | null;
  // Chronological bounds, retaining the original strings and their offsets.
  firstAt: string;
  lastAt: string;
};

export type NightDigest = {
  // Deterministic ascending job order (JavaScript string/code-unit comparison).
  rows: DigestRow[];
  // Nonempty lines with invalid JSON or an invalid event shape.
  badLines: number;
  // Counts of all valid events, rather than counts of final job statuses.
  statusCounts: Record<RunStatus, number>;
};

/**
 * Implemented by the named readNight export in src/digest/read-night.ts.
 * Reads runsDir/<night>.jsonl synchronously. night must match YYYY-MM-DD;
 * invalid identifiers throw TypeError before filesystem access.
 * Returns null only for ENOENT; an empty file returns an empty NightDigest.
 * Other filesystem errors propagate. Blank lines are ignored.
 * Latest status, owner, and supplied error use chronological event order;
 * equal timestamps use file order. Original timestamp offsets are preserved.
 */
export type ReadNight = (runsDir: string, night: string) => NightDigest | null;
