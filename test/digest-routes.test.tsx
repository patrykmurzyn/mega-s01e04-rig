import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import type { NightDigest } from '../src/digest/types.js';

const night = '2026-10-28';
const config = (runsDir: string) => ({
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir,
});

function tableRows(html: string) {
  const body = html.match(/<tbody>(.*?)<\/tbody>/s)?.[1];
  if (!body) throw new Error('digest table body was not rendered');

  return [...body.matchAll(/<tr>(.*?)<\/tr>/gs)].map(([, row]) =>
    [...row.matchAll(/<td(?: class="([^"]*)")?>(.*?)<\/td>/gs)].map(([, className, content]) => ({
      className: className ?? '',
      text: content,
    })),
  );
}

describe('digest routes', () => {
  let runsDir: string;

  beforeEach(() => {
    runsDir = fs.mkdtempSync(join(tmpdir(), 'rig-routes-'));
    vi.stubEnv('LANE_MARKER', 'ROUTE-TEST-MARKER');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(runsDir, { recursive: true, force: true });
  });

  it('serves the same ordered rows and values as HTML and JSON', async () => {
    fs.writeFileSync(join(runsDir, `${night}.jsonl`), [
      JSON.stringify({ at: '2026-10-29T02:15:00+01:00', job: 'zeta', status: 'ok', owner: 'ops' }),
      JSON.stringify({ at: '2026-10-29T01:00:00-04:00', job: 'alpha', status: 'retry', owner: null, error: 'temporary' }),
      JSON.stringify({ at: '2026-10-29T01:10:00-04:00', job: 'alpha', status: 'retry', owner: null }),
      'not json',
      JSON.stringify({ at: '2026-10-29T01:20:00-04:00', job: 'alpha', status: 'retry', owner: null }),
      JSON.stringify({ at: '2026-10-29T01:30:00-04:00', job: 'alpha', status: 'fail', owner: null, error: 'still down' }),
      JSON.stringify({ at: '2026-10-29T01:40:00-04:00', job: 'alpha', status: 'ok', owner: null }),
    ].join('\n'));

    const app = createApp(config(runsDir));
    const [htmlResponse, jsonResponse] = await Promise.all([
      app.request(`/digest/${night}`),
      app.request(`/api/digest/${night}`),
    ]);
    const html = await htmlResponse.text();
    const digest = await jsonResponse.json() as NightDigest;

    expect(htmlResponse.status).toBe(200);
    expect(jsonResponse.status).toBe(200);
    expect(html).toContain('ROUTE-TEST-MARKER');
    expect(digest).toEqual({
      badLines: 1,
      statusCounts: { ok: 2, retry: 3, fail: 1 },
      rows: [
        {
          job: 'alpha', owner: null, runs: 5, retries: 3, failures: 1, lastStatus: 'ok',
          lastError: 'still down', firstAt: '2026-10-29T01:00:00-04:00', lastAt: '2026-10-29T01:40:00-04:00',
        },
        {
          job: 'zeta', owner: 'ops', runs: 1, retries: 0, failures: 0, lastStatus: 'ok',
          lastError: null, firstAt: '2026-10-29T02:15:00+01:00', lastAt: '2026-10-29T02:15:00+01:00',
        },
      ],
    });

    const rows = tableRows(html);
    expect(rows.map((row) => row[0].text)).toEqual(digest.rows.map((row) => row.job));
    expect(rows).toEqual(digest.rows.map((row) => [
      { className: '', text: row.job },
      { className: '', text: row.owner ?? '—' },
      { className: '', text: String(row.runs) },
      { className: row.retries >= 3 ? 'warn' : '', text: String(row.retries) },
      { className: row.failures > 0 ? 'warn' : '', text: String(row.failures) },
      { className: row.failures > 0 ? 'warn' : '', text: row.lastStatus },
      { className: '', text: row.lastError ?? '—' },
      { className: '', text: row.firstAt },
      { className: '', text: row.lastAt },
    ]));

    const [alpha, zeta] = rows;
    expect(alpha[3]).toEqual({ className: 'warn', text: '3' });
    expect(alpha[4]).toEqual({ className: 'warn', text: '1' });
    expect(alpha[5]).toEqual({ className: 'warn', text: 'ok' });
    expect(zeta.every((cell) => cell.className === '')).toBe(true);
  });

  it('returns 404 from both routes when a night file is missing', async () => {
    const app = createApp(config(runsDir));
    const [htmlResponse, jsonResponse] = await Promise.all([
      app.request(`/digest/${night}`),
      app.request(`/api/digest/${night}`),
    ]);

    expect(htmlResponse.status).toBe(404);
    expect(jsonResponse.status).toBe(404);
  });

  it('renders an existing empty night in both formats', async () => {
    fs.writeFileSync(join(runsDir, `${night}.jsonl`), '');
    const app = createApp(config(runsDir));
    const [htmlResponse, jsonResponse] = await Promise.all([
      app.request(`/digest/${night}`),
      app.request(`/api/digest/${night}`),
    ]);

    expect(htmlResponse.status).toBe(200);
    expect(await htmlResponse.text()).toContain('nothing ran');
    expect(jsonResponse.status).toBe(200);
    expect(await jsonResponse.json()).toEqual({ rows: [], badLines: 0, statusCounts: { ok: 0, retry: 0, fail: 0 } });
  });

  it('returns 404 for malformed night identifiers', async () => {
    const app = createApp(config(runsDir));
    const [htmlResponse, jsonResponse] = await Promise.all([
      app.request('/digest/not-a-date'),
      app.request('/api/digest/not-a-date'),
    ]);

    expect(htmlResponse.status).toBe(404);
    expect(jsonResponse.status).toBe(404);
  });

  it('does not turn non-ENOENT filesystem errors into missing-night responses', async () => {
    const runsPathFile = join(runsDir, 'not-a-directory');
    fs.writeFileSync(runsPathFile, '');
    const app = createApp(config(runsPathFile));

    const response = await app.request(`/api/digest/${night}`);
    expect(response.status).toBe(500);
  });
});
