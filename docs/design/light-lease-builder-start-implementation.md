# Light lease builder: Term and Rent — implementation

Implements `Designs/rocketrental-light-lease-builder` revision 14 (`term`, `term-phone`, `rent`, `rent-phone`) against `Designs/rocketrental-light-system` revision 7, following the handoff in [light-lease-builder-start.md](light-lease-builder-start.md). The ten-step order, validation, charge calculations, draft save/resume, renewal context and navigation semantics are unchanged; only shared presentation and the first two steps changed.

## Source-to-design mapping

| Design element                                                                | Implementation                                                                                                             |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Light top bar, back control, Save and exit                                    | `lease-builder.module.css` `.topbar` / `.back` / `.exit`; caption in `LeaseBuilder.tsx` and `UnitPicker.tsx`               |
| Draft status badges (Not saved yet / Unsaved changes / Saving… / Draft saved) | `.introDraft` with `.draftNeutral` / `.draftUnsaved` and `.spinner` in `LeaseBuilder.tsx`                                  |
| 1152px wrap, 208px step column, panel head band and icon                      | `.layout`, `.cardHead`, `.panelIcon`                                                                                       |
| Ten-step list, visited/current markers, phone horizontal scroll               | `.steps` with `tabIndex`/`aria-label`, `.phoneHint`; 700px media query                                                     |
| Term choice cards with computed end dates and hint bars                       | `TermStep` in `steps.tsx` using `endOptionDates`; no specimen dates hard-coded                                             |
| Rent fields, optional-fee grid, proration and scheduled charges preview       | `RentStep` / `ChargesPreview` with `.fees` and `.ledger` styles; calculations still come from `fees.ts` / `lease-setup.ts` |
| In-flow panel footer, Next destination, focus and disabled states             | `.footer` (static), `data-next-step` on Next, 3px focus outline, readable disabled controls                                |

Supporting-state specimens in the design (validation, saving, failure, unit entry, resume/renewal, proration options) remain references; the application renders the equivalent real states through the existing handlers, error summary and pending fieldset, not as a static gallery.

## Review corrections (assignment generation 2)

- Optional fees are now card containers (`div`) with a separate checkbox label and visibly labelled amount/grace fields built with `Field`, so each enabled field carries `aria-invalid` and an `aria-describedby` error with a stable generated ID. Toggles, entered values, validation and fee logic are unchanged.
- Fee amount/grace inputs are now `.field` controls, so the phone 16px/44px rules apply at 390px; the late-fee card spans the fee grid and its fields stack on phone.
- The custom end-date error renders with `id="custom-end-date-error"` and the date control points to it with `aria-describedby` alongside `aria-invalid`.
- `ChargesPreview` now states: "Preview only. Charges are created when the lease is sent or activated." Charge generation behavior is unchanged.
- Two new interaction tests cover the custom-date error link, the preview disclosure, fee toggles, and labelled invalid fee/grace fields.

## Integration versus acceptance

Candidate `69c4bf7` is contained in root `main` by merge `2c6768f`. That containment is integration history only; it is not manager acceptance. This correction round belongs in the retained checkout for manager review and must not be independently merged, pushed or deployed.

## Source, build and isolated runtime identity

Verification on October 19, 2026 used the assigned retained checkout only:
`C:\Users\nkgol\RocketRental\.orchestra\workspaces\@2due1loxaym80pkgjay\repository`,
branch `orchestra/work-2gcjdifqik3o7helc0b-63ycdqt1xw8g8v3u40l`.

| Variant                   | Exact application source                   | Production BUILD_ID     |
| ------------------------- | ------------------------------------------ | ----------------------- |
| Before review corrections | `69c4bf7eb34266f067df3826b7a3b5928f915c64` | `IsQIJtf3s4Z9L7yudBSI3` |
| Corrected candidate       | `66c1d48eeb4ff91c397bccbbc619c89053b9a1e6` | `U1-oHBAp3sYAPZS_AuAwD` |

The submission commit adds this evidence and refines the test runtime guards; its application `src`/`public` is identical to the corrected build's source. Both builds completed with Next 15.5.27 in production mode. The baseline was a `git archive` of the exact before commit, built inside this Task's test fixture, not another owner's checkout. Its preserved build is now under `tests/lease-builder/.runtime-db/node_modules/baseline`; placing the archive under node_modules prevents accidental duplicate test/type discovery. The source archive remains at `.runtime-db/baseline.tar`.

