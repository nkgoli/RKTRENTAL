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
| Ports | **3241** baseline, **3242** candidate, **55441** DB â€” all verified free (`Get-NetTCPConnection` shows zero listeners on all three) |
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
  ready so that session can run: harness `Start` â†’ `Status` (both `/sign-in`
  HTTP 200) â†’ migrate/seed with `SEED_DEMO_PASSWORDS=1` â†’ Playwright with
  `OVERVIEW_DATABASE_URL`/`OVERVIEW_BASELINE_URL=http://localhost:3241`/
  `OVERVIEW_CANDIDATE_URL=http://localhost:3242`/
  `OVERVIEW_STORAGE_DIR=<.runtime/storage-candidate>` â†’
  `... -Action Stop` â†’ `Status` (zero listeners, `postmaster.pid` absent).
- Runtime release in this session: verified â€” zero listeners on 3241/3242/55441,
  no `postmaster.pid` in `.runtime/postgres/`, no `services.json` recorded,
  no desktop acquisition, no human contact.

## Remaining browser checklist (NOT RUN â€” no captures yet)

| Flow / state | Desktop | 390px phone | Status |
| --- | --- | --- | --- |
| Property overview navigation, glance band, payments, timeline, units | captures missing | captures missing | spec ready, needs live run |
| Occupied unit scope (`?unit=seed-unit-maple-11`), switcher, scoped tabs | not exercised | not exercised | spec ready |
| Vacant unit scope (`?unit=seed-unit-maple-7`), keyboard switcher nav | not exercised | not exercised | spec ready |
| Phone cards (â‰¤640px) vs desktop table, keyboard focus, no overflow | missing | missing | spec ready |
| Inline edit cancel (seed 3A), validation, save (disposable `synth-ov-*`) | missing | â€” | spec ready |
| Add-unit on disposable property (incl. `Unit number is required`) | missing | â€” | spec ready |
| Guarded delete (dialog dismiss, no deletion) + implicit-unit guard | missing | â€” | spec ready |
| Media upload/cover/reorder/remove + preview-failure recovery | missing | â€” | spec ready |
| Baseline before-captures | missing | missing | spec ready |

## Partial manager native observations (distinct attribution, not builder results)

From the directory handoff, manager-supplied window **2026-10-19 23:26:39â€“23:30:54 UTC**
(existing Edge, desktop 1699Ã—888, phone 390Ã—844): created property's phone
overview showed 0/2 occupancy with empty rent/media; `scrollWidth 375 <= 390`;
Enter on Unit 1 opened `?unit=cmvfvy7ix000ab9gcreta4am2` with readable vacant
"Create lease" and scoped tabs; editing number to 99 then cancelling kept Unit 1;
Tab showed blue Status focus; delete opened a native confirmation but **no accept
was issued** â€” inspection/dismissal timed out, outcome unverified; fallback
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

## Takeover observation â€” 2026-10-20 00:20â€“00:23 UTC

This section supersedes the earlier environment-blocker/readiness statements;
those statements describe the previous attempt, not current runtime readiness.
At takeover HEAD was `396f27995085a059d1910c878c35aa07c7e9d0a4`, tree clean.
Both required implementation and directory commits were confirmed ancestors
(exit 0 each). Existing builds were reused without rebuilding.

- Loopback ephemeral bind now succeeds. The harness repository root was one
  level too shallow; corrected to `../../..`. CIM hidden launch failed with
  access denied; replaced with hidden `Start-Process`, including child script
  execution policy and stdout/stderr files. Candidate storage now matches the
  documented `storage-candidate` path. Start/Status/Stop were exercised.
- At 00:20:29 UTC both `/sign-in` URLs returned HTTP 200 and sign-in content;
  owned process identities matched. Sources and BUILD_ID guards passed.
- Applied all 19 migrations to the previously empty task-local database on
  55441. Seeded only that isolated database with demo seed 42: 8 properties,
  69 units, 410 leases. The seed's actual IDs are **demo-property-maple**,
  **demo-unit-maple-11** (occupied 4B), **demo-unit-maple-7** (3A), and
  **demo-property-elm**. Its sign-in email is `jordan.mills@example.com`.
  Earlier `seed-property-*` IDs/email in the unexecuted spec are incorrect for
  this demo seed. Do not run the spec unchanged or infer a spec pass.
- The normal seed command hit `os.userInfo` ENOMEM in tsx preflight. A local
  ignored `.runtime/os-userinfo.cjs` CJS preload supplied the same environment
  fallback before tsx loading; NODE_OPTIONS used its relative path. Seed
  completed successfully; no existing database or shared storage was reset.
- Configured Playwright navigation/sign-in succeeded. The first incorrect
  `seed-property-maple` URL showed Page not found (fixture mismatch, not an
  application defect). Correct occupied URL below loaded successfully.
- Fresh **configured Playwright semantic observation only**, not native Edge:
  occupied 4B heading/status; current lease and View lease; payments; Unit
  facts; Next steps; Photos & documents; switcher options and scoped tabs;
  delete guard text `A unit with linked records cannot be deleted.` were
  present. No clicks on financial/provider actions occurred.
- Two subsequent capture-loop attempts failed with `MCP_SESSION_NOT_FOUND`.
  Fresh `browser_navigate` succeeded between them, but the following code
  call again lost the session. **No captures were written**. No before/after,
  390px, focus, edit, add, delete-dismiss, archive, upload, reorder, remove or
  preview-recovery pass is claimed. Earlier table remains pending except
  the partial occupied semantic observation above. No native grant existed.
- Both required linked Task reads were rejected as RELATED_WORK_NOT_LINKED;
  manager coordination was requested through the typed question. Design
  revision reads were requested successfully. No inherited test reruns.

### Exact resume coordinates

- Before: `http://localhost:3241/properties/demo-property-maple`.
- After: `http://localhost:3242/properties/demo-property-maple`.
- Add `?unit=demo-unit-maple-11` for occupied 4B and
  `?unit=demo-unit-maple-7` for 3A; verify current vacancy before claiming it.
- Source/build identities remain the table above and runtime-identity.json.
- Fixture: `.runtime/postgres` on 55441, organization `seed-rocket-rental`,
  demo seed 42 at this attempt's UTC date. Preserve it; do not reseed on resume.
- Synthetic files intended by the spec: `.runtime/synth/synth-a.png` and
  `.runtime/synth/synth-b.png`; **not generated this attempt**. No synthetic
  edit/upload records were created. Correct/review the spec before executing.
- Resume hidden Start, Status and Stop using the README commands, then use
  the configured browser once its session is repaired. Request manager native
  coordination only after readiness; cancelled file approvals remain binding.

### Release observed

At 00:22:33 UTC guarded Stop completed (`server stopped`). Status reported
baselineRunning=false, candidateRunning=false, postgresRunning=false; both
HTTP URLs refused connection; fixture postmaster.pid was absent. No services
were left running for a native review. The listener query returned no entries,
although it also returned none while HTTP was reachable, so process identity,
HTTP refusal and absent PID file are the stronger release evidence here.
No desktop acquired, file chooser used, push, deployment or integration.
