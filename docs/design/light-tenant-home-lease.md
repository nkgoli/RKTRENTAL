# Light tenant Home and Lease handoff

Implemented **Implement light tenant Home and Lease screens**. Source, automated checks and comparison captures are ready. The required existing-Edge desktop/390px check is **pending / not run**. The manager confirmed that existing-Edge access will be coordinated after readiness; this task must not acquire the desktop or request a human window independently. This is a committed implementation candidate, not native acceptance, integration, publication or deployment.

## Candidate and runtime

- Repository `repository:1ace516f-ddc8-43b2-8a40-4ce6d93792ad`, generation 1.
- Assigned checkout: `C:/Users/nkgol/RocketRental/.orchestra/workspaces/@77wn7akei3m15n3caem/repository`.
- Assigned branch verified: `orchestra/work-2gcjdifqik3o7helc0b-3snxasj44s4939w8otu`; initial HEAD `b62f7666dbe4c644f825904201bf29b2b6bb8fdf`, initially clean index/worktree.
- Exact reviewed foundation `37314def68c96b2cf550b0f18a90ad9c42425d75` integrated with `git merge --no-edit --no-overwrite-ignore`, a clean fast-forward. `git merge-base --is-ancestor` exited 0. No foundation source was authored or changed; a scoped diff against this revision for shared components, styles, fonts and foundation handoffs was empty.
- Committed application implementation: `3467aa9be2dfd03ea590e1e43313e958f2d2c264`. The subsequent evidence commit adds this handoff, captures and viewport-end capture lines to the test only; application source remains identical.
- Final Next 15.5.27 production build ID: `ssQleAh1_tyDgUNvsUgj5`. Production runtime: `http://localhost:3226`, from the assigned checkout and the implementation above. It is left ready for the pending native check.
- Isolated PostgreSQL on localhost port 55426; newly initialized directory `prisma/.home-lease-review-postgres`, 19 migrations applied and normal seed produced 4 properties, 45 units and 41 occupied leases. The file-refusal regression also creates its own second-tenant fixture in this database. Existing databases were not migrated or seeded. Seeded local files are in this checkout's `.data/storage`.
- Before runtime: exact foundation revision reconstructed using `git archive`, separately served at port 3227 with the same isolated database and explicit `STORAGE_LOCAL_DIR` pointing to the same seeded storage. That server is stopped. The reconstruction is retained under the evidence directory's ignored `node_modules/baseline` so test discovery does not traverse it; it is runtime data, not a deliverable.
- No push, target-main integration, Preview publication or deployment performed.

## Design and behavior mapping

Read `Designs/rocketrental-light-tenant` revision 27: `tenant-home`, `tenant-home-desktop`, `tenant-lease`, `tenant-lease-desktop`; and `Designs/rocketrental-light-system` revision 7, including shared controls and responsive navigation. Reused the exact inherited foundation API/source map in `light-foundation.md`, `light-system.md`, `light-system-icons.json` and `light-rollout-coverage.md/json` unchanged.

| Route / state | Implementation and approved reference |
| --- | --- |
| `/home`, 390px and desktop | Responsive live rent hero, approved cobalt/teal treatment, two-column quick actions, renewal/move-out notice, open repair and announcements; maps to both Home screens. Approved 1.7-stroke payment, lease, maintenance, folder and arrow geometry is local to `home/PortalIcon.tsx`. |
| Home balance / ledger | Existing amount-due calculation, due date, autopay copy, pending bank amount, settled balance and payment/receipt links retained. Settled text uses teal. Activity content and tone come from the live ledger; there are no specimen amounts or invented announcements. |
| Home repair / notices | Existing source repair status, vendor presence and progress retained. Missing repair/notice omitted. Recorded move-out replaces renewal using the existing loader; live lease term and notice text preserved. |
| `/lease`, 390px and desktop | Tenant heading, wrapping section links, tinted current-lease header, exact 40px court miniature geometry, compact definition list, counted documents and unit photos; maps to both Lease screens. |
| Lease states | Co-tenants/occupants, term, rent, deposit, move-out dates and enabled/disabled autopay remain source-backed. No occupants row without other occupants. No photos section/link without photos. Empty documents retain the approved explanation. |
| Documents and photos | Unchanged `canPreview` MIME gate, authenticated preview/download URLs, new-tab/noreferrer semantics and authenticated `/lease/photos/{id}` sources. File-read errors remain endpoint responses. Photo failure retains its accessible name and now also detects failure completed before hydration attaches `onError`. Loaded captions use a readable white surface. |
| No active lease | Existing route-specific Check again and explanation retained on both pages, within the compact page presentation. |
| Loading, error, account and recovery | Consumed existing tenant loading/error boundaries and shared recovery/account controls unchanged. Existing loading status, retry reset and Back to home behavior remain in their owners' components. No design state catalog is rendered in production. |