Dependencies were installed with `npm.cmd ci --ignore-scripts` into this checkout's real `node_modules`; Prisma 6.19.3 was generated here only. The baseline uses a junction to those same task-owned dependencies. No shared dependency or client was regenerated. Embedded PostgreSQL 16.14 is installed separately in `tests/lease-builder/.runtime-db/node_modules`. Build output, dependencies, fixture data and screenshots remain local, excluded from the Git candidate.

The app binds `127.0.0.1:3308`, the database binds `127.0.0.1:55508`; listeners were checked before initialization. These are this Task's services, not an inferred reservation from prior observations. SQL `SELECT current_database(), current_setting('data_directory'), current_setting('port')` returned database `rocketrental`, port `55508`, and this checkout's `tests/lease-builder/.runtime-db/data`. All 19 migrations applied successfully; `prisma/seed.ts` seeded 4 properties, 45 units and 41 occupied leases into that isolated database. No external provider or shared database was used.

## Observed checks

| Check                                                                                                                                                                  | Result                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node --import ./prisma/os-userinfo.mjs node_modules/vitest/vitest.mjs run --config vitest.config.ts tests/lease-builder tests/lease-create` before archiving baseline | 40 passed; 3 database tests initially skipped. Includes existing date, rent, template, workflow/focus/failure tests and 5 light-step tests.                                                                                                                   |
| `RUN_DB_INTEGRATION=1`, task DATABASE_URL, Vitest `--exclude '**/.runtime-db/**' tests/lease-create/drafts.test.ts`                                                    | All 3 persistence/activation tests passed against the isolated fixture. The first integration attempt discovered archived duplicate tests and collided; excluding the archive fixed discovery, and its final location under node_modules prevents recurrence. |
| `node node_modules/typescript/bin/tsc --noEmit`                                                                                                                        | Passed, including a final check after archive isolation.                                                                                                                                                                                                      |
| ESLint on `steps.tsx`, the light-step test and `runtime-server.mjs`, `--max-warnings=0`                                                                                | Passed.                                                                                                                                                                                                                                                       |
| Prettier on changed TSX/CSS/MJS and this document; `git diff --check`                                                                                                  | Passed.                                                                                                                                                                                                                                                       |
| `node --import ./prisma/os-userinfo.mjs node_modules/next/dist/bin/next build` in candidate and exact baseline snapshot                                                | Both passed compilation, build lint/type validation, page generation and tracing. Next warned that the root lockfile influenced tracing-root inference; dependencies/client/builds were task-local.                                                           |

### Configured production-browser observations

These are automated observations in the configured Playwright MCP Chromium profile, not native Edge acceptance. All interactions used the production runtime above.

| Flow                                 | Observed result                                                                                                                                                                                                                                                                                                               |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create / Term → Rent → Tenants       | Passed through real server actions and persisted draft saves. No step order or later step body was changed.                                                                                                                                                                                                                   |
| All end modes                        | Full-year `2035-01-15` → `2036-01-14`; month-to-month first period → `2035-01-31`; month/custom modes also saved through Next. A custom `2035-10-20` survived switching modes and changing start date.                                                                                                                        |
| Custom-date validation               | Earlier end date set `aria-invalid`, the described error existed and was visible, and the alert summary received focus. Input values remained present.                                                                                                                                                                        |
| Rent / fees                          | Invalid rent, malformed deposit, zero move-in/pet amounts, malformed late fee and out-of-range grace produced invalid controls and associated errors. Amount clicks did not toggle checkboxes; turning a fee off hid its field, and turning it back on restored its value. All four enabled fee fields were visibly labelled. |
| Real preview arithmetic              | Rent 1600, January 15 start, due day 5: 21/31 days = 1083.87; deposit 1600 + fees 150/250 gave 3083.87 at move-in. Unchecking proration changed that total to 2000.00. The preview-only disclosure was present. Zero deposit was subsequently saved successfully.                                                             |
| Pending controls                     | Held one POST, observed disabled fields, Back, Save and exit and visited-step buttons; released it, reached Tenants and observed focus on `step-title`.                                                                                                                                                                       |
| Failure / retry                      | Aborted a save POST: focused error alert, stayed on the same step, retained edited fee 151. A separate single-session failure/retry check retained rent 1701 and successfully saved/exited on retry. Expected failed-request console errors came from this injection.                                                         |
| Save / exit / resume / visited steps | Saved to `/leases?tab=drafts`; unit entry redirected to draft `cmvfxc0h40001b9go2jxb92n2` at saved Tenants step. Visited Rent and Back to Term retained rent 1600, fee 150 and start `2035-01-15`. Later checks deliberately changed that fixture to custom term, zero deposit and fee 151.                                   |
| Keyboard                             | ArrowDown from Full year selected Month-to-month. Back/Next and visited-step actions retained context; successful Next focused the new heading.                                                                                                                                                                               |
| Renewal                              | Synthetic source `seed-lease-maple-1` ends `2026-12-31`; default renewal began `2027-01-01`. A start on the old end date produced the server's renewal-boundary error, then the corrected date advanced through Rent to Tenants with one carried tenant. Due-day start had no proration checkbox.                             |
| 390px rendering                      | Four enabled fee fields measured 16px text, 45.33px height, 246px width, right edge 325.33px inside 390px viewport. Late-fee fields stack after the two fee cards; footer/disclosure remain reachable without overlap.                                                                                                        |

The configured MCP session was lost intermittently (`MCP_SESSION_NOT_FOUND`), including during an initial delayed-route check. Those partial attempts were not treated as complete passes. Reauthentication and shorter single-session checks completed the flows above; the pending check held/released a request directly, and the failure/retry check completed in one call. No native Edge profile was acquired.

## Rendered evidence

Images are actual production-browser captures in `.playwright-mcp/`, not design specimens. The builder scrolls internally, so the viewport captures intentionally cover top, fields and lower actions separately.

| Screen / state      | Before                              | Corrected candidate                                                                                                                                                |
| ------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Term desktop        | `builder-baseline-term-desktop.png` | `builder-candidate-term-desktop.png`, `builder-candidate-term-desktop-top.png`                                                                                     |
| Term 390px          | `builder-baseline-term-phone.png`   | `builder-candidate-term-phone.png`, `builder-candidate-term-phone-top.png`, `builder-candidate-term-phone-lower.png`                                               |
| Rent desktop        | `builder-baseline-rent-desktop.png` | `builder-candidate-rent-desktop.png`, `builder-candidate-rent-desktop-top.png`                                                                                     |
| Rent 390px          | `builder-baseline-rent-phone.png`   | `builder-candidate-rent-phone.png`, `builder-candidate-rent-phone-top.png`, `builder-candidate-rent-phone-late-fee.png`, `builder-candidate-rent-phone-footer.png` |
| Supporting behavior | —                                   | `builder-candidate-pending.png`, `builder-candidate-save-failure.png`, `builder-candidate-renewal-boundary.png`                                                    |

Inspected candidate term, rent fee and lower-phone captures: readable labels/controls, ordered fee fields, scrollable step list, reachable footer and preview disclosure; no observed field/action overlap. Baseline fee capture shows the previously unlabelled compact amount inputs corrected by this change.

## Guarded runtime handoff and native checklist

From the assigned checkout, in the manager's normal Windows user context:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/leases/light-lease-builder-runtime.ps1 -Action status
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/leases/light-lease-builder-runtime.ps1 -Action stop
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/leases/light-lease-builder-runtime.ps1 -Action start -Variant candidate
```

