# Overview native review (Chromium harness ready; live run blocked by sandbox)

Task-owned isolated Chromium review for the light property/unit overviews.
The harness, sources, builds, fixture, and spec below are implemented and
measured in this checkout. The live run (migrate/seed/serve/Playwright) is
blocked only by this sandbox denying all loopback binds (exact reproduction
in `docs/design/light-property-overview-verification.md`); no services were
started and none are recorded.

- Scope: real property and occupied/vacant unit navigation, switcher/canonical
  scopes, desktop + 390px layout, keyboard focus, inline save/cancel/validation,
  add-unit and guarded delete/archive states, synthetic media upload/cover/order/
  remove and preview-failure recovery. Directory creation/modal/filter checks are
  done elsewhere and must not be repeated.
- Runtime layout (all under `tests/workspace/native-review/.runtime/`, ignored):
  `baseline/` (source 4adfb964, build GPkMC-fReltH7INFyPztO, port 3241),
  `candidate-1f72f27/` (source HEAD incl. 89fce36, build EheygKX6UxTxKO1h1ktwh,
  port 3242), `postgres/` (initialized PG 16 cluster, port 55441),
  `storage-baseline/` + `storage-candidate/`, `browsers/` (Playwright Chromium),
  `synth/` (generated disposable PNGs), `services.json` (created by Start only).
- Identity file: `.runtime/review-config.json` (committed evidence copy at
  `../evidence/runtime-identity.json`). `*-1f72f27` in the name is the candidate
  source commit, not a port.
- Guarded interface (Status first; never Start over occupied ports or mismatched
  processes; Stop validates recorded PID/start-time/executable identity):
  - `powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/workspace/native-review/overview-review.ps1 -Action Status`
  - `powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/workspace/native-review/overview-review.ps1 -Action Stop`
  - `powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/workspace/native-review/overview-review.ps1 -Action Start`
  - `-ExecutionPolicy Bypass` is required: script execution is restricted by
    default on this machine, and the script path must be absolute (a bare
    relative `-File` loses `$PSScriptRoot` here).
- Live run (needs a bind-capable session; nothing below was started here):
  1. `overview-review.ps1 -Action Start`, then `-Action Status` (both
     `/sign-in` must be HTTP 200 with the sign-in form).
  2. Migrate + seed against the isolated fixture (SEED_DEMO_PASSWORDS=1):
     `DATABASE_URL=postgresql://rocketrental:rocketrental@127.0.0.1:55441/rocketrental?schema=public`
     `prisma migrate deploy`, then the demo seed.
  3. `OVERVIEW_DATABASE_URL=... OVERVIEW_BASELINE_URL=http://localhost:3241 OVERVIEW_CANDIDATE_URL=http://localhost:3242 OVERVIEW_STORAGE_DIR=<.runtime/storage-candidate> node node_modules/@playwright/test/cli.js test --config tests/workspace/native-review/review.playwright.config.ts`
     with `PLAYWRIGHT_BROWSERS_PATH=tests/workspace/native-review/.runtime/browsers`.
  4. Record results in `docs/design/light-property-overview-verification.md`;
     `overview-review.ps1 -Action Stop`, then `-Action Status` (zero listeners
     on 3241/3242/55441, `postmaster.pid` absent).
- Rules: keep everything local to this Task, verify free ports before starting,
  never write another checkout or shared client, use disposable synthetic
  records/files (the spec creates `synth-ov-*` and removes them), preserve
  review fixtures. Native existing-Edge work stays pending until the manager
  coordinates a fresh grant; do not acquire the desktop or ask the human.
