# Light manager tenants handoff

Implemented **Implement light manager tenant directory and details** for the manager people slice. The tenant portal Home/Lease slice remains separately owned.

## Candidate and runtime identity

- Repository: `repository:1ace516f-ddc8-43b2-8a40-4ce6d93792ad`, generation 1.
- Branch: `orchestra/work-2gcjdifqik3o7helc0b-2alcsuv028zue3t2461`.
- Checkout: `C:/Users/nkgol/RocketRental/.orchestra/workspaces/@1j89q07nsl16i9nh7w3/repository`.
- Base: `b62f7666dbe4c644f825904201bf29b2b6bb8fdf`; integrated foundation `37314def68c96b2cf550b0f18a90ad9c42425d75` by fast-forward before page edits.
- Design references: `Designs/rocketrental-light-people` revision 47 (`tenants`, `tenants-phone`, `tenant-detail`, `tenant-detail-phone`) and `Designs/rocketrental-light-system` revision 7 (`shared-controls`, `responsive-navigation`).
- Runtime: local Next 15.5.27 dev server on port 3216 for the interaction and regression checks, isolated embedded PostgreSQL 16.14 on port 55415 (`prisma/.tenants-review-postgres`), seeded with the repository demo portfolio. Desktop 1280 x 844 and phone 390 x 844 CSS pixels. The production build was verified separately.
- No Preview publication, integration, push or deployment.

## Design and component contract

- Directory: KPI strip, directory card with search/property/status filters, tenant table with row headers, status badges, pager and the Add tenant form. The Add tenant form remains an always-visible card (not a disclosure) so the existing `/tenants?view=directory` deep link and the portfolio regression keep working; its fields, three-column grid and actions follow the design.
- Status: default view. Card-based setup list with the six checklist items, Current/Upcoming period links, property/tenant/email search, attention count, pager, the "not tracked" alert and the unavailable messaging card. Invitation, acceptance and bank verification remain "Not tracked"; card on file is "Not applicable" for ACH autopay without a card.
- Tenant detail: profile band, section navigation, lease summary with the approved property-court icon, payment history, documents with preview/download, contact with mailto/tel, move-in/move-out and notes/history timeline. Active, draft, past and no-lease states are source-driven.
- Move-out: native modal `<dialog>` with the designed copy, Cancel focused first, focus containment, Escape and trigger restoration. The existing lease-wide `moveOutAction`, date and vacancy rules are unchanged.
- Shared components: `Button`, `Card`, `Badge`, `Avatar`, `Alert`, `Field`, `FormRow`, `Input`, `Select`, `pageFrom`/`paginate` and the shell `PageHeader`/`Icon` are consumed without redesign. The exact property-court, document and arrow SVGs are inlined from the approved geometry.
- Styles are scoped to the manager tenants route family in `tenants.module.css`; root/tenant portal shells and shared account boundaries are untouched.

## Route and state mapping

| Route | Design screen | States |
| --- | --- | --- |
| `/tenants?view=directory` | tenants / tenants-phone | KPI strip, search/property/status filters, table, pager, empty/no-match, Add tenant form, validation, draft lease |
| `/tenants` (default) | tenants / tenants-phone | Status view, current/upcoming, search/property, checklist, attention, empty, unavailable |
| `/tenants/[id]` | tenant-detail / tenant-detail-phone | Active, draft, past, no lease; edit profile; note; move-in; move-out dialog; documents; payments |

## Observed verification

| Check | Command and result |
| --- | --- |
| Typecheck | `node node_modules/typescript/bin/tsc --noEmit`: exit 0. |
| Scoped lint | `node node_modules/eslint/bin/eslint.js "src/app/(manager)/tenants" tests/tenants --max-warnings=0`: exit 0. |
| Tenant unit/component checks | `node node_modules/vitest/vitest.mjs run --config vitest.config.ts tests/tenants`: 4 files, 11 tests passed. |
| Production build | `npm.cmd run build`: exit 0; `/tenants` and `/tenants/[id]` dynamic. |
| Browser evidence | `node node_modules/@playwright/test/cli.js test tests/tenants/light-evidence.spec.ts --workers=1 --project=tenants` with `PLAYWRIGHT_BASE_URL=http://localhost:3216`: 4 passed. Desktop/390 directory, status, detail and move-out dialog; no horizontal overflow; Cancel focused; Escape closes and restores the trigger. |
| Existing tenant regressions | `node node_modules/@playwright/test/cli.js test tests/tenants/tenants.spec.ts tests/tenants/people-ux.spec.ts tests/tenants/light-evidence.spec.ts --workers=1 --project=tenants` with `PLAYWRIGHT_BASE_URL=http://localhost:3216`: 11 passed. Includes add tenant, search, move-in/move-out, profile edit, status checklist, applications scope and axe checks. |

Screenshots are under `tests/tenants/evidence/` (ignored by Git): `before-*` from the foundation baseline `37314de` and the current `tenants-*`, `tenant-detail-*`, `tenant-move-out-*` captures.

## Inherited versus pending

- Inherited: shared light theme, fonts, controls, shell navigation, focus and recovery.
- Pending with other owners: root/tenant portal shells, shared account boundaries, applications review, and the tenant Home/Lease slice.
- The Add tenant form and edit profile form remain cards rather than disclosures to preserve the existing deep-link and regression behavior; their content and grid follow the design.
- The shell topbar does not render the design's page subtitle or decorative spark; the page body, actions and tokens match.
- The production `next start` server did not complete the add-tenant server-action redirect in this environment; the same flow passes on the dev server and the production build itself succeeds. This is recorded as a runtime limitation, not a source change.