The supported foundation shell is intentionally unchanged: sticky header, fixed tenant navigation, safe-area padding and 100px content reservation. The static design's in-flow navigation is not used at runtime. Full-page captures therefore show the fixed bar at its viewport position across the tall capture; separate scrolled viewport-end images and bounding-box assertions verify that the last action is reachable above it. The inherited shell header/account treatment is retained as required. Live status, dates, number of receipts and seeded photo count can differ from specimen data.

`portal.module.css` retains existing exports for Pay/Repairs. New Home/Lease composition is scoped under `homeLease`; document layout adjustments are scoped to Lease. `TenantPhoto` props (`src`, `alt`, optional `caption`) and the legacy `photo` class remain compatible. No authorization, loader, financial calculation, action, MIME policy or persistence source was edited.

## Observed verification

| Check | Observed result |
| --- | --- |
| Unit/component regressions | `node node_modules/vitest/vitest.mjs run --config vitest.config.ts tests/tenant-portal/portal.test.ts tests/tenant-portal/states.test.tsx tests/tenant-portal/light-home-lease.test.tsx`: **3 files, 22 passed**. Includes source-backed amounts/pending funds, settled/empty/notice/repair states, conditional occupants/photos, move-out, MIME-gated links, authenticated photo URLs, empty documents and route retries. |
| Scoped lint | `node node_modules/eslint/bin/eslint.js` against Home, Lease page, TenantPhoto and the three affected test files with `--max-warnings=0`: **exit 0**. The final viewport-capture-only test addition was separately linted successfully. |
| Typecheck | `node node_modules/typescript/bin/tsc --noEmit`: **exit 0**. |
| Production build | `npm.cmd run build` with the isolated database URL: **exit 0**, Prisma generated, Next compiled and typechecked, 22 static pages generated, traces completed. |
| Final production browser regressions | With `PLAYWRIGHT_BASE_URL=http://localhost:3226`, isolated database URL and `TENANT_PORTAL_EVIDENCE_PHASE=after`: `node node_modules/@playwright/test/cli.js test tests/tenant-portal/ux.spec.ts tests/tenant-portal/portal.spec.ts --project=tenant-portal --workers=1`: **9 passed in 14.4s**. Auth redirects, live Home, own PDF preview/download, another tenant's file refused with 403, keyboard section links, payment review/back, repair validation, account recovery and zero Axe violations at 390/1280. No payment or repair submitted. |
| Final viewport evidence addition | The two visual evidence tests were rerun against the same production build: **2 passed**. They await fonts/lazy photos, capture pages, focus/scroll the last action, assert it is above fixed navigation, assert no horizontal overflow, and save scrolled viewport-end images. |
| Before captures | The same two visual evidence tests against unchanged foundation runtime 3227: **2 passed** at 390/1280 with the same database/storage fixtures. |
| Own configured Playwright observation | Signed in and read live Home; captured Home/Lease at 390/1280 and observed no horizontal overflow. Later calls intermittently failed with `MCP_SESSION_NOT_FOUND`; final evidence was refreshed by the authorized Playwright regression runner against production. Runner Chromium is distinct from existing native Edge. |
| Patch / inheritance hygiene | `git diff --check`: **exit 0**. Reviewed foundation is an exact ancestor; foundation-path diff empty. Only task-owned source, tests, handoff and captures committed. |
| Existing native Edge | **Not run / pending manager access decision.** Neither the Chromium regressions nor screenshots establish a native Edge result. |

Transient setup/check failures were repaired: the workspace initially lacked local dependencies; Prisma engine download required approved network execution. Regeneration while the dev runtime held its DLL failed, then succeeded after stopping that runtime. A nested archive reconstruction was initially included by broad test discovery and produced invalid duplicate-source test failures; it was isolated under ignored `node_modules`, and explicit current tests passed. The old `.phone-hero` CSS test selector was replaced by the labelled rent region. The added broken-image check initially exposed the hydration race described above and passes after its fix. Temporary browser-cache permissions were resolved by using a task-local temporary directory. Existing Prisma configuration, Vite native-loader and Next multiple-lockfile warnings remain warnings.

## Captures

All links below are task-owned screenshot files. After images are from the production build above. Before images use the exact admitted foundation; both show the same live seeded data. No real unit photography is introduced.

