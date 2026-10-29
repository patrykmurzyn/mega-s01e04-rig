import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readNight } from '../src/digest/read-night.js';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, readFileSync: vi.fn(actual.readFileSync) };
});

const night = '2026-10-28';
const validEvent = { at: '2026-10-29T01:00:00+01:00', job: 'job', status: 'ok', owner: null };

describe('readNight', () => {
  let runsDir: string;

  beforeEach(() => {
    runsDir = fs.mkdtempSync(join(tmpdir(), 'rig-reader-'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(runsDir, { recursive: true, force: true });
  });

  function writeEvents(events: unknown[]) {
    fs.writeFileSync(join(runsDir, `${night}.jsonl`), events.map((event) => JSON.stringify(event)).join('\n'));
  }

  it('aggregates the provided night into five sorted jobs with one bad line', () => {
    const fixtureDir = fileURLToPath(new URL('../runs/', import.meta.url));
    const digest = readNight(fixtureDir, night);

    expect(digest?.badLines).toBe(1);
    expect(digest?.statusCounts).toEqual({ ok: 10, retry: 4, fail: 1 });
    expect(digest?.rows).toEqual([
      { job: 'digest/render', owner: null, runs: 1, retries: 0, failures: 0, lastStatus: 'ok', lastError: null,
        firstAt: '2026-10-29T05:41:09+01:00', lastAt: '2026-10-29T05:41:09+01:00' },
      { job: 'fixtures/refresh', owner: 'rook', runs: 4, retries: 3, failures: 0, lastStatus: 'ok', lastError: 'upstream 503',
        firstAt: '2026-10-29T01:30:00+01:00', lastAt: '2026-10-29T01:37:00+01:00' },
      { job: 'lane/sync', owner: 'rook', runs: 8, retries: 1, failures: 0, lastStatus: 'ok', lastError: 'lock held',
        firstAt: '2026-10-28T23:00:06+01:00', lastAt: '2026-10-29T05:00:04+01:00' },
      { job: 'notes/backup', owner: 'lane-07', runs: 1, retries: 0, failures: 1, lastStatus: 'fail', lastError: 'quota exceeded',
        firstAt: '2026-10-29T04:00:01+01:00', lastAt: '2026-10-29T04:00:01+01:00' },
      { job: 'rig/rotate-logs', owner: 'lane-07', runs: 1, retries: 0, failures: 0, lastStatus: 'ok', lastError: null,
        firstAt: '2026-10-28T23:00:02+01:00', lastAt: '2026-10-28T23:00:02+01:00' },
    ]);
  });

  it('distinguishes an absent night from an existing empty night', () => {
    expect(readNight(runsDir, night)).toBeNull();
    fs.writeFileSync(join(runsDir, `${night}.jsonl`), '');
    expect(readNight(runsDir, night)).toEqual({ rows: [], badLines: 0, statusCounts: { ok: 0, retry: 0, fail: 0 } });
  });

  it('counts invalid JSON and invalid event shapes while ignoring blank lines', () => {
    const invalidEvents = [null, [], 'text', 4, {},
      { ...validEvent, at: 'not a date' },
      { ...validEvent, at: '2026-10-29T01:00:00' },
      { ...validEvent, job: '' },
      { ...validEvent, status: 'unknown' },
      { ...validEvent, owner: undefined },
      { ...validEvent, owner: 4 },
      { ...validEvent, error: null },
    ];
    const lines = [JSON.stringify(validEvent), '{broken', ...invalidEvents.map((event) => JSON.stringify(event)), '', '  '];
    fs.writeFileSync(join(runsDir, `${night}.jsonl`), lines.join('\r\n'));

    const digest = readNight(runsDir, night);
    expect(digest?.badLines).toBe(invalidEvents.length + 1);
    expect(digest?.rows).toHaveLength(1);
    expect(digest?.rows[0].runs).toBe(1);
    expect(digest?.statusCounts).toEqual({ ok: 1, retry: 0, fail: 0 });
  });

  it('uses chronological order across offsets and retains failures and errors after recovery', () => {
    writeEvents([
      { ...validEvent, at: '2026-10-29T02:00:00+00:00', owner: 'latest' },
      { ...validEvent, at: '2026-10-29T02:15:00+01:00', status: 'retry', error: 'new error' },
      { ...validEvent, at: '2026-10-29T01:30:00+01:00', status: 'fail', owner: 'earliest', error: 'old error' },
    ]);

    expect(readNight(runsDir, night)).toEqual({
      badLines: 0,
      statusCounts: { ok: 1, retry: 1, fail: 1 },
      rows: [{ job: 'job', owner: 'latest', runs: 3, retries: 1, failures: 1, lastStatus: 'ok', lastError: 'new error',
        firstAt: '2026-10-29T01:30:00+01:00', lastAt: '2026-10-29T02:00:00+00:00' }],
    });
  });

  it('breaks equal timestamp ties by file order and preserves an explicit null owner', () => {
    writeEvents([
      { ...validEvent, owner: 'first', status: 'fail', error: 'first' },
      { ...validEvent, at: '2026-10-29T00:00:00Z', status: 'retry', error: 'last' },
      { ...validEvent, at: '2026-10-29T00:00:00Z' },
    ]);
    expect(readNight(runsDir, night)?.rows[0]).toEqual({
      job: 'job', owner: null, runs: 3, retries: 1, failures: 1, lastStatus: 'ok', lastError: 'last',
      firstAt: validEvent.at, lastAt: '2026-10-29T00:00:00Z',
    });
  });

  it('uses deterministic job order and safely accepts object-property names as jobs', () => {
    writeEvents(['z', '__proto__', 'A', 'constructor', 'a'].map((job) => ({ ...validEvent, job })));
    expect(readNight(runsDir, night)?.rows.map(({ job }) => job)).toEqual(['A', '__proto__', 'a', 'constructor', 'z']);
  });

  it.each(['../2026-10-28', '/2026-10-28', '2026-10-28/..', '2026-10-28\\..', '2026-10-28.jsonl', ''])
    ('rejects unsafe or malformed night identifiers: %s', (input) => {
      expect(() => readNight(runsDir, input)).toThrow(TypeError);
    });

  it('propagates permission errors instead of treating them as an absent night', () => {
    const denied = Object.assign(new Error('Permission denied'), { code: 'EACCES' });
    vi.mocked(fs.readFileSync).mockImplementationOnce(() => { throw denied; });
    expect(() => readNight(runsDir, night)).toThrow(denied);
  });
});
