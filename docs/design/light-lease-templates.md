# Light lease template library and editor

Built application candidate: `80fcd26976020f828ca2d6f424d05831fed60db2`.
Production build: `1MBXb7xWZbEv8AKonRns8`, built successfully from that exact candidate on 2026-10-19. Later handoff and browser-harness changes do not change the built application.

## Agent review corrections

- **Two-line preview:** removed padding/border from the clamped paragraph and placed spacing on a separate wrapper. The paragraph has zero padding and a measured height no greater than two line heights at 1440px and 390px. Expanded items remove that preview from the DOM and retain the complete editable wording.
- **Expanded editor:** separated the reorder row from full-width, visibly labelled title and wording fields. Include when occupies its own labelled row; Required and the destructive Remove control share a separate options row. Existing accessible names, ordering and mutations are retained. Browser assertions verify labels, destructive text color, keyboard outline and no page overflow with expanded long content.
- **Property illustrations:** restored the shared building SVG in Apply to properties and the existing illustrated house SVG in each live property row. The service supplies id/name/default-template id, without property type, so every row deliberately uses the same generic house fallback. No shared shell files or domain queries were changed. Default assignment, pending controls and property/lease deletion-denial flows passed again.

Preserved the reviewed candidate's before captures as `.playwright-mcp/review-before-candidate-editor-1440.png`, `review-before-candidate-editor-390.png`, `review-before-candidate-editor-expanded-1440.png`, and `review-before-candidate-editor-expanded-390.png`. Refreshed the corresponding `candidate-editor-*.png` captures from the new production build; screenshot inspection confirms the clean two-line ending, separate labelled fields, styled Remove and restored property icons. The final dedicated runner passed all 3 tests after explicit synchronization with the delete action response. Baseline captures from the original foundation remain unchanged.

Review-fix checks: 16 affected unit/UI tests passed; scoped lint, TypeScript, production build, foundation ancestry and whitespace checks passed. Browser tests passed at desktop and 390px, including all previously covered actual mutation/failure flows. The hidden runtime is ready on port 3147 using the exact build above; its receipt records application PID 42672 and fixture launcher PID 60352 at 21:45:59 UTC. Treat the on-disk runtime receipt as current when restarting, rather than these historical PIDs. Native existing-Edge review remains pending; no native observation or release confirmation was added.

## Source and design mapping

Assigned checkout: `C:/Users/nkgol/RocketRental/.orchestra/workspaces/@7o4jmw7f72bch00v7ey/repository`.
Assigned branch: `orchestra/work-2gcjdifqik3o7helc0b-01xnid1qe9stwyhqhix`.
Initial HEAD was `b62f7666dbe4c644f825904201bf29b2b6bb8fdf`; the explicitly authorized foundation `37314def68c96b2cf550b0f18a90ad9c42425d75` was fast-forwarded before editing. `git merge-base --is-ancestor` passed afterward. Only assigned template paths and scoped tests changed in the implementation commit. No push, target-branch integration, deployment, or Preview publication was performed.

Read Designs/rocketrental-light-leasing revision 42, screens `lease-templates`, `lease-templates-phone`, `lease-template-edit`, and `lease-template-edit-phone`, including their stylesheet; read Designs/rocketrental-light-system shared controls. Reuse the foundation's Inter/Space Grotesk, theme variables, shell, buttons, and lease document SVG. The scoped add/arrow SVGs retain design geometry. Production data remains service supplied; illustrative records and specimen sections are omitted.

| Route/state | Design reference | Implementation |
| --- | --- | --- |
| `/leases/templates`, desktop | lease-templates | Reusable-terms introduction, live template count, library table with version, usage, property defaults and Edit |
| `/leases/templates`, narrow viewport | lease-templates-phone | Library cards replace table below 700px; full property names wrap |
| `/leases/templates`, no records | Library empty state | No templates yet and Create template; defensive because service normally ensures a standard template |
| `/leases/templates/new` | Creation state | Existing editor defaults and empty groups; save precedes property-default assignment |
| `/leases/templates/[id]`, desktop | lease-template-edit | Sticky Save/status, counted section links, grouped terms, default fees and property panel |
| `/leases/templates/[id]`, narrow viewport | lease-template-edit-phone | Single column, wrapping section links, larger controls, one-column fees and reachable Save |
| Expanded term | Editor state | Full wording remains in the editable textarea; title, condition, required flag, within-section order and removal preserved |
| Pending/success/error | Editor state references | Disabled fields/actions while pending; focused status message; errors linked to invalid inputs; distinct success/error colors |