Start launches hidden processes, reads the preserved fixture/build mapping, and refuses occupied app ports or an unknown database owner. Status/stop verify the checkout, build ID, process command line, listener PIDs, postmaster data-directory/port and HTTP identity before reuse/shutdown. There is no reseed, port substitution or port-based killing. Start while already running was observed to refuse; status, guarded stop, baseline restart, and candidate restart passed. The candidate was left ready on 3308 for the coordinated review. `.runtime-db/builds.json` records both source/build pairs; `.runtime-db/runtime.json` records current process identity. Rebuilds require a new mapping. Use `-Variant baseline` only after stopping the candidate; both variants intentionally use the same app port.

Manager-coordinated native Edge acceptance is **pending**, as required by this Task. Ready checklist:

- Review Term and Rent at desktop and 390px, including lower fee fields, preview disclosure, focus and footer clearance.
- Start a fresh lease, exercise all term modes and an invalid custom date; advance Term → Rent → Tenants with fees/proration enabled.
- Save and exit, resume the saved draft, visit prior steps and confirm retained values; inspect renewal context.
- Confirm keyboard and native date-control behavior in Edge. Pending/failure states have automated evidence above; reproduce them only with manager-controlled fault injection if desired.

Synthetic manager sign-in uses the repository seed account and demo password from `prisma/seed.ts`. Start at `/leases/new?unit=seed-unit-maple-7&fresh=1` for a clean form or omit `fresh=1` to resume. No push, deployment or independent merge was performed. Root main was observed at `adcf39baaeae761058ed25b452d237a45488f567`; ancestry confirmed it contains the earlier `69c4bf7` candidate. That integration history remains separate from acceptance of this corrected submission.
