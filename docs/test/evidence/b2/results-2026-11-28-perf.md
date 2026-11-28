# B2 run: PERF-01 of B2 and of B1 on staging 4b038fe, 28 November 2026

Tester: Dũng, with Claude Code driving Chrome. These are working notes and raw results, not the B2 report. Times are UTC; Vietnam time is UTC+7. Lâm's bot asked on 28 November 2026 for "PERF-01b–h rerun once your connection to staging is normal, with ≥ 4 s between dashboard loads". B2's PERF-01c–f was deferred in [results-2026-11-28-4b038fe.md](results-2026-11-28-4b038fe.md#perf-01-not-rerun-yet-slow-test-connection) for the same slow connection, and runs here too.

## Build and setup

| Item | Value |
| --- | --- |
| Server | Staging, https://stag-omnicourses.lamter.cc |
| Build | Staging `4b038fe` (#246), deploy [run 46122049317](https://github.com/LLaammTTeerr/omnicourses/actions/runs/46122049317) at 07:37Z. `git ls-remote origin refs/heads/staging` gave `4b038fe` at 10:16:50Z, before the runs, and at 11:09:57Z, after them. |
| Connection | Normal again: B2's PERF-01b at 11:00Z gave `/api/health` 94–111 ms under the profile, as on the morning of 28 November (109–123 ms); at 09:22Z it had been 185–199 ms. |
| Browser | Chrome 144.0.7559.110, **headed**, through playwright-core 1.64.1, with the network profile of each case (50 ms, 1.25 MB/s down, 0.25 MB/s up). Both scripts now launch Chrome with `--disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-background-timer-throttling`, so that a display that sleeps (the session ran remotely, nobody at the screen) does not stop the animation frames the stop conditions wait for. A helper meant to keep the display awake failed to start (a PowerShell type error) and had no effect. |
| Server load | The two series ran one after the other, 10:16–11:10Z, with no other run of ours on staging. Whether a teammate used staging then is not known. |

## Results

### TC-B2-PERF-01a–f, 10:59:30–11:09:57Z

`a-perf-01.mjs`, unchanged but for the Chrome switches above. Account Q (`b2-s7`), plan "PERF-01" with the fixture's board. Outputs: `a-perf-01-prep-4b038fe-output.txt`, `a-perf-01a-4b038fe-output.txt`, `a-perf-01b-4b038fe-output.txt`, `a-perf-01c-4b038fe-output.txt` (V), `a-perf-01d-4b038fe-output.txt` (P), `a-perf-01e-4b038fe-output.txt` (C), `a-perf-01f-setup-4b038fe-output.txt`, `a-perf-01f-4b038fe-output.txt` (O), `a-perf-01f-cleanup-4b038fe-output.txt`. Medians are the usual ones (the mean of the 15th and 16th of 30); the scripts' output prints the lower median. "PUT" and "GET" are the median request times of the edit's save and check, network included.

| ID | Result | What happened |
| --- | --- | --- |
| PERF-01a | passed | The fixture's 11 terms and 46 placements, no transcript, CS420 `null`; the board as saved "0 violations · 0 worth a look · 46 not recorded yet". V, P and C each drew their expected result and Ctrl+Z brought the saved board back (`a-perf-01-v-2026-11-28T10-59-45-469Z.json`, `a-perf-01-p-2026-11-28T10-59-50-016Z.json`, `a-perf-01-c-2026-11-28T10-59-54-359Z.json`). |
| PERF-01b | passed | `/api/health` ×10: 94.2–111.2 ms, each at least 50 ms. |
| PERF-01c | **failed** | V: median **290.6 ms**, p95 318.5, max 319.0, min 264.4; **8 of 30** at or over 300 ms. PUT 137.4, GET 107.7 (`a-perf-01-v-2026-11-28T11-02-28-511Z.json`). |
| PERF-01d | **failed** | P: median **295.8 ms**, p95 328.8, max 328.9, min 268.4; **12 of 30**. PUT 139.6, GET 107.8 (`a-perf-01-p-2026-11-28T11-04-55-417Z.json`). |
| PERF-01e | **failed** | C: median **330.1 ms**, p95 344.1, max 351.9, min 304.4; **30 of 30**. PUT 157.1, GET 136.2 (`a-perf-01-c-2026-11-28T11-07-22-413Z.json`). |
| PERF-01f | **failed** | Setup: CS420 `[1, 2]` (**200**), board as saved "45 not recorded yet". O: median **316.4 ms**, p95 339.7, max 544.3, min 296.8; **29 of 30**. PUT 153.6, GET 121.6 (`a-perf-01-o-2026-11-28T11-09-56-032Z.json`). Clean-up **200**, CS420 `null` again. |

Every run drew its expected result; none was void (no 429, no `issues-failed`, every stop condition within 20 s, every undo back to the saved board). The same failures as on `778d120`, for the same reason: the save and the check are two round trips in a row ([#248](https://github.com/LLaammTTeerr/omnicourses/issues/248)).

### TC-B1-PERF-01b–h, 10:16:51–10:58:21Z

`b1-regression/r28/perf-01-r28.mjs` (B1 cases 0.12: the dashboard's expected values are the figures it still shows; on pacing, see below), with `B1_EMAIL=b1-run-r28c-perf@example.com`, the P account the B1 regression made on 28 November (`b1-regression/r28/p-setup-perf-output.txt`). Output `b1-regression/r28/perf-01-r28-rerun-output.txt`, every duration in `b1-regression/r28/perf-01-2026-11-28T10-16-51-993Z.json`. PERF-01a passed earlier the same day ([results-b1-regression-2026-11-28.md](results-b1-regression-2026-11-28.md#4-tc-b1-perf-01-dashboard-and-audit-load-time)).

| ID | Result | What happened |
| --- | --- | --- |
| PERF-01b | passed | `/api/health` ×10: 108–170 ms, each at least 50 ms; the largest JavaScript file 31,860 bytes, 157 ms. |
| PERF-01c | passed | Dashboard, cold cache: 5 runs, median 795 ms, max 897 ms. |
| PERF-01d | **blocked by [#255](https://github.com/LLaammTTeerr/omnicourses/issues/255)** | Dashboard, warm cache: all 5 warm-ups and 30 runs timed out at 30 s. Not a slow page: the series signs in, opens the dashboard and reloads at once, while the first page's session refresh is still in flight; that reload signs the student out (#255), and every later reload stays on `/sign-in`. `warm-start-probe-r28.mjs` repeated that start 3 times per page under the profile, in headless Chrome (it measures no time): 2 of 6 reloads landed on `/sign-in` after `POST /api/auth/refresh` **failed `net::ERR_ABORTED`**, then **401** (`b1-regression/r28/warm-start-probe-r28-output.txt`). Without such an immediate reload, dashboard reloads draw every time (`perf-01-timeout-probe-settled-r28-output.txt`, until the 429 that #254 explains). |
| PERF-01e | passed | Dashboard in-app from **Guides**: 30 runs, median 147 ms, max 169 ms. |
| PERF-01f | **failed** | Audit, cold cache: 5 runs, median 1,343 ms, max **2,636 ms**; **2 of 5** at or over 2 s. Each cold run is a new context with an empty cache under the profile; the morning's attempt (below) had all 5 under 2 s (max 939 ms). The connection was slower during this series than at B2's PERF-01b: this series' own PERF-01b read health 108–170 ms, and its largest JavaScript file took 157 ms against about 75 ms predicted. Each timed load also started right after the sign-in's landing dashboard, whose 7 audit requests (#254) may still have been on the server (see pacing below). A run of 2 s or more fails the case and stays in the report (performance procedure, step 4). Filed as [#261](https://github.com/LLaammTTeerr/omnicourses/issues/261); it is rerun once #258 (one audit request per dashboard load) is on staging. |
| PERF-01g | **blocked by #255** | Audit, warm cache: all 35 timed out, as in d. |
| PERF-01h | passed | Audit in-app from **Guides**: 30 runs, median 144 ms, max 152 ms. |

**Decision (Lâm, 28 November).** d and g stay **blocked by #255** and are retested once its fix, #257 (`613f9f9`, on `main`), reaches staging; staging still served `4b038fe` after the run. The case does not change.

**Pacing: a deviation from the case.** B1 cases 0.12 ask for at least 4 s between any two dashboard loads. The script's `PACE_MS` spaces only the timed runs:

- Sign-in lands on `/dashboard`, and `signIn()` returns as soon as the address leaves `/sign-in`. In c, each cold timed dashboard load starts right after that landing load: two dashboard loads less than 4 s apart, 14 audit requests. In f, the timed `/audit` load starts while the landing dashboard's 7 audit requests may still be on the server.
- `warm()` opens the page and reloads at once, which is the pair that meets #255.
- The JSON has no per-run timestamps or HTTP status codes, so neither the pacing nor "no 429, none void" can be checked from it.

The c pass stands: every run drew every value in under 2 s, and a 429 could only void a run, not make it pass. For the retest, `signIn()` waits for the landing dashboard to draw and starts the 4 s from there, `warm()` starts it after its opening page load, and the script records each API request's status code.

### Attempts not kept

- **B1, attempt 1 (09:44Z):** the script's default account `b1-perf@example.com` answered **401** on staging (it is not a B2 account), so the run stopped after PERF-01b; nothing was written to staging.
- **B1, attempt 2 (09:45:42–10:11:41Z):** with the r28c account and without the Chrome switches. b, c (median 859 ms), e (140 ms), f (median 792 ms, max 939 ms, all under 2 s), g (median 525 ms, max 573 ms) and h (123 ms) passed; d timed out on all 35 reloads. The display sleeping was suspected first; attempt 3 (recorded) shows d and g failing with the switches on, and the probe shows the #255 race, which a series meets or not by chance at its start.
- **B2, 09:22Z:** `prep` and `b` only, on the slow connection; recorded in [results-2026-11-28-4b038fe.md](results-2026-11-28-4b038fe.md#perf-01-not-rerun-yet-slow-test-connection).

The outputs of these attempts are kept outside git (`docs/test/README.md`).

## Test data

Q keeps "PERF-01" with the fixture's board. CS420's offering terms are `null` (PERF-01f's clean-up). P (`b1-run-r28c-perf`) keeps the completion fixture. The probe signed P in six times and changed nothing.
