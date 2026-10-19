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

## Shared-client turnover

After the manager assigned Payment the next exclusive shared build/review slot, the repair-owned app listener on port 3227 (PID 58272) was stopped. No common `.next` or generated Prisma write was started, and no unrelated process was terminated. Although build output is isolated at `tests/tenant-repairs/.review-app/.next` (build `SZJQyT5M5qQ6bfe8gG18w`), the snapshot dependency junction targets the checkout node_modules, including its generated Prisma client. Stopping the repair app releases that shared DLL. Port 3227 had no listening entry afterward. The isolated database on 55427, source snapshot, storage and evidence remain preserved. Native Edge is still not run; no native grant is active. Restart only after the manager signals that Payment has released the shared-client slot. Earlier health/runtime-ready observations above precede this deliberate shutdown.

## Restored review readiness after slot release

The manager released the shared-client hold after Payment completed generation/build and released the client at 22:01:52 UTC. No rebuild, regeneration, reseed or completed regression was repeated. Before restoration, neither 3227 nor 55427 had a listening entry. The retained database and one isolated app were launched hidden with the runtime helper. The current Prisma schema and generated-client schema SHA-256 matched (`F0665D81FA55C1A8CD2AC2912431855CF41A65491537BBA84BA8C263C6BCA631`). A read-only query found the retained fixture lease once.

Observed readiness: `http://localhost:3227/sign-in` returned **200**. App listener PID **49436** serves isolated build **SZJQyT5M5qQ6bfe8gG18w**; PostgreSQL listener PID **38472** serves retained port **55427**. Source implementation remains `e376eaa3a6cba01d601aa531e48d079b74c89e97`; the previously tested handoff candidate is `6de3a2d3b8422cae1c28d5ce505c2e64e868b161`. Subsequent runtime-helper/handoff changes do not alter application source. Current shared HEAD also contains Payment work; this isolated output retains the recorded Repairs source snapshot.

The helper now guards against occupied ports, a missing fixture database and a changed build ID. A second app launch was deliberately attempted and rejected before starting another process. Start from the assigned checkout with hidden `Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','tests/tenant-repairs/runtime.ps1','app'`; use `db` only if the retained database port is free. Do not run `seed` for review restoration. To release the shared Prisma client, first identify the current 3227 listener with `netstat -ano`, verify it is this task-owned app, and stop only that confirmed PID with `Stop-Process`. Recorded PIDs are observations, not durable process identities; never stop a recycled PID. Preserve the retained database/storage.

No watchdog or indefinite hold is installed. Readiness is an observation at handoff, not a guarantee that the host will retain background processes after this turn. If it does not, the guarded restart is ready; do not repeatedly relaunch. Coordinate any later Prisma replacement before restarting or holding the app open.

**Native acceptance remains pending.** The previous human Edge window closed, no Repairs native review occurred, and no new desktop acquisition is authorized. The manager will coordinate the remaining review. No native pass, waiver or task acceptance is claimed by this readiness handoff.

## Manager native Edge review and final limitation

Manager observations were delivered under response `0d36d8d889e0e533312a030973e4836c6806f686922d9552e4e936aaf4bee523` after a fresh human grant at **22:40:10 UTC**. The desktop lease was released at **22:44:09 UTC**. Review used existing Edge temporary tab `712378481`, `http://localhost:3227`, isolated build `SZJQyT5M5qQ6bfe8gG18w`, source `e376eaa3a6cba01d601aa531e48d079b74c89e97`. These are manager-native observations, distinct from the automated Chromium evidence above.

| Native check | Observed result |
| --- | --- |
| Sign-in/navigation/loading | Seeded Alex sign-in and Home to Repairs passed. Native loading state briefly appeared. Active Repairs navigation and received/in-progress cards were correct. |
| Desktop and phone | 1699x888 and 390x844; scrollWidth 1684 and 375 respectively, no horizontal overflow. Light composition and labels passed. |
| Validation and keyboard | Whitespace request showed the description correction and focused `repair-description`. Tab reached Browse files with cobalt `rgb(49,89,217)` outline; Shift+Tab restored textarea focus. Enter on Browse files opened a multiple-file chooser. |
| Native request | A Plumbing/Normal, call-first request without a photo submitted using Enter: `Native Edge review: kitchen tap drips after closing. Demo request only.` Redirect reached `/repairs?notice=submitted`, showed Repair request sent and three requests. Request ID `cmvfubozj0001b958062uge0s`. Enter on Your requests navigated the section. |
| Native comment | Tab/Enter Send submitted `Native review comment: call before the demo visit.` Comment added and the exact persisted comment appeared without manual reload, at `/repairs?notice=commented#request-cmvfubozj0001b958062uge0s`. |
| Existing authenticated images | Both loaded: fan.png naturalWidth 1 and seed kitchen photo naturalWidth 480. |
| Phone navigation clearance | Final Send bottom 727.04px versus navigation top 771.33px. |
| Native selected-photo/upload feedback | **Not verified.** Browser upload approval was dismissed/cancelled when the manager attempted to select the seeded PNG. No file was selected or uploaded; the count stayed zero of five. No bypass was attempted. File chooser opening is verified; native photo selection/upload/feedback is not a pass and is not waived. Automated photo regressions remain separate evidence. |

One transient CDP read timeout after request submission recovered by reading the URL/screenshot without repeating submission; the manager did not identify an app failure. The temporary viewports were restored, the temporary tab closed and desktop lease released. Manager screenshots exist only in that tool transcript (desktop, phone validation/focus, cancelled-upload form, request sent, comment result, existing photos/clearance, final desktop requests); no filesystem paths were produced and none are invented.

The manager instructed candidate submission with this explicit native upload gap for assessment. This is a submitted candidate with a residual limitation, not full native acceptance, a waiver, or a claim that every native check passed. No further human window was requested and no desktop access was acquired by this Task.

## Released review runtime

After release, listener identities were verified against command lines: app PID 49436 ran `next start tests/tenant-repairs/.review-app -p 3227`; PostgreSQL PID 38472 used this Task's `tests/tenant-repairs/node_modules/runtime/postgres` directory on 55427. Process inspection required read elevation because the sandbox denied CIM access. The verified app was stopped and the database was shut down gracefully with its `pg_ctl stop -m fast -w`; both listener entries disappeared. The verified database helper child 22736 and its PowerShell wrapper 54976 were then stopped. No unrelated listener, shared dependency or sibling process was stopped. Fixture, storage, source snapshot and build output remain on disk; review data created by the manager is preserved. No push, integration, Preview publication or deployment was performed. Application source and all unchanged passing regression evidence are reused.
