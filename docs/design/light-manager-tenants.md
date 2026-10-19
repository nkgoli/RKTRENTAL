# Light manager tenants handoff

Implemented **Implement light manager tenant directory and details** for the manager people slice. The tenant portal Home/Lease slice remains separately owned.

## Candidate and runtime identity

- Repository: `repository:1ace516f-ddc8-43b2-8a40-4ce6d93792ad`, generation 1.
- Branch: `orchestra/work-2gcjdifqik3o7helc0b-2alcsuv028zue3t2461`.
- Checkout: `C:/Users/nkgol/RocketRental/.orchestra/workspaces/@1j89q07nsl16i9nh7w3/repository`.
- Base: `b62f7666dbe4c644f825904201bf29b2b6bb8fdf`; integrated foundation `37314def68c96b2cf550b0f18a90ad9c42425d75` by fast-forward before page edits.
- Final code commit: `a0c727c41b4d8261696f1247202579eba0aae709`; final handoff commit: the commit containing this update (exact SHA in the completion report).
- Design references: `Designs/rocketrental-light-people` revision 47 (`tenants`, `tenants-phone`, `tenant-detail`, `tenant-detail-phone`) and `Designs/rocketrental-light-system` revision 7 (`shared-controls`, `responsive-navigation`).
- Production build: `npm.cmd run build`, build ID `EFldtxQIpLQixETRp4QWP`, HEAD `0b43585d03d2145be21d4ed6cd3e577c013a8789`.
- Production review runtime: `next start -p 3286`, process/listener PID `57352`, command line `node node_modules/next/dist/bin/next start -p 3286`, checkout above, build ID `EFldtxQIpLQixETRp4QWP`, HEAD `0b43585d03d2145be21d4ed6cd3e577c013a8789`. The listener was verified as the task-owned process before the checks and stopped afterwards.
- Existing-regression runtime: `next dev -p 3288`, task-owned, stopped after the run. Isolated embedded PostgreSQL 16.14 on port 55415 (`prisma/.tenants-review-postgres`), seeded with the repository demo portfolio. Desktop 1280 x 900 and phone 390 x 900 CSS pixels.
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
| Production build | `npm.cmd run build`: exit 0; build ID `EFldtxQIpLQixETRp4QWP`; `/tenants` and `/tenants/[id]` dynamic. |
| Production redirect reproduction | Foundation `37314de` production server on port 3287 (build `ODhA3pP1Dk5mZQL-JS2nF`): the add tenant test passed. Retained candidate `04b1762` production server on port 3286 (build `He-vD7vhPaw_S6QBWIyvE`): the add tenant test failed with the URL still `/tenants?view=directory`. The fix commit `7b96246`/`a0c727c` passes. |
| Production interaction | `node node_modules/@playwright/test/cli.js test tests/tenants/production-redirect.spec.ts --workers=1 --project=tenants` with `PLAYWRIGHT_BASE_URL=http://localhost:3286`: 3 passed. Add tenant redirect at 1280/390 reaches `/tenants/<id>?returnTo=...` without manual reload, shows the detail page and validated return link, and creates one record per unique email; edit profile, note, move-in and move-out complete without reload. |
| Browser evidence | `node node_modules/@playwright/test/cli.js test tests/tenants/light-evidence.spec.ts --workers=1 --project=tenants` with `PLAYWRIGHT_BASE_URL=http://localhost:3286`: 4 passed. Desktop/390 directory, status, detail and move-out dialog; no horizontal overflow; Cancel focused; Escape closes and restores the trigger. |
| Existing tenant regressions | `node node_modules/@playwright/test/cli.js test tests/tenants/tenants.spec.ts tests/tenants/people-ux.spec.ts --workers=1 --project=tenants` with `PLAYWRIGHT_BASE_URL=http://localhost:3288`: 7 passed. Includes add tenant, search, move-in/move-out, profile edit, status checklist, applications scope and axe checks. |

Screenshots are under `tests/tenants/evidence/` (ignored by Git): `before-*` from the foundation baseline `37314de`, the refreshed production `tenants-*`, `tenant-detail-*`, `tenant-move-out-*` captures, and `production-add-tenant-1280/390` from the production redirect regression.

## Native existing-Edge verification

Pending / not run. No desktop grant is active, so Edge was not acquired and no human window was requested. The automated Chromium observations above are not a substitute for native Edge verification. Concise checklist for the pending native pass:

- [ ] Open the production build (`EFldtxQIpLQixETRp4QWP`) in existing Microsoft Edge.
- [ ] Sign in as the manager and open `/tenants?view=directory` and `/tenants` at desktop and 390px.
- [ ] Open `/tenants/seed-tenant-maple-11` and check the profile, lease, payments, documents, contact and notes sections.
- [ ] Open the move-out dialog with the keyboard: confirm Cancel receives focus, Escape closes it, and the trigger is restored.
- [ ] Confirm the add tenant redirect reaches the detail page without a manual reload and the return link keeps the directory filters.
- [ ] Confirm no horizontal overflow, clipping or unreadable contrast.

The automated dialog observations are: the dialog opens, Cancel is focused, Escape closes it, and the trigger is restored in Chromium. Native Edge keyboard behavior is untested.

## Inherited versus pending

- Inherited: shared light theme, fonts, controls, shell navigation, focus and recovery.
- Pending with other owners: root/tenant portal shells, shared account boundaries, applications review, and the tenant Home/Lease slice.
- The Add tenant form and edit profile form remain cards rather than disclosures to preserve the existing deep-link and regression behavior; their content and grid follow the design.
- The shell topbar does not render the design's page subtitle or decorative spark; the page body, actions and tokens match.
- The production `next start` add-tenant redirect is repaired with a route-local document navigation (`/tenants/result`) that returns a non-Flight response for RSC and a 303 to the tenant detail page. The same route completes edit, note, move-in and move-out actions. The foundation's production server passed the add-tenant test; the retained candidate failed before the repair and passes after it.
