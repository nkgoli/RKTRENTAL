# Approved applicant promotion

After the existing screening/review decision records an application as **Approved**, choose **Promote to tenant** in its review. This action is also available for applications approved before this release. Property application groups expose a promotion link for each approved member; promoting one member never promotes their household automatically.

Promotion carries the applicant's saved name and normalized email into a tenant. These are the contact fields currently collected by applications; no phone or emergency contact is invented. It records `Application.promotedTenantId`, `promotedAt` and `promotedBy`, retaining the original application, decision, screening records and invitation. The tenant appears in the existing tenant directory/profile and lease selector. **View tenant** uses the saved association, and **Create lease** passes the exact tenant ID and unit to the existing lease workflow, even if the tenant's email later changes.

Promotion creates no lease, occupancy, charge, document, screening consent or notification. New tenants have email/SMS reminders disabled; promotion is not consent. Existing tenant preferences remain unchanged. Lease setup and move-in remain separate intentional actions.

## Matching and retries

- No matching email in the organization: create one tenant and atomically save the association.
- One match, ignoring case and surrounding whitespace: show its current name, email, phone and profile link. The manager must confirm **Use existing tenant**. Linking never overwrites its details, preferences or history, even when the applicant name differs.
- Multiple legacy matches: stop with a duplicate-contact message and tenant-directory link. No arbitrary match, automatic merge or destructive cleanup occurs.
- A stale or foreign confirmation ID is rejected. After promotion, repeat/concurrent requests return the saved tenant ID and preserve the original promotion audit, regardless of subsequent contact edits.

`POST /api/applications/[id]/promote` takes `{}` or `{ "existingTenantId": "…" }`. It requires a current authenticated manager, same-origin JSON, and organization-scoped `APPROVED` application. Unknown input fields are rejected. The application ID cannot be used to read or promote another organization's applicant. Invitation creation, draft save, submission, review and decline never invoke promotion.

The transaction takes an organization-scoped PostgreSQL advisory lock, shared with the existing tenant create/update services, then an application row lock. This serializes competing promotions, different applications with the same email, and tenant contact creation/edits. All current application tenant-contact writers participate; direct administrative SQL/imports must follow this lock protocol or otherwise coordinate contact writes. Historical duplicate contacts are preserved rather than rejected by a new global uniqueness migration.

Lease links deliberately use `unit` and `tenant` without the legacy `applicant` query parameter: the current wizard gives its email-based applicant lookup priority over a supplied tenant. Passing only the stable tenant ID avoids selecting a different contact after an email edit. Wizard labels and its general applicant picker remain owned by the separate wizard task.

## Migration

Apply `20261027000000_application_promotion` and generate Prisma before starting the server. Its nullable columns require no backfill. A composite tenant/organization foreign key rejects cross-organization links and restricts deletion of linked tenants. A database check requires complete promotion metadata and approved status together. Existing migrations and records are unchanged.

## Verification

Verification uses an isolated local PostgreSQL database on port 5498 and synthetic applicants only. The browser fixture helper requires explicit `APPLICATION_PROMOTION_TEST_FIXTURES=1`, sandbox mode, loopback host and port 5498. Its `consent` command adds clearly labeled synthetic consent only for the two promotion test applicants; it is not a production consent collection path. `evidence` reads promotion, profile and lease-selection results.

Automated cases cover role/organization rejection, every unapproved status, retry/concurrency, concurrent manual contact creation, same-email applications, confirmation/stale matches, legacy duplicates, multiple household members, contact edits after promotion, directory/profile and lease selection, database constraints and absence of lease/consent/billing side effects. API and UI tests cover the session/origin boundary, confirmation, errors and stable navigation.

Observed checks:

