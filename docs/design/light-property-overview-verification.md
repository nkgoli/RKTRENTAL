# Light property and unit overview verification

Scope: **Complete property and unit overview browser evidence** (test work kind).
Application implementation remains `89fce3685016b878b3688a0e3995e733362a8141`;
directory acceptance remains `82c224610bbcf61ceb7d28f5d073b910936d4c55`.
This Task's owned paths are `docs/design/light-property-overview-verification.md`
(this file), `docs/design/light-property-overviews.md` (preserved unchanged),
and `tests/workspace/native-review/`.

## Candidate and ancestry (observed this session)

- Work branch `orchestra/work-2gcjdifqik3o7helc0b-7ayz0cfdt4c2fcsyxpn`, HEAD now
  past `1f72f27adc9b2708c2c882187304afb87b169d3e` (the pending-state handoff).
- `git merge-base --is-ancestor` returned 0 for implementation
  `89fce3685016b878b3688a0e3995e733362a8141`, directory
  `82c224610bbcf61ceb7d28f5d073b910936d4c55`, and integrated merge
  `8f5f1be8980c0f138d8e922512328437773a4ee6`; all are contained in the work branch.
- Baseline for before/after: `4adfb9649c4fdf65c1ed07a0152a3038775c581c`. The
  measured source delta `4adfb96..HEAD` in the three overview files is 77
  insertions / 24 deletions, all from `89fce36` (overview header, glance band,
  unit cards/table, timeline/media/delete styling).

## Reused prior evidence (inherited, not rerun)

- Workspace tests: 9 files, 29 tests passed; `tsc --noEmit` passed; scoped ESLint
  passed; `npm.cmd run build` passed (from `TASK-4DAD8933`, preserved).
- New files in this Task were typechecked and linted directly: project
  `tsc --noEmit` passes with them, and ESLint `--max-warnings=0` passes on
  `tests/workspace/native-review/overview-review.spec.ts` and
  `review.playwright.config.ts`.

## Task-owned isolated runtime (implemented, measured)

All paths are task-owned; no shared checkout, shared client, sibling fixture,
or common `.next` was written.

| Purpose | Identity |
| --- | --- |
| Baseline source | `tests/workspace/native-review/.runtime/baseline/` = `git archive 4adfb96` (24 entries), `node_modules` via junction to the checkout install |
| Candidate source | `tests/workspace/native-review/.runtime/candidate-1f72f27/` = `git archive HEAD` (at `1f72f27`, contains `89fce36`), `node_modules` via junction |
| Baseline production build | `.next/BUILD_ID` = `GPkMC-fReltH7INFyPztO`, built with isolated env (dummy secret, `STORAGE_LOCAL_DIR=.runtime/storage-baseline`) |
| Candidate production build | `.next/BUILD_ID` = `EheygKX6UxTxKO1h1ktwh`, same isolated setup (`storage-candidate`) |
| Source snapshot hashes | 11 overview files, SHA-256, in `.runtime/review-config.json` and committed `tests/workspace/native-review/evidence/runtime-identity.json` |
| Isolated fixture | `.runtime/postgres/`, fresh `initdb` (PG 16, `PG_VERSION` present, superuser `rocketrental`, trust auth), port **55441**; no migrations/seeds applied yet |
| Ports | **3241** baseline, **3242** candidate, **55441** DB — all verified free (`Get-NetTCPConnection` shows zero listeners on all three) |
| Browser | Playwright Chromium (`chromium-1248` + headless shell + ffmpeg) in `.runtime/browsers/` (`PLAYWRIGHT_BROWSERS_PATH`) |
| Spec | `tests/workspace/native-review/overview-review.spec.ts` + `review.playwright.config.ts`; sign-in as `jordan.mills@rocketrental.example`, fixtures `seed-property-maple` (vacant `seed-unit-maple-7` = 3A, occupied `seed-unit-maple-11` = 4B), `seed-property-elm`; disposable `synth-ov-*` records created/removed by the spec |
| Harness | `tests/workspace/native-review/overview-review.ps1` (`Start`/`Launch`/`Status`/`Stop`) with snapshot, fixture, free-port, and recorded-process ownership guards; `-Action Status` exercised and returns the expected `No services have been recorded` guard |

