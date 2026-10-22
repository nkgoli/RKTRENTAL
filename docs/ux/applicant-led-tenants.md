# Applicant-led tenants

Tenants are no longer created by hand on the Tenants screen. A tenant record comes from an
approved applicant, so every former creation entry point now leads to Applications.

## Behaviour

| Entry point                          | Before                          | Now                                                                                                                                 |
| ------------------------------------ | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Tenants header action                | `+ Add tenant` → `?add=1` form  | **Review applications** → `/applications`, or `/applications?propertyId=<id>` when a property is selected                           |
| Shell nav default action for Tenants | `Add tenant` → `/tenants?add=1` | **Review applications** → `/applications`                                                                                           |
| Unfiltered empty directory           | `Add a tenant` button           | "Tenants appear here when you promote an approved applicant. Lease setup and move-in are separate steps." + **Review applications** |
| Filtered empty directory             | Clear filters                   | Unchanged                                                                                                                           |
| Legacy `/tenants?add=1`              | Opened the Add tenant dialog    | Server redirect to Applications, keeping `property` as `propertyId`; no dialog, no dead end                                         |

Removed: `AddTenantForm` (`TenantForms.tsx`) and `addTenantAction` (`actions.ts`). The tenant
service (`createTenant`, `parseNewTenantInput`) is untouched so the approved-applicant promotion
work can use it. Profile editing, notes, move-in/out, status view, lease links and the
`notice=added` confirmation on the profile are unchanged.

## Lease wizard

The wizard's general applicant picker and legacy applicant links use the approved application's
saved `promotedTenantId`, scoped through the organization's tenant options. Changing the promoted
contact's email and assigning the former email to another contact cannot change that selection.
Approved but unpromoted applicants, review applicants and unavailable tenant associations offer
Applications review instead of an applicant checkbox. A deliberate choice from existing tenants
still works. Renewal and saved-draft selections take precedence over URL hints.

Both the applicant row and legacy-link notice route to Applications with property, unit and
applicant scope. Plain click or Enter uses the existing save-before-navigation handler. The
draft can be resumed through its saved draft link; deletion, save locking and signing are unchanged.

The runnable lifecycle browser regression creates a unique synthetic approved application and
vacant unit, promotes through the actual Applications UI, and checks that there is no lease,
occupancy, consent, screening report, billing or autopay. Only then does the fixture intentionally
create a draft lease. The browser edits the profile, saves notes, moves in, cancels a move-out,
and confirms move-out, checking both rendered results and persisted state at desktop and 390px.

## Verification

- Unit: `tests/tenants/applicant-led.test.tsx` (header, empty state, property scope, legacy
  redirect), `tests/tenants/forms-ux.test.tsx` (edit form kept, add form gone),
  `tests/tenants/navigation.test.ts`, `tests/shell/nav.test.ts`.
- Browser (1280 and 390 px, keyboard): `tests/tenants/applicant-led.spec.ts`, plus the updated
  `people-ux.spec.ts` and `tenants.spec.ts`. Screenshots are written to
  `tests/tenants/evidence/applicant-led/` locally and are not committed.

### Promotion identity corrective verification

The retained checkout is
`C:/Users/nkgol/RocketRental/.orchestra/workspaces/@7bo4gnmsud01ul1js0o/repository`.
Checks use an isolated PostgreSQL instance on loopback port 5498, all 26 migrations deployed,
the synthetic seed, a freshly generated Prisma client, and the production server on port 3298.
`prisma migrate status` reports the schema up to date. The guarded browser fixtures require
`APPLICATION_PROMOTION_TEST_FIXTURES=1` and `ROCKETRENTAL_SANDBOX=true`; they reject other hosts/ports.

- **131 unit/database tests passed in 23 files**, including all 74 existing promotion/application/
  screening/invitation checks, 14 new wizard identity tests, tenant UI/navigation, shell navigation,
  wizard save feedback and draft deletion. Run with `RUN_DB_INTEGRATION=1`:
  `node node_modules/vitest/vitest.mjs run --config vitest.config.ts tests/applications tests/screening tests/db/application-promotion.test.ts tests/db/application-invitations.test.ts tests/workspace/leasing/applications-light.test.tsx tests/tenants tests/lease-create/applicant-promotion.test.tsx tests/lease-create/workflow-ux.test.tsx tests/lease-create/wizard-delete.test.tsx tests/lease-create/delete-draft.test.ts tests/lease-create/delete-draft-builder.test.tsx tests/shell/nav.test.ts`.
