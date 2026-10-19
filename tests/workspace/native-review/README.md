# Overview native review (pending manager-coordinated grant)

This directory reserves the guarded harness location for the light property/unit
overview native pass. No harness, runtime, capture, or fixture exists here yet.

- Scope: real property and occupied/vacant unit navigation, switcher/canonical
  scopes, desktop + 390px layout, keyboard focus, inline save/cancel/validation,
  add-unit and protected delete/archive states, media upload/cover/order/remove
  and preview-failure recovery. Directory creation/modal/filter checks are done
  elsewhere and must not be repeated.
- Current state: directory services on 3231/3232/55431 are stopped with zero
  listeners observed; no desktop grant is active. Native outcomes stay pending
  until the manager supplies a fresh existing-Edge grant.
- Reserved interface (Status first; never Start over occupied ports or
  mismatched processes; Stop validates recorded PID/start-time/executable
  identity before stopping anything):
  - `powershell.exe -NoProfile -File tests/workspace/native-review/overview-review.ps1 -Action Status`
  - `powershell.exe -NoProfile -File tests/workspace/native-review/overview-review.ps1 -Action Stop`
  - `powershell.exe -NoProfile -File tests/workspace/native-review/overview-review.ps1 -Action Start`
- Rules for the future pass: keep all dependencies/client/build/storage/DB local
  to this Task, verify free ports before starting, never write another checkout
  or shared client, use disposable synthetic records/files, preserve review
  fixtures, and record per-flow results with desktop/390px captures in
  `docs/design/light-property-overview-verification.md` with distinct
  attribution.
