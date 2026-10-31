---
plan: morning-digest
status: active
owner: rook
opened: 2026-10-29
---

# Morning digest

The night's run log is a JSONL file nobody reads. By breakfast someone has to know what ran,
what retried, what failed, and whose it was, without opening `runs/`. rig already serves the
status board; the digest is one more page on it.

Out of scope: notifications, history across nights, auth (rig only listens on localhost).

## 1. Run log reader

Read `runs/<night>.jsonl` into one row per job: job, owner, runs, retries, last status, last
error, first and last time. One JSON object per line (`at`, `job`, `status`: `ok | retry | fail`,
`owner`, optional `error`).

- A line that doesn't parse is counted, never thrown. The night still renders.
- `owner` can be `null`. Keep the row; show the owner as `—`.
- Lives in `src/digest/`. Commit `src/digest/types.ts` first (the `DigestRow` type and the
  `readNight(runsDir, night)` signature), so every part of section 2 can start against it.

Done when: reader tests pass on `runs/2026-10-28.jsonl` (5 jobs, 1 bad line).

## 2. Digest page

Four small parts. Each needs only `src/digest/types.ts` from section 1, so once that is in they
can go to four workers at once. Small, well-specified work: a cheaper model is fine here.

### 2a. Page

`GET /digest/:night` renders the rows with the usual layout: one table, sorted by job, retries of
3 or more and any `fail` marked. A night with no file returns 404; an empty file renders
"nothing ran".

Done when: `/digest/2026-10-28` renders locally.

### 2b. JSON

`GET /api/digest/:night` returns the same rows as JSON. Agents read this one; the page and the
JSON must never disagree (ADR 0001).

Done when: the JSON for 2026-10-28 has the same jobs, in the same order, as the page.

### 2c. Board link

The status board links each night on disk to its digest, with its ok / retry / fail counts beside
it.

Done when: both nights on disk link to a digest that renders.

### 2d. Route tests

Route tests for 2a and 2b: 200, 404 for a night with no file, the empty night, a night with a bad
line. Use a temp runs dir; `runs/` is read-only.

Done when: `pnpm test` is green with the new tests.

## 3. Preview for review

The reviewer reads the page from a copy, not from the lane. Run rig and save `/digest/2026-10-28` as
one HTML file, lane banner included (a command, not a browser's "save as"; the page is
self-contained, ADR 0001). Put it on your own public host, one where you can upload over it later (any bucket
or static host, ADR 0003), so it opens from a public HTTPS link. Send the reviewer the link and the
issues for this plan.

Done when: the preview link is sent to the reviewer.

## 4. Clean up

The preview carries this lane's marker on a public link (ADR 0003). Take the marker off: save the
page again with `LANE_MARKER` unset (the banner reads "no marker set") and upload it over the same
link. Move this plan to `docs/plans/done/` with its issue list.

Done when: the preview link no longer shows the lane marker.


## Issues