Save retains the editor route (a new template acquires its returned ID); Duplicate navigates to the returned ID. Delete calls the existing unused-only action without confirmation, returns to the library on success, and displays service denial on failure. Browser verification exposed an intermittent push/refresh navigation race: existing-template Save now refreshes in place, while creation, duplication and deletion navigate without immediately refreshing and cancelling that navigation. There is no Cancel/discard flow. Domain actions, schemas, lists, details and wizard remain unchanged. All 14 conditions, six fee inputs, item order, version handling, property defaults and long original wording remain available.

## Observed verification

| Check | Result |
| --- | --- |
| `node node_modules/vitest/vitest.mjs run tests/lease-templates/editor.test.tsx tests/lease-create/workflow-ux.test.tsx tests/lease-create/templates.test.ts tests/lease-create/standard-v2.test.ts` | Passed, 4 files / 16 tests |
| `node node_modules/eslint/bin/eslint.js 'src/app/(manager)/leases/templates/**/*.tsx' tests/lease-templates/editor.test.tsx --max-warnings=0` | Passed |
| `node node_modules/typescript/bin/tsc --noEmit` | Passed; project check also covers owned routes |
| `RUN_DB_INTEGRATION=1` with isolated DATABASE_URL, then `node node_modules/vitest/vitest.mjs run tests/db/lease-template.test.ts` | Passed, 1 persistence test: upgrade/version, usage denial, snapshot and property-default behavior |
| `npm.cmd run build` | Passed on exact built application candidate above; both template routes built |
| `git diff --check` and foundation ancestry | Passed |
| Repository Playwright runner, dedicated configuration `tests/lease-templates/playwright.config.ts` | Passed, 3 tests in isolated headless Chromium: desktop/390px layouts and keyboard/sticky checks, plus actual mutation/validation/failure flow |
| Desktop/390px baseline captures | Passed, 2 baseline tests; candidate mutation test intentionally skipped in baseline mode |
| Configured Playwright MCP | Unavailable: navigation returned `MCP_SESSION_NOT_FOUND` twice; another retry timed out after 120 seconds. Manager expressly authorized the repository runner fallback |
| Existing-Edge review and release confirmation | Pending manager coordination; no acceptance evidence observed |

Unit/UI tests exercise every condition option, all six fee fields, validation description and focus, retained edits on rejected save, within-section reorder, version save, duplicate identity, property assignment and deletion denial/success. The final regression assertions also guard against refreshing after duplicate/delete navigation. These are separate from browser observations. Initial accessible-name assertions were repaired by preserving the existing add-button names. Initial browser checks exposed mouse-versus-keyboard focus assumptions, route status remount behavior, and the actual push/refresh race described above. The final runner passed after correcting the race and synchronizing fixture reference removal. Windows sandbox initialization/download failures were resolved through authorized elevated retries. A first build's Prisma DLL lock was resolved by stopping the owned server. Final build warnings concern Prisma's deprecated package configuration and Next's multiple-lockfile root inference.

All browser observations below come from the repository's Playwright 1.64.0 runner with a dedicated headless Chromium context, direct local production runtime, fresh browser context per test, and isolated fixture database. No personal profile, configured MCP browser, native Edge, desktop control, or managed Preview supplied these observations. The baseline temporarily served only the owned library/editor files from foundation `37314def68c96b2cf550b0f18a90ad9c42425d75` in Next development mode; candidate copies were restored before building. Both use the same stable three-term comparison fixture. Library record counts can differ because actual mutation tests create fixture records.

