# Overview browser review handoff

Current result: 12 configured-Playwright MCP before/after captures exist in
`evidence/`, with exact hashes/source/build/viewport identities in
`evidence/capture-manifest.json`. These are automation-profile browser evidence,
not native existing Edge evidence. Full flow/native acceptance remains pending.
See `docs/design/light-property-overview-verification.md` for attribution/gaps.

Retained runtime (do not rebuild or reseed):

- `.runtime/baseline`: source 4adfb9649c4fdf65c1ed07a0152a3038775c581c,
  BUILD_ID GPkMC-fReltH7INFyPztO, http://localhost:3241.
- `.runtime/candidate-1f72f27`: source
  1f72f27adc9b2708c2c882187304afb87b169d3e (contains overview89fce36),
  BUILD_ID EheygKX6UxTxKO1h1ktwh, http://localhost:3242.
- `.runtime/postgres`: task-local PG16 on55441, migrated and demo-seeded42
  on2026-10-20. Organization seed-rocket-rental. Preserve this fixture.
- Actual routes: `/properties/demo-property-maple`, occupied4B
  `?unit=demo-unit-maple-11`, occupied3A `?unit=demo-unit-maple-7`.
  Do not infer vacancy from the old spec's constant names.
- Disposable property `synth-ov-prop-mvfy0u3z`, vacantS1
  `?unit=synth-ov-unit-mvfy0u3z`; prepared but no browser edits/media applied.
  Identity `.runtime/synthetic-identity.json`.
- Generated disposable files `.runtime/synth/synth-a.png`, `synth-b.png`,
  `synth-c.png`, `synth-note.txt`; local storage `.runtime/storage-candidate`.
- `node tests/workspace/native-review/fixture-review.cjs inspect` reads the
  fixed task-local DB and synthetic identity. `prepare` refuses to replace an
  existing identity. Keep it for resumed/native review.

Guarded PowerShell interface from this assigned checkout (absolute script path):

```powershell
$reviewScript = Join-Path $PWD 'tests/workspace/native-review/overview-review.ps1'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File $reviewScript -Action Status
powershell.exe -NoProfile -ExecutionPolicy Bypass -File $reviewScript -Action Start
powershell.exe -NoProfile -ExecutionPolicy Bypass -File $reviewScript -Action Status
# After all checks:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File $reviewScript -Action Stop
powershell.exe -NoProfile -ExecutionPolicy Bypass -File $reviewScript -Action Status
```

Start guards build/source hashes, fixture, process identities and free ports,
launches hidden child services and records ownership. Status verifies the
recorded processes and sign-in HTTP response. Stop checks process/start-time/
executable identity and fixture PID, then cleanly stops only these services.
The local TCP inventory returned no entries even during successful HTTP
requests, so always also inspect process/HTTP/PID results. Never replace an
occupied port or mismatched process. Do not restart directory3231/3232/55431.

`overview-review.spec.ts` is an **unexecuted inherited draft**, not a passing
browser result or a safe ready command: its seed IDs/email, document targetId,
nested unit organizationId, numeric validation input, cover-adjacent reorder
expectation and preview placeholder selector need correction for this actual
fixture/schema. Its relative `page.goto` calls also lack baseURL. Do not run it
unchanged. Configured MCP, not that CLI spec, produced the 12 captures.

Remaining checks: actual canonical navigation/switcher and keyboard; true
vacant desktop/390 capture; inline save/cancel/validation; add-unit validation
and save; protected-delete dismissal/implicit and linked-record guards;
archive/restore; disposable media upload/cover/order/remove/document and
preview-failure/recovery. No financial or live-provider actions.

Browser recovery: immediate configured MCP navigation/code sequence succeeded
for captures, but later again returned MCP_SESSION_NOT_FOUND; closing the
automation page and navigating afresh did not repair it. Manager coordination
is required for configured-browser recovery and any native existing-Edge grant.
Do not acquire desktop/file controls or bypass cancelled approvals.
