# Light lease template library and editor

Implementation candidate: `be621e8107d5558b385422e552b2751c3e909ec0`.
Production build: `F7wLeA8AElTmNEdTAVQlC`, built successfully from that exact source candidate on 2026-10-19. The later handoff-only commit changes this document, not the built application.

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

Save retains the editor route (a new template acquires its returned ID); Duplicate navigates to the returned ID. Delete calls the existing unused-only action without confirmation, returns to the library on success, and displays service denial on failure. There is no Cancel/discard flow. Domain actions, schemas, lists, details and wizard remain unchanged. All 14 conditions, six fee inputs, item order, version handling, property defaults and long original wording remain available.

## Observed verification

| Check | Result |
| --- | --- |
| `node node_modules/vitest/vitest.mjs run tests/lease-templates/editor.test.tsx tests/lease-create/workflow-ux.test.tsx tests/lease-create/templates.test.ts tests/lease-create/standard-v2.test.ts` | Passed, 4 files / 16 tests |
| `node node_modules/eslint/bin/eslint.js 'src/app/(manager)/leases/templates/**/*.tsx' tests/lease-templates/editor.test.tsx --max-warnings=0` | Passed |
| `node node_modules/typescript/bin/tsc --noEmit` | Passed; project check also covers owned routes |
| `RUN_DB_INTEGRATION=1` with isolated DATABASE_URL, then `node node_modules/vitest/vitest.mjs run tests/db/lease-template.test.ts` | Passed, 1 persistence test: upgrade/version, usage denial, snapshot and property-default behavior |
| `npm.cmd run build` | Passed on exact implementation candidate; both template routes built |
| `git diff --check` and foundation ancestry | Passed |
| Browser create/edit/save, duplicate, property default, unused deletion/denial, failure/validation, keyboard flows | Unavailable: configured Playwright navigation returned `MCP_SESSION_NOT_FOUND` twice; another retry timed out after 120 seconds |
| Desktop/390px before-and-after captures | Not produced because configured browser session was unavailable |
| Existing-Edge review and release confirmation | Pending manager coordination; no acceptance evidence observed |

Unit/UI tests exercise every condition option, all six fee fields, validation description and focus, retained edits on rejected save, within-section reorder, version save, duplicate identity, property assignment and deletion denial/success. These are not browser observations. The initial SVG button change broke two legacy accessible-name assertions; the existing add-button accessible names were preserved and the affected suite then passed. Windows sandbox initially prevented database initialization and Prisma engine download; authorized elevated retries succeeded. A first build encountered the running dev server's Prisma DLL lock; stopping the owned server resolved it. Final build warnings concern Prisma's deprecated package configuration and Next's multiple-lockfile root inference.

## Runtime and native review handoff

Isolated production runtime: `http://127.0.0.1:3147`; isolated PostgreSQL on port 5547, data under ignored `.data/lease-template-review`. Migrations and the ordinary seed ran only against this fixture. The runtime uses the seed's manager account. No shared database mutations were made. The manager has been asked to restore configured Playwright and coordinate the required existing-Edge review. Do not claim native acceptance until observed evidence and desktop release confirmation are returned.

Manager checklist:

- At desktop and 390px, review the library table/cards and create/editor pages, including long names, property names and wording. Check horizontal page overflow.
- Create a fixture template, edit clauses/rules/disclosures, reorder within a group, select conditions and change all fee inputs. Save, reload and verify persisted wording/version while staying in the editor.
- Duplicate and verify the returned template route; set a fixture property default and verify the refreshed default state.
- Delete an unused fixture template without a confirmation; verify return to the library. Attempt deleting a used fixture and verify denial.
- Trigger empty title/wording, invalid fees/grace days and a failed request. Verify labelled errors, focused feedback and retained edits. Observe disabled pending actions.
- Use Tab/Shift+Tab/Enter through links, expansion, ordering, fields and Save; scroll long wording and verify sticky actions remain reachable. Capture desktop/390px evidence and report existing-Edge results plus desktop release confirmation through the manager.

Browser comparisons, actual runtime mutation flows, visual fidelity, overflow and native acceptance remain unverified. No completion claim is made for those requirements.
