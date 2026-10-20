# Overview browser review handoff

Current result:25 configured-Playwright MCP captures, including16 matching
before/after property/occupied/vacant images at1280x1000 and390x844. These are
automation-profile evidence, not native existing Edge evidence. Per-flow results,
failed/inconclusive probes, original manager attribution and all remaining
limitations are in docs/design/light-property-overview-verification.md.

Retained runtime (do not rebuild/reseed):

- Baseline .runtime/baseline: source4adfb9649c4fdf65c1ed07a0152a3038775c581c,
  buildGPkMC-fReltH7INFyPztO, http://localhost:3241.
- Candidate .runtime/candidate-1f72f27: source
  1f72f27adc9b2708c2c882187304afb87b169d3e (contains overview89fce36),
  buildEheygKX6UxTxKO1h1ktwh, http://localhost:3242.
- .runtime/postgres: task-local PG16 on55441; all19 migrations/demo seed42
  applied2026-10-20; organization seed-rocket-rental. Preserve the fixture.
- Actual seeded routes /properties/demo-property-maple, occupied4B
  ?unit=demo-unit-maple-11 and occupied3A ?unit=demo-unit-maple-7.
- Disposable property /properties/synth-ov-prop-mvfy0u3z, vacantS1
  ?unit=synth-ov-unit-mvfy0u3z; S2cmvfycjhc0001b9jwizb1xmie. CityGeorgetown,
  S1bedrooms3, active property; uploaded photos removed, zero documents.
- Synthetic original files .runtime/synth/synth-a.png, synth-b.png,
  synth-c.png and synth-note.txt. The text note is not an accepted document
  format; no document upload pass. Local storage .runtime/storage-candidate.
- node tests/workspace/native-review/fixture-review.cjs inspect reads only
  fixed task-local PG55441/synthetic identity. prepare refuses to replace
  .runtime/synthetic-identity.json. Do not recreate before native review.

Guarded commands (absolute script path, from assigned checkout):

```powershell
$reviewScript = Join-Path $PWD 'tests/workspace/native-review/overview-review.ps1'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File $reviewScript -Action Status
# Start only if verified stopped/free and manager has no active fixture window:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File $reviewScript -Action Start
powershell.exe -NoProfile -ExecutionPolicy Bypass -File $reviewScript -Action Status
# After native/isolated checks, stop then verify:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File $reviewScript -Action Stop
powershell.exe -NoProfile -ExecutionPolicy Bypass -File $reviewScript -Action Status
```

Start checks build/source hashes, fixture, recorded process identities and
ports; hidden child services record ownership. Status verifies process identity
and sign-in HTTP responses. Stop checks PID/start/executable and fixture PID,
then shuts down only these services. TCP inventory returned no entries even
while HTTP worked: inspect process/HTTP/PID evidence too. Never replace an
occupied port/mismatched process or restart directory3231/3232/55431.

Final guarded release at2026-10-20T00:57:17.6493799Z: all three owned services
stopped, both HTTP probes refused, postmaster.pid absent; fixture/builds and
synthetic files preserved. See evidence/runtime-release.json. The native
question timed out without a grant; no new desktop/file request was made.
Any future review requires authorization and guarded Start/Status; do not
reseed/rebuild or infer a native pass. Native file scope had included only
synth-a.png/b.png, notC/text. No native chooser was used.
The inherited overview-review.spec.ts is an **unexecuted draft**, not a passing
result or ready command. Incorrect seed IDs/email, Document.targetId, nested
unit organizationId, numeric validation input, cover-adjacent reorder expectation,
preview placeholder selector, relative page.goto without baseURL and hidden
phone-card .first() selector assumptions need correction before running it.
Configured MCP, not that CLI spec, produced the submitted evidence.

Remaining: native review/final release, implicit single-family delete guard,
fully reliable canonical soft navigation/all-units and immediate media refresh,
and document upload. Direct routes and persisted
results must not be substituted for successful soft-navigation/native results.
No financial/provider action, push or integration is authorized here.
