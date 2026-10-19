# Light tenant Repairs

Implements **Implement light tenant repair requests and photos** from Designs/rocketrental-light-tenant revision 27 (`tenant-repairs`, `tenant-repairs-desktop`) and Designs/rocketrental-light-system revision 7 (`shared-controls`). The admitted foundation/Home/Lease commit `881bc83b4458aa87879eb3c4cb576fe46d8fd886` was present at HEAD before work. Its shared shell, exact icons, TenantPhoto and portal styles are consumed unchanged. References: light-foundation.md, light-system.md, light-system-icons.json, light-rollout-coverage.md/json.

## Implementation and state mapping

| Route/state | Design mapping and behavior |
| --- | --- |
| `/repairs` desktop and phone | One responsive view inside the existing 640px shell. Eyebrow, exact decorative asterisk, 20px card headings, 16px request headings, compact form spacing, cobalt selected permission tiles, neutral upload surface and teal progress. Existing Home/Pay/Lease/Repairs routes and exact shared icons remain unchanged. |
| New request | Category, description (2800 characters), urgency and entry values retain their source API. Help is associated separately from input labels. Whitespace validation focuses the description, exposes an inline error and retains input; pending disables duplicate submissions. |
| Photos | Existing FileUploader in multipart form-attached mode, five photos, 25 MiB each, JPG/PNG/HEIC selection, count, remove/order/cover/retry and failed-file feedback. Local CSS changes presentation without editing the shared uploader. Existing server photo validation and sequential partial success remain unchanged. |
| Requests/comments | Live titles, status/progress, vendor, dates, descriptions and event history. Cancelled requests omit progress; only owned requests have comment entry. Visible comment labels wrap. Existing lease/unit photo visibility filter and authenticated preview routes remain unchanged. |
| Feedback | Approved source text retained for submitted/commented/invalid/count/type/partial/no-lease notices. Validation failures now use the foundation error tone and alert semantics; partial upload failure remains a warning because the request already exists. |
| No active lease / empty history | Existing copy and retry route; no form is rendered without a lease. Empty request history retains the instruction to describe the issue above. |
| Loading/error/retry | Inherit separately owned tenant loading/error boundaries unchanged. Shared tenant-state regressions were rerun. No specimen state catalog or illustrative tenant data was shipped. |

Two implementation differences are intentional. Live data replaces static design examples and the illustrative-data note. Comments now submit through native POST `/repairs/comment`, preserving `addRequestComment` authorization, limits, validation and destination, because the inherited streamed tenant action persisted a comment but did not finish its browser redirect. The old action export remains compatible. The new route has direct authentication/service/error tests and a real browser submission regression.

## Verification

- 40 tests passed: `node node_modules/vitest/vitest.mjs run tests/tenant-repairs tests/upload/FileUploader.test.tsx tests/tenant-portal/states.test.tsx --config vitest.config.ts`. Covers source format semantics, labels, whitespace focus, pending state, five-file and 25 MiB limits, retry/removal, authorized photo filtering, request statuses, every notice, no-lease/empty states, sequential partial success and comment authorization/feedback.
- Scoped lint: `node node_modules/eslint/bin/eslint.js 'src/app/(tenant)/repairs' tests/tenant-repairs/*.ts tests/tenant-repairs/*.tsx --max-warnings=0` passed. Project typecheck `node node_modules/typescript/bin/tsc --noEmit` passed before snapshot preparation; the final isolated snapshot typecheck `node node_modules/typescript/bin/tsc --noEmit --project tests/tenant-repairs/.review-app/tsconfig.json` also passed.
- Production build: `npm.cmd run build` passed. Final build identity is recorded below. Existing warnings: Prisma package.json configuration deprecation and Next workspace-root inference from multiple lockfiles. No unrelated configuration was changed.
- Production Playwright: `PLAYWRIGHT_BASE_URL=http://localhost:3227` and isolated `DATABASE_URL` port 55427, `node node_modules/@playwright/test/cli.js test --project=tenant-repairs --output=tests/tenant-repairs/node_modules/runtime/results`: 3 passed. Covers tenant sign-in boundary, request/photo submission, tenant comments, manager-persisted status/comment display, phone/desktop layout, actual file chooser via keyboard, focus, count/removal, six-file rejection, notices and section navigation.
- Configured Playwright MCP observation: at 1280x844 and 390x844, no page overflow; authorized photos loaded. Whitespace submission returned focus to description; Tab focused Browse files with `rgb(49,89,217)` outline. A browser-only 404 exercised TenantPhoto fallback, then restored the real endpoint. Final comment input bottom 727.59px, navigation top 771.33px at 390x844. A temporary ENDED fixture lease showed the no-lease state with no submission form, then was restored to ACTIVE.