- **Production build passed**, generating 41 static pages; build ID `NMXNHv4klAgSwIbzqoGRB`.
  Commands: Prisma client generation, `node node_modules/next/dist/bin/next build`.
  Standalone `tsc --noEmit`, scoped ESLint and `git diff --check` passed.
- **Wizard browser regression: 2 passed**, at 1280px and 390px. General selection and legacy links
  retain the saved identity after the email collision. Approved and REVIEW applicants without
  promotion have no applicant checkbox. Keyboard review opens the actual scoped Applications body,
  and database inspection plus explicit draft resume confirms the saved tenant selection.
  Command: `node node_modules/@playwright/test/cli.js test --project=lease-create tests/lease-create/applicant-promotion.spec.ts`.
- **Restored tenant lifecycle: 4 passed**, including directory/lease links and both viewport lifecycle
  cases. Promotion leaves the unit VACANT with zero leases, charges, payments, consents, reports and
  autopay. Explicit subsequent draft setup and move-in make the lease ACTIVE/unit OCCUPIED; confirmed
  move-out makes the lease ENDED/unit VACANT while preserving profile edits and notes. Charges appear
  only after intentional move-in. Command: `node node_modules/@playwright/test/cli.js test --project=tenants tests/tenants/tenants.spec.ts`.
- **Production redirect/edit-note regression: 3 passed** against the actual Applications body.
  Command: `node node_modules/@playwright/test/cli.js test --project=tenants tests/tenants/production-redirect.spec.ts`.

The final combined run of those three browser files passed **9/9 in 28.2s** with no retries:
`node node_modules/@playwright/test/cli.js test --project=tenants --project=lease-create tests/tenants/tenants.spec.ts tests/tenants/production-redirect.spec.ts tests/lease-create/applicant-promotion.spec.ts --output=test-results/acceptance-core`.

Configured Playwright MCP also observed general collision selection at desktop, the legacy promoted
link at 390px, keyboard unpromoted review routing and no horizontal overflow. Screenshots remain local:

| Flow                                          | Desktop                                                            | 390px                                                             |
| --------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| General applicant selection / email collision | `tests/lease-create/evidence/applicant-promotion-general-1280.png` | `tests/lease-create/evidence/applicant-promotion-general-390.png` |
| Legacy promoted link                          | `tests/lease-create/evidence/applicant-promotion-legacy-1280.png`  | `tests/lease-create/evidence/applicant-promotion-legacy-390.png`  |
| Unpromoted review body                        | `tests/lease-create/evidence/applicant-promotion-review-1280.png`  | `tests/lease-create/evidence/applicant-promotion-review-390.png`  |
| Promoted tenant without occupancy             | `tests/tenants/evidence/lifecycle-promoted-1280.png`               | `tests/tenants/evidence/lifecycle-promoted-390.png`               |
| Profile edits and saved note                  | `tests/tenants/evidence/lifecycle-edited-1280.png`                 | `tests/tenants/evidence/lifecycle-edited-390.png`                 |
| Intentional move-in                           | `tests/tenants/evidence/lifecycle-moved-in-1280.png`               | `tests/tenants/evidence/lifecycle-moved-in-390.png`               |
| Confirmed move-out                            | `tests/tenants/evidence/lifecycle-moved-out-1280.png`              | `tests/tenants/evidence/lifecycle-moved-out-390.png`              |

### Additional findings outside the implementation

- Adding the unchanged `src/lib/tenants/tenants.test.ts` service suite yielded **18 passed, 6 failed**.
  Its transaction mock lacks `$queryRaw` for the previously introduced identity lock/contact lookup;
  it still expects the former `findFirst` email query. The real service's promotion/edit/lifecycle
  database and browser checks pass. That test file is outside this Task's owned paths.
- The existing Applications Axe check fails `link-in-text-block` at both widths: selected-applicant
  property/unit links have no underline and only 1.03:1 contrast against surrounding text.
  `src/app/(manager)/applications/applications.module.css` is outside this Task's owned paths.
  Both widths completed the scope, search, clear-filter, unavailable-applicant and decision-button
  gating assertions before the preserved Axe assertion failed. Final command:
  `node node_modules/@playwright/test/cli.js test --project=tenants tests/tenants/people-ux.spec.ts --grep 'applicant review' --output=test-results/review-final`.
- Existing profile Cancel navigation was intermittent in automated runs. A focused mobile rerun
  passed unchanged, as did manual configured-browser keyboard cancellation. The regression retains
  its keyboard, URL, form-disappearance and unsaved-edit assertions; it is not skipped or relaxed.
  The retained failing contexts and passing trace are under `test-results/tenants-ui-final/` and
  `test-results/tenant-cancel-trace/`. No whole-project test run or external provider call was made.
