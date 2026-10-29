import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, NightDigest, ReadNight, RunStatus } from './types.js';

type RunEvent = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

type Aggregate = {
  row: DigestRow;
  firstTime: number;
  lastTime: number;
  lastErrorTime: number;
};

// Require an explicit offset so the displayed time never depends on the server's zone.
const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function isRunEvent(value: unknown): value is RunEvent {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const event = value as Record<string, unknown>;
  return (
    typeof event.at === 'string' &&
    timestampPattern.test(event.at) &&
    Number.isFinite(Date.parse(event.at)) &&
    typeof event.job === 'string' &&
    event.job.trim().length > 0 &&
    (event.status === 'ok' || event.status === 'retry' || event.status === 'fail') &&
    (event.owner === null || typeof event.owner === 'string') &&
    (event.error === undefined || typeof event.error === 'string')
  );
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) {
    throw new TypeError('night must match YYYY-MM-DD');
  }

  let contents: string;
  try {
    contents = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (error) {
    if (error !== null && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }

  const digest: NightDigest = { rows: [], badLines: 0, statusCounts: { ok: 0, retry: 0, fail: 0 } };
  const jobs = new Map<string, Aggregate>();

  for (const line of contents.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      digest.badLines++;
      continue;
    }
    if (!isRunEvent(value)) {
      digest.badLines++;
      continue;
    }

    const event = value;
    const time = Date.parse(event.at);
    digest.statusCounts[event.status]++;
    let aggregate = jobs.get(event.job);
    if (!aggregate) {
      aggregate = {
        row: {
          job: event.job,
          owner: event.owner,
          runs: 0,
          retries: 0,
          failures: 0,
          lastStatus: event.status,
          lastError: null,
          firstAt: event.at,
          lastAt: event.at,
        },
        firstTime: time,
        lastTime: time,
        lastErrorTime: -Infinity,
      };
      jobs.set(event.job, aggregate);
    }

    const { row } = aggregate;
    row.runs++;
    if (event.status === 'retry') row.retries++;
    if (event.status === 'fail') row.failures++;
    if (time < aggregate.firstTime) {
      aggregate.firstTime = time;
      row.firstAt = event.at;
    }
    if (time >= aggregate.lastTime) {
      aggregate.lastTime = time;
      row.lastAt = event.at;
      row.lastStatus = event.status;
      row.owner = event.owner;
    }
    if (event.error !== undefined && time >= aggregate.lastErrorTime) {
      aggregate.lastErrorTime = time;
      row.lastError = event.error;
    }
  }

  digest.rows = [...jobs.values()]
    .map(({ row }) => row)
    .sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return digest;
};