Setup note: the checkout had no `node_modules`, so `npm.cmd install` (package-lock, `--cache` inside owned `.runtime/npm-cache`) and `npm.cmd install` in `prisma/` (embedded-postgres) were run; `prisma/package-lock.json` showed an 8-line collateral diff and was reverted with `git checkout`. Root `node_modules/` and `prisma/node_modules/` are gitignored build artifacts, unchanged in Git (`git status` clean apart from this Task's owned paths).

## Environment blocker: this sandbox denies all loopback binds

The live run (migrate + seed + `next start` on 3241/3242 + Playwright) cannot
execute in this session; nothing was started and no result is invented.

- `postgres.exe -D .runtime/postgres -p 55441 -h 127.0.0.1` exits immediately:
  `FATAL: could not create any TCP/IP sockets` after
  `could not listen on IPv4 address "127.0.0.1": Permission denied`
  (`.runtime/setup-postgres.stderr.log`).
- Minimal probe `node -e "net.createServer().listen(PORT,'127.0.0.1')"` fails with
  `EACCES` for ports 3000, 8000, ephemeral 0, on both `127.0.0.1` and `::1`.
- Consequence: `prisma migrate deploy`, the demo seed, `next start`, and the
  `overview-review.spec.ts` run all require a bind-capable session. The spec,
  both production builds, the initialized fixture, and the Chromium binaries are
  ready so that session can run: harness `Start` → `Status` (both `/sign-in`
  HTTP 200) → migrate/seed with `SEED_DEMO_PASSWORDS=1` → Playwright with
  `OVERVIEW_DATABASE_URL`/`OVERVIEW_BASELINE_URL=http://localhost:3241`/
  `OVERVIEW_CANDIDATE_URL=http://localhost:3242`/
  `OVERVIEW_STORAGE_DIR=<.runtime/storage-candidate>` →
  `... -Action Stop` → `Status` (zero listeners, `postmaster.pid` absent).
- Runtime release in this session: verified — zero listeners on 3241/3242/55441,
  no `postmaster.pid` in `.runtime/postgres/`, no `services.json` recorded,
  no desktop acquisition, no human contact.

## Remaining browser checklist (NOT RUN — no captures yet)

| Flow / state | Desktop | 390px phone | Status |
| --- | --- | --- | --- |
| Property overview navigation, glance band, payments, timeline, units | captures missing | captures missing | spec ready, needs live run |
| Occupied unit scope (`?unit=seed-unit-maple-11`), switcher, scoped tabs | not exercised | not exercised | spec ready |
| Vacant unit scope (`?unit=seed-unit-maple-7`), keyboard switcher nav | not exercised | not exercised | spec ready |
| Phone cards (≤640px) vs desktop table, keyboard focus, no overflow | missing | missing | spec ready |
| Inline edit cancel (seed 3A), validation, save (disposable `synth-ov-*`) | missing | — | spec ready |
| Add-unit on disposable property (incl. `Unit number is required`) | missing | — | spec ready |
| Guarded delete (dialog dismiss, no deletion) + implicit-unit guard | missing | — | spec ready |
| Media upload/cover/reorder/remove + preview-failure recovery | missing | — | spec ready |
| Baseline before-captures | missing | missing | spec ready |

## Partial manager native observations (distinct attribution, not builder results)

From the directory handoff, manager-supplied window **2026-10-19 23:26:39–23:30:54 UTC**
(existing Edge, desktop 1699×888, phone 390×844): created property's phone
overview showed 0/2 occupancy with empty rent/media; `scrollWidth 375 <= 390`;
Enter on Unit 1 opened `?unit=cmvfvy7ix000ab9gcreta4am2` with readable vacant
"Create lease" and scoped tabs; editing number to 99 then cancelling kept Unit 1;
Tab showed blue Status focus; delete opened a native confirmation but **no accept
was issued** — inspection/dismissal timed out, outcome unverified; fallback
Windows-MCP App switch was user-cancelled; candidate viewport reset and tab
cleanup unverified. Native existing-Edge and native file actions remain pending
until the manager coordinates a fresh grant.

## Limitations

- No desktop/390px captures and no affected-flow browser results exist yet; the
  checklist above is explicit, not a pass. The only new verified artifacts are
  the two isolated production builds, the initialized fixture, the exercised
  harness guards, typecheck/lint of the new files, and the release state.
- No push, deployment, Preview publication, or independent integration occurred.
  Sibling work, review fixtures, and prior passing checks are preserved.
