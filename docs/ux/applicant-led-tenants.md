# Applicant-led tenants

Tenants are no longer created by hand on the Tenants screen. A tenant record comes from an
approved applicant, so every former creation entry point now leads to Applications.

## Behaviour

| Entry point                          | Before                          | Now                                                                                                       |
| ------------------------------------ | ------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Tenants header action                | `+ Add tenant` → `?add=1` form  | **Review applications** → `/applications`, or `/applications?propertyId=<id>` when a property is selected |
| Shell nav default action for Tenants | `Add tenant` → `/tenants?add=1` | **Review applications** → `/applications`                                                                 |
| Unfiltered empty directory           | `Add a tenant` button           | "Tenants appear here once an approved applicant moves in." + **Review applications**                      |
| Filtered empty directory             | Clear filters                   | Unchanged                                                                                                 |
| Legacy `/tenants?add=1`              | Opened the Add tenant dialog    | Server redirect to Applications, keeping `property` as `propertyId`; no dialog, no dead end               |

Removed: `AddTenantForm` (`TenantForms.tsx`) and `addTenantAction` (`actions.ts`). The tenant
service (`createTenant`, `parseNewTenantInput`) is untouched so the approved-applicant promotion
work can use it. Profile editing, notes, move-in/out, status view, lease links and the
`notice=added` confirmation on the profile are unchanged.

## Remaining creation entry points outside this change

- `src/components/lease-builder/steps.tsx` links to `/tenants?add=1` ("Add tenant contact (new
  tab)" and the empty-directory hint). These belong to the lease-builder owner. Until they are
  updated they land on Applications through the legacy redirect rather than a form.

## Verification

- Unit: `tests/tenants/applicant-led.test.tsx` (header, empty state, property scope, legacy
  redirect), `tests/tenants/forms-ux.test.tsx` (edit form kept, add form gone),
  `tests/tenants/navigation.test.ts`, `tests/shell/nav.test.ts`.
- Browser (1280 and 390 px, keyboard): `tests/tenants/applicant-led.spec.ts`, plus the updated
  `people-ux.spec.ts` and `tenants.spec.ts`. Screenshots are written to
  `tests/tenants/evidence/applicant-led/` locally and are not committed.