- **74 tests passed across 12 files**, none skipped: the final promotion/application/screening/UI run passed 62 tests in 11 files; the unchanged invitation database regression passed 12 tests. Commands: `node node_modules/vitest/vitest.mjs run --config vitest.config.ts tests/applications tests/screening tests/db/application-promotion.test.ts tests/workspace/leasing/applications-light.test.tsx`, and the separate `tests/db/application-invitations.test.ts` run, with `RUN_DB_INTEGRATION=1` and the isolated database URL.
- `prisma validate`, all 26 migrations deployed, and `prisma migrate status`: passed. Schema/database diff shows only the previously documented `LeaseTemplateItem` index-name difference; no promotion drift. Foreign-organization and incomplete-promotion constraints were exercised against PostgreSQL.
- Prisma client generation, `tsc --noEmit`, scoped ESLint and `git diff --check`: passed. Production `next build` passed with 41 generated routes, type/lint checks and build traces.
- Final production build ID: `cS8RG5CPzckxj36umNFQS`. Final browser check changed the linked desktop contact's email and placed a different synthetic contact at the original email. The promotion link still selected **Saved Desktop Contact** as primary in a new lease draft at both widths, confirming that the stable association wins over the stale email. The `edit-contact` fixture command exists solely for this isolated regression check.
- The shared checkout's active development process overwrote `.next` during two ordinary build attempts. Verification recovered using a temporary preload `.data/promotion-next-config.cjs` that loads the unchanged real Next configuration and overrides only `distDir` (`.data/promotion-next`) and the temporary typecheck config (`.data/promotion-tsconfig.json`). Production `next start` on port 3298 uses that same preload. No shared source config was changed. The npm build wrapper also encountered the shared Prisma DLL lock; the already-successful generated client was reused with the unchanged schema.
- Configured Playwright completed synthetic invitation/submission, existing sandbox screening, written approval, promotion, tenant profile/directory and lease selection at 1280×1000 and 390×844. Mobile created a tenant; desktop confirmed an existing contact and preserved its saved name/phone. Checked pages had no horizontal overflow. Four concurrent authenticated browser POST retries returned the same saved tenant ID.
- `tests/applications/promotion-browser-fixtures.ts evidence` observed both applications approved with `criteria-met`, decision and promotion actor recorded, profile available, lease-selectable, and **zero tenant leases immediately after promotion**. The later intentional wizard Next actions saved a desktop draft; this was separate from promotion. No lease was sent or activated. Screening consent was an explicit synthetic fixture, not produced by submission or promotion.

Browser MCP sessions reset during checks; completed flows were resumed after read-only recovery. The whole-project suite and live screening/email providers were not exercised. The browser includes the paired task's in-progress tenant UI from this shared checkout; this commit contains only promotion-owned paths.

### Retained screenshots

Screenshots are local, excluded from Git, in this retained checkout:
`C:/Users/nkgol/RocketRental/.orchestra/workspaces/@6i6c2szp8fsilp8xf1k/repository`.

| Flow | Desktop | 390px |
| --- | --- | --- |
| Invitation | `.playwright-mcp/promotion-invitation-1280.png` | `.playwright-mcp/promotion-invitation-390.png` |
| Submission | `.playwright-mcp/promotion-submitted-1280.png` | `.playwright-mcp/promotion-submitted-390.png` |
| Review | `.playwright-mcp/promotion-review-1280.png` | `.playwright-mcp/promotion-review-390.png` |
| Approved | `.playwright-mcp/promotion-approved-1280.png` | `.playwright-mcp/promotion-approved-390.png` |
| Promoted | `.playwright-mcp/promotion-linked-1280.png` | `.playwright-mcp/promotion-linked-390.png` |
| Profile | `.playwright-mcp/promotion-profile-1280.png` | `.playwright-mcp/promotion-profile-390.png` |
| Directory | `.playwright-mcp/promotion-directory-1280.png` | `.playwright-mcp/promotion-directory-390.png` |
| Lease selection | `.playwright-mcp/promotion-lease-selection-1280.png` | `.playwright-mcp/promotion-lease-selection-390.png` |

Existing-contact confirmation: `.playwright-mcp/promotion-existing-1280.png`.
Stable tenant selection after email edits: `.playwright-mcp/promotion-stable-identity-1280.png` and `.playwright-mcp/promotion-stable-identity-390.png`.