The phone mutation flow created a template, entered clause/rule/disclosure wording, selected a condition from all 14 options, reordered two clauses, filled all six fees, saved and reloaded the exact wording/order/fees/condition, then saved version 2 without leaving the editor. It injected an aborted POST and verified focused failure feedback and retained edits; a delayed POST verified disabled pending controls. Duplicate opened its new identity. A property default displayed refreshed status and prevented deletion; a fixture lease reference independently prevented deletion. After clearing references, deletion returned to the library and removed the duplicate. Desktop and 390px tests asserted no document overflow, visible keyboard outlines after Tab/Shift+Tab, and sticky Save within the viewport after scrolling long content. Enter activated Add clause. Screenshot inspection corrected the Save label contrast, compact preview clamping, phone Expand wrapping and version-note placement.

Evidence under `.playwright-mcp/`:

- `baseline-foundation-library-1440.png`, `baseline-foundation-library-390.png`, `baseline-foundation-editor-1440.png`, `baseline-foundation-editor-390.png`, `baseline-foundation-editor-expanded-1440.png`, `baseline-foundation-editor-expanded-390.png`.
- `candidate-library-1440.png`, `candidate-library-390.png`, `candidate-editor-1440.png`, `candidate-editor-390.png`, `candidate-editor-expanded-1440.png`, `candidate-editor-expanded-390.png`.
- `candidate-sticky-focus-1440.png`, `candidate-sticky-focus-390.png`, `candidate-validation-phone.png`, `candidate-failure-retention-phone.png`, `candidate-pending-save-phone.png`, `candidate-property-default-denial-phone.png`, `candidate-used-deletion-denial-phone.png`, `candidate-unused-deleted-phone.png`.

## Runtime and native review handoff

Hidden durable production runtime: `http://127.0.0.1:3147`; isolated PostgreSQL on port 5547, data under ignored `.data/lease-template-review`. Migrations and the ordinary seed ran only against this fixture. The runtime uses the seed's manager account. No shared database mutations were made. Runtime identity/PIDs, build ID and startup time are recorded in `.data/lease-template-review-runtime/runtime.json`; stdout/stderr remain beside that receipt. Both processes use `Start-Process -WindowStyle Hidden`, independent of the terminal session. HTTP `/sign-in` returned 200 and the runner signed in successfully.

Restart from the assigned checkout in PowerShell:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/lease-templates/review-runtime.ps1 -Action stop
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/lease-templates/review-runtime.ps1
```

The script checks dedicated ports, verifies process creation time before stopping recorded PIDs, shuts the fixture database down gracefully, and waits for database readiness plus HTTP 200. It generates an ephemeral auth secret in the child environment; restarting requires signing in again. It reuses the built `.next` artifact and existing fixture without reseeding. If the artifact is absent, run `npm.cmd run build` against the isolated fixture URL while the application is stopped. Runner command: set `DATABASE_URL` to the fixture URL and `PWTEST_CACHE_DIR` to `.data/template-playwright-cache`, then run `node node_modules/@playwright/test/cli.js test --config tests/lease-templates/playwright.config.ts`.

Manager reported that the previous coordinated Edge window ended and the desktop was released at 21:11:32 UTC. That is manager-supplied historical context, not native acceptance of this candidate. No Edge profile or desktop was acquired for fallback work. Required existing-Edge review remains pending manager coordination; do not claim native acceptance until observed evidence and the applicable release confirmation are returned.

Manager checklist:

- At desktop and 390px, review the library table/cards and create/editor pages, including long names, property names and wording. Check horizontal page overflow.
- Create a fixture template, edit clauses/rules/disclosures, reorder within a group, select conditions and change all fee inputs. Save, reload and verify persisted wording/version while staying in the editor.
- Duplicate and verify the returned template route; set a fixture property default and verify the refreshed default state.
- Delete an unused fixture template without a confirmation; verify return to the library. Attempt deleting a used fixture and verify denial.
- Trigger empty title/wording, invalid fees/grace days and a failed request. Verify labelled errors, focused feedback and retained edits. Observe disabled pending actions.
- Use Tab/Shift+Tab/Enter through links, expansion, ordering, fields and Save; scroll long wording and verify sticky actions remain reachable. Capture desktop/390px evidence and report existing-Edge results plus desktop release confirmation through the manager.

Repository-runner comparisons, mutation flows, overflow and keyboard checks are observed as above. Native existing-Edge acceptance remains unverified and pending; no native completion claim is made.