### Browser evidence

Before captures use the admitted source and existing production build `ssQleAh1_tyDgUNvsUgj5`. Before/after default captures use the same isolated standard seeded tenant and initial kitchen request. Test-created request/status screenshots deliberately show additional regression data. All PNGs below are individually committed evidence.

| Check | Evidence |
| --- | --- |
| Desktop before / after | [Before](../../tests/tenant-repairs/evidence/repairs-1280-before.png), [After](../../tests/tenant-repairs/evidence/repairs-1280-after.png) |
| 390px before / after | [Before](../../tests/tenant-repairs/evidence/repairs-390-before.png), [After](../../tests/tenant-repairs/evidence/repairs-390-after.png) |
| Keyboard validation / focus | [390px](../../tests/tenant-repairs/evidence/repairs-focus-390.png) |
| Five-photo limit | [390px](../../tests/tenant-repairs/evidence/repairs-limit-390.png) |
| Authenticated request/photo submission | [Submitted](../../tests/tenant-repairs/evidence/tenant-repairs-submitted.png) |
| Persisted manager updates | [Status/comments](../../tests/tenant-repairs/evidence/tenant-repairs-status.png) |
| Fixed-navigation clearance | [End](../../tests/tenant-repairs/evidence/repairs-end-390.png) |
| Unavailable photo | [Fallback](../../tests/tenant-repairs/evidence/repairs-photo-unavailable-390.png) |
| No active lease | [No lease](../../tests/tenant-repairs/evidence/repairs-no-lease-390.png) |

## Runtime and native review

The isolated PostgreSQL database listens on 55427 with its files under `tests/tenant-repairs/node_modules/runtime/postgres`; isolated storage is alongside it. No preserved Home/Lease review data was reused or changed. Standard `prisma/seed.ts` fixtures were used. Initial fixture preparation encountered directory initialization permissions, then succeeded after precreating the owned directory. The first demo-seed attempt was replaced by a reset of this fresh isolated database only and standard fixtures; the Prisma generator reported a locked DLL during that reset, while migrations and seeding succeeded. Subsequent production builds regenerated Prisma successfully after stopping the owned app.

A source snapshot under ignored `tests/tenant-repairs/.review-app` isolates the review build from concurrent shared-checkout builds. It is reconstructed from the admitted base plus this Task's committed Repairs changes, excluding concurrent Pay edits. Its application source and configuration match this candidate; dependencies are reused through a junction. An initial snapshot under node_modules was abandoned because Next deliberately skips path alias and TypeScript processing there. No application configuration change was made.

`tests/tenant-repairs/runtime.ps1` can restart the database (`db`) or app (`app`) from this checkout. Launch hidden with PowerShell process execution policy Bypass, as the host disables script execution by default. The auth secret is generated into ignored runtime data and is never a deliverable. The `seed` mode is only for deliberate fixture preparation, not restart. Database data, storage, logs, secret and dependencies stay on disk and are excluded from the commit.

The shared-checkout build passed, but its later browser rerun failed when a concurrent build replaced `.next/required-server-files.json`. Final browser checks use the isolated runtime instead.

Final runtime: `http://localhost:3227`, production build **SZJQyT5M5qQ6bfe8gG18w**, on source candidate `e376eaa3a6cba01d601aa531e48d079b74c89e97`. All 392 source files matched the snapshot after newline normalization. The final isolated production browser rerun passed all 3 tests. No push, merge, Preview publication or deployment was performed.

Native existing-Edge desktop/390px review is **not run; manager access requested after the runtime and candidate were ready**. Chromium results are not native Edge results. Runtime is prepared hidden for the manager to sign in using the standard seeded tenant and check layout, labels, keyboard focus, file chooser and request/comment feedback.

### Material limitation outside owned paths

The inherited manager maintenance status action persisted `IN_PROGRESS` to the isolated database but remained on Saving and did not refresh its board within 20 seconds. The manager comment action behaved similarly. No manager source was edited. The affected tenant regression explicitly waits for database persistence and reloads the manager before checking the tenant-visible status/comment; it does not certify live manager refresh. The original failing observation is disclosed separately from the final passing tenant regression. Tenant comment redirect was repaired within owned paths using the native POST route.

## Submitted scope

Application: repairs/page.tsx, RepairForm.tsx, repairs.module.css and comment/route.ts only. Tests and runtime helper are confined to tests/tenant-repairs; this handoff is docs/design/light-tenant-repairs.md. Existing untracked `prisma/.home-lease-review-postgres/` data remains untouched. Git supplies the exact changed-file manifest and candidate SHA.