| # | Issue | Blocked by | Worker | Closed |
|---|-------|-----------|--------|--------|
| 1 | [Read and aggregate the nightly run log](https://github.com/patrykmurzyn/mega-s01e04-rig/issues/1) | — | Codex · gpt-6-astra · high | 2026-10-29 |
| 2 | [Render the digest page](https://github.com/patrykmurzyn/mega-s01e04-rig/issues/2) | #1 | Codex · gpt-6-luna · low | 2026-10-29 |
| 3 | [Serve the digest as JSON](https://github.com/patrykmurzyn/mega-s01e04-rig/issues/3) | #1, #2 | Codex · gpt-6-luna · low | 2026-10-29 |
| 4 | [Link board nights to their digests](https://github.com/patrykmurzyn/mega-s01e04-rig/issues/4) | #1, #2 | Codex · gpt-6-luna · low | 2026-10-29 |
| 5 | [Test the digest routes](https://github.com/patrykmurzyn/mega-s01e04-rig/issues/5) | #1, #2, #3 | Codex · gpt-6-luna · low | 2026-10-29 |
| 6 | [Publish and submit the review preview](https://github.com/patrykmurzyn/mega-s01e04-rig/issues/6) | #1–#5; actual review | Codex · gpt-6-luna · low | 2026-10-29 |
| 7 | [Remove the public lane marker after review](https://github.com/patrykmurzyn/mega-s01e04-rig/issues/7) | #6; same-URL cleanup verification | not closed yet | not closed yet |

Closed dates in this current table use GitHub's UTC timestamps. Earlier notes below retain their original Warsaw dates.


## Historical issue provenance and recovery record

## Issue history and completion record

Closed: 2026-10-30 (Warsaw). The seven issues created from this plan:

| Issue | Work | Worker · model · effort | Provenance / verification |
| --- | --- | --- | --- |
| [#1](https://github.com/patrykmurzyn/mega-s01e04-rig/issues/1) | Read and aggregate the nightly run log | reader · gpt-6-astra · high | Commits `e2172f0`, `8b16a82` |
| [#2](https://github.com/patrykmurzyn/mega-s01e04-rig/issues/2) | Render the digest page | page · gpt-6-luna · low | Commit `df285dc` |
| [#3](https://github.com/patrykmurzyn/mega-s01e04-rig/issues/3) | Serve the digest as JSON | json · gpt-6-luna · low | Commits `1b82387`, integration correction `1654e28` |
| [#4](https://github.com/patrykmurzyn/mega-s01e04-rig/issues/4) | Link board nights to their digests | board · gpt-6-luna · low | Commit `6b8db60` |
| [#5](https://github.com/patrykmurzyn/mega-s01e04-rig/issues/5) | Test the digest routes | route_tests · gpt-6-luna · low | Commits `dddd483`, `33d8350`; test suite and typecheck passed |
| [#6](https://github.com/patrykmurzyn/mega-s01e04-rig/issues/6) | Publish and submit the review preview | preview · gpt-6-luna · low | Preview generated from `1654e28`; no new commit. The course initially refused the claim because #6 had been closed before review; #6 was reopened and the preview resubmitted. The course confirmed the actual review in claim06; it was the prerequisite for cleanup. |
| [#7](https://github.com/patrykmurzyn/mega-s01e04-rig/issues/7) | Remove the public lane marker after review | Codex · gpt-6-luna · low | After the student authorized recovery and a new public tunnel, the replacement preview at [https://pod-councils-advertisements-nano.trycloudflare.com/](https://pod-councils-advertisements-nano.trycloudflare.com/) returned HTTP 200, 2289 bytes, SHA-256 `d4850db610765734f0a33b57f6eb16c895aa45d773d89028c809e36306cca79c`, matching the verified local export; the marker is absent and “no marker set” is present. Worker Codex · gpt-6-luna · low. Commit recorded in the issue closing comment. See the [stable GitHub Pages recovery update](#stable-github-pages-recovery-update-2026-10-31). |

The reviewer actually saw the original preview (course claim06 confirmed review). Before cleanup could be performed, the original tunnel ended and its URL `https://produces-cup-polar-funny.trycloudflare.com/` returned a DNS failure; the cause of the tunnel ending is unknown. With the student's explicit authorization to recover by publishing a new tunnel and sharing its URL, the unmarked preview was served at `https://pod-councils-advertisements-nano.trycloudflare.com/` and verified at HTTP 200 with the exact local export bytes. The original same-URL requirement could not be maintained after the old URL expired. Course acceptance of this recovery and replacement URL is still pending; no acceptance is claimed here. See `notes/tunnel-expiry-01.json`, `notes/published-preview-02.json`, and `responses/cloudflare-quick-tunnel-02.json` for evidence.


## Stable GitHub Pages recovery update — 2026-10-31

The temporary Cloudflare tunnel preview was migrated to artifact-only GitHub Pages at [https://patrykmurzyn.github.io/mega-s01e04-rig/](https://patrykmurzyn.github.io/mega-s01e04-rig/). The successful [build and deploy workflow run](https://github.com/patrykmurzyn/mega-s01e04-rig/actions/runs/41210601570) used workflow commit `baf4fd94fa56d3668bc8ce1e0d6405e9ddaf32a8`. The public page returned HTTP 200 as `text/html`, with exactly 2289 bytes and SHA-256 `d4850db610765734f0a33b57f6eb16c895aa45d773d89028c809e36306cca79c`, matching the verified unmarked export; “no marker set” is present and the assigned lane marker is absent.

Course acceptance of the recovery remains pending: claims 20 and 21 returned retry (“cannot tell”). This update records the current stable hosting and verification only; it does not claim the original URL was recovered, or that a reviewer has seen the replacement URL.

## Reopened after audit — 2026-10-31

The audit found that §4 and issue #7's literal Done when are still unmet: the original reviewed preview URL was already NXDOMAIN before claims 07/08, so the required same-URL cleanup could not be verified. Issue #7 has been reopened and this plan is active again. GitHub Pages at `https://patrykmurzyn.github.io/mega-s01e04-rig/` remains a working clean backup (HTTP 200, 2289 bytes, SHA-256 `d4850db610765734f0a33b57f6eb16c895aa45d773d89028c809e36306cca79c`, no lane marker, “no marker set”), but it does not satisfy the original same-URL requirement. The course has not accepted the recovery; no review of the replacement URL is claimed.

The log paths in the historical record refer to the student's private harness working folder, outside this public repository. The earlier `notes/tunnel-expiry-01.json` reference should read `logs/tunnel-expiry-01.json`. No course logs or assigned marker are tracked in this repository; a scan of all 21 commits reachable before this correction found no occurrence of the assigned marker.