| Surface | Before | After | Scrolled action clearance |
| --- | --- | --- | --- |
| Home 390px | [Before](../../tests/tenant-portal/evidence/light-home-lease/home-390-before.png) | [After](../../tests/tenant-portal/evidence/light-home-lease/home-390-after.png) | [End](../../tests/tenant-portal/evidence/light-home-lease/home-390-end-after.png) |
| Home desktop 1280px | [Before](../../tests/tenant-portal/evidence/light-home-lease/home-1280-before.png) | [After](../../tests/tenant-portal/evidence/light-home-lease/home-1280-after.png) | [End](../../tests/tenant-portal/evidence/light-home-lease/home-1280-end-after.png) |
| Lease 390px | [Before](../../tests/tenant-portal/evidence/light-home-lease/lease-390-before.png) | [After](../../tests/tenant-portal/evidence/light-home-lease/lease-390-after.png) | [End](../../tests/tenant-portal/evidence/light-home-lease/lease-390-end-after.png) |
| Lease desktop 1280px | [Before](../../tests/tenant-portal/evidence/light-home-lease/lease-1280-before.png) | [After](../../tests/tenant-portal/evidence/light-home-lease/lease-1280-after.png) | [End](../../tests/tenant-portal/evidence/light-home-lease/lease-1280-end-after.png) |

[Lease photo failure, 390px](../../tests/tenant-portal/evidence/light-home-lease/lease-photo-fallback-390-after.png) uses a browser-only intercepted 404 to exercise the real component fallback. Loaded-photo checks use the normal authenticated seeded endpoint.

## Changed paths and pending decision

Application changes: `src/app/(tenant)/home/page.tsx`, `home/PortalIcon.tsx`, `lease/page.tsx`, `TenantPhoto.tsx`, `portal.module.css`. Tests: `tests/tenant-portal/portal.spec.ts`, `ux.spec.ts`, `light-home-lease.test.tsx`. Handoff: this document. Evidence: the thirteen individually linked PNGs above. Git is the authoritative manifest of submitted changes; ignored fixture/runtime directories and database files are not submitted.

The remaining decision is native existing-Edge access or manager-provided native verification for this exact implementation at desktop and 390px. Keep the task awaiting that check; do not interpret this handoff as native acceptance or final task closure. The production runtime and isolated database remain running for it. Readiness was rechecked after the manager response: both ports 3226 and 55426 were listening, build ID unchanged, application source unchanged and index clean. The observed ready HEAD was `101b31799ee25f529423adb3f3384accd7e65a43`; the following documentation-only commit is identified by the typed readiness report.

### Remaining native checklist

After the manager grants access, record the exact final HEAD, build ID, existing Edge version and actual desktop/390px viewport dimensions.

1. Open `/home` and `/lease` with the isolated seeded tenant session at desktop and 390px. Inspect compact type, approved icons, contrast, wrapping and horizontal clipping; capture both routes at each width.
2. Scroll to the final actions and photos. Confirm the fixed bar stays visible and content/actions clear it; check the active tab and section-anchor destinations.
3. Use Tab, Shift+Tab and Enter through quick actions, lease sections and document controls. Confirm visible focus, navigation and access to the last document action above the bar.
4. Open the tenant's PDF preview and download, then inspect authenticated photos. Confirm the existing new-tab/download behavior; record actual success or endpoint failure. Do not submit payments or repairs.
5. Return Home and verify navigation/account recovery as needed. Add native screenshots and observed limitations to this handoff; report the native check as passed only after it runs, then request final task completion.

### Runtime continuity and restart

At readiness, the owned production process is session `48991` and the isolated database process is session `32185`. Those process handles may not survive turnover; probe ports first and reuse this verified runtime when still available. The comparison server is stopped. Database data, local seeded storage, dependencies and ignored baseline reconstruction remain on disk.

From the assigned checkout, restart the existing isolated database only if port 55426 is no longer listening:

```powershell
$env:ROCKETRENTAL_DB_PORT = '55426'
$env:ROCKETRENTAL_DB_DIR = Join-Path (Get-Location) 'prisma/.home-lease-review-postgres'
node --import ./prisma/os-userinfo.mjs prisma/local-postgres.mjs
```

In a separate PowerShell process in the same checkout, reuse the already built candidate when `.next/BUILD_ID` matches the recorded build. Set a fresh local review auth secret if the prior process environment is unavailable; this requires a new seeded-tenant sign-in.

```powershell
$env:DATABASE_URL = 'postgresql://rocketrental:rocketrental@localhost:55426/rocketrental?schema=public'
$env:STORAGE_LOCAL_DIR = Join-Path (Get-Location) '.data/storage'
$env:ROCKETRENTAL_AUTH_SECRET = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
$env:ROCKETRENTAL_SANDBOX = 'true'
$env:ROCKETRENTAL_AUTH_COOKIE_SECURE = 'false'
node node_modules/next/dist/bin/next start -p 3226
```

Do not reinitialize, migrate or reseed the preserved fixture database just to restart it. If a rebuild is necessary, stop the owned app runtime before `npm.cmd run build` so Prisma's Windows DLL is released, and record the replacement build ID before native checks. No older dashboard desktop grant applies here.
