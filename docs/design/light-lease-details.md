# Light lease details and agreement states

The five detail sections are implemented from **Designs/rocketrental-light-leasing revision 46** (lease-detail and lease-detail-phone), using the foundation from **Designs/rocketrental-light-system revision 7**. The scoped production-flow repair is complete: **37 unit/component tests and all 13 production browser tests pass**, along with lint, typecheck and the production build. Successful saves, activation and termination show their outcomes without a manual reload. Native Edge review remains pending; no native acceptance is claimed.

## Candidate and build identity

| Item | Observed value |
| --- | --- |
| Assigned checkout | `C:\Users\nkgol\RocketRental\.orchestra\workspaces\@47sysz2qw2on72fs3ld\repository` |
| Branch | `orchestra/work-2gcjdifqik3o7helc0b-5anptni2a2mg6nn3f1e` |
| Initial HEAD | `b62f7666dbe4c644f825904201bf29b2b6bb8fdf` |
| Required foundation | `37314def68c96b2cf550b0f18a90ad9c42425d75` |
| Final application candidate | `05c439b76ce1c05435f9d2632d0c43a214f48403` |
| Final production build | `QgtMAn84xA6NpYNLERfEP` |
| Original visual candidate / build | `74eeb99c3450c1a57d977f4e62c9939faacb520e` / `yLc5xB0YWb0kJrdHoEoj3` |
| Preserved handoff before repair | `05586c963ac48032616bb7ea58b8c3d676b2dddf` |
| Action/navigation repair / first repair build | `f8e44a38cf11932d1feb61068821b9b3674b6aa5` / `dV61iZi2Sr6X0vsTA-PsX` |
| Baseline screenshot build | `gc-MHYls_HHTT3M02k1cY` on the exact foundation |
| Separate foundation comparison build | `s5mFh-o0RXBe_oFfBg-9F` on the exact foundation |

The initially clean checkout was fast-forwarded to the permitted exact foundation without conflicts before editing. `git merge-base --is-ancestor 37314def68c96b2cf550b0f18a90ad9c42425d75 HEAD` returned 0. The application candidate contains only this slice's implementation and tests. The enclosing handoff commit changes this document only; the running bundle remains the exact application candidate above. No target-main integration, push, Managed Preview publication or deployment was performed.

## Implemented behavior

- Overview uses the light terms band, premises, tenants, agreement/move-out and rent summary cards. Agreement uses accessible disclosures and retains the immutable signed snapshot and amendments route. Payments retains the real ledger; Activity presents real signature states and lease events.
- The existing shell, fonts, controls and property icon are reused. Scoped styles handle desktop/390px layout, long names and signed wording, document controls and keyboard focus. No specimen catalog or design sample data is rendered by the application.
- Existing permission checks, terms/notice validation, activation eligibility, termination action, authenticated document endpoints and MIME/25 MB gates remain in place. Forms preserve invalid input, associate errors with fields and expose pending/result feedback. Document rename and delete expose success/error feedback, and delete/terminate confirmations restore focus on cancel. Existing unavailable tenant sharing remains disabled.
- `propertyId`/`unitId` propagation and derived property/unit return targets are preserved and verified. Lease section/body/return navigation uses document links; the existing `LeaseSectionNavigation` resize observer is unchanged. Repeated section transitions, keyboard activation and selected-tab visibility after resize pass at both widths.

## Automated and production verification

Commands ran in the assigned checkout with the isolated local database and storage. Database work stayed on disk; no database export is submitted.

| Check | Command/result |
| --- | --- |
| Affected unit/component tests | `node node_modules/vitest/vitest.mjs run --config vitest.config.ts tests/leases tests/lease-create/workflow-ux.test.tsx` — **7 files, 37 tests passed**. [Log](../../tests/leases/.runtime/repair-unit.log). |
| Scoped lint | `node node_modules/eslint/bin/eslint.js 'src/app/(manager)/leases/[id]' 'src/app/(manager)/leases/LeaseForms.tsx' tests/leases --ignore-pattern 'tests/leases/.runtime/**' --max-warnings=0` — **exit 0**. Generated runtime/cache files are excluded. [Log](../../tests/leases/.runtime/repair-lint.log). |
| Typecheck | `node node_modules/typescript/bin/tsc --noEmit` — **exit 0**. [Log](../../tests/leases/.runtime/repair-typecheck.log). |
| Production build | `npm.cmd run build` — **exit 0**, exact final build above. [Log](../../tests/leases/.runtime/repair-build.log), [exit status](../../tests/leases/.runtime/repair-build-exit.txt). |
| Patch whitespace | `git diff --check` — **passed**. |
| Production browser | `node node_modules/@playwright/test/cli.js test tests/leases/light-details.spec.ts tests/leases/leases.spec.ts --project=leases --workers=1 --grep-invert 'manager starts a renewal'` — **13 passed**, exit 0. The excluded renewal case belongs to the wizard slice. [Final log](../../tests/leases/.runtime/repair-production-browser.log). |
| Direct-route visual captures | Five sections at 1280x900 and 390x844, full-page captures: **10 final and 10 baseline captures; no document horizontal overflow**. [Final capture log](../../tests/leases/.runtime/repair-captures.log). |
| Native browser | **Not run**; manager-coordinated existing-Edge observation remains pending. |

The configured Playwright MCP was attempted and returned `MCP_SESSION_NOT_FOUND`. The supported fallback used the repository Playwright runner in an isolated Chromium automation context against the direct local production runtime. Personal Edge was not attached. Successful production requests were not buffered or substituted for acceptance. Tests deliberately simulated upload/delete errors and delayed one invalid terms request to observe pending feedback.

### Final browser outcomes by flow

| Flow | Desktop 1280 | Phone 390 |
| --- | --- | --- |
| Scoped tabs, body/return links, keyboard and selected-tab resize | **Passed**, including two complete section cycles and canonical scope after invalid caller IDs. | **Passed**, including two complete section cycles and canonical scope after invalid caller IDs. |
| Terms/notice invalid input, pending state, save and signed snapshot | **Passed**, including database persistence and unchanged signed snapshot. | **Passed**, including database persistence and unchanged signed snapshot. |
| Document MIME/size gates, upload error/retry, authenticated download, rename/blank-name error, disabled sharing, delete cancel/error/retry and concurrent uploads | **Passed**. | **Passed**. |
| Empty documents/ledger, no completed signature, real Signed/Awaiting/Declined states, populated rent summary | **Passed**. | **Passed**. |
| Draft/ended restrictions and fixture termination | Combined status test uses phone width. | **Passed**: blocked-unit feedback, eligible activation with visible Active/success, ended restrictions, termination cancel/focus restoration and confirmed Terminated state. |

Three existing affected browser tests also passed: manager detail/upload flow, manager-session requirement, and keyboard/phone layout flow. A new result-route check verifies unauthenticated redirection and an unavailable-lease 404. All 13 passed in one final run; earlier partial attempts are not combined into this result. The success helper observes the actual action 303 and result-document 303 before checking the final agreement URL and visible content. No test reloads a page to make a mutation appear successful.

### Production diagnosis and bounded repair

The original foundation was archived and built separately without source changes, using the same installed dependencies and isolated database. Against its temporary runtime on port 3235, an invalid terms submission showed the original validation error; a subsequent valid submission returned HTTP 200, but the original form remained **Saving…** after 20 seconds. [Comparison log](../../tests/leases/.runtime/baseline-flow.log). That comparison server has been stopped.

This establishes that the stuck-save symptom can occur before this slice; it does not prove every failure has the same cause. The original visual candidate's [8-pass/4-fail log](../../tests/leases/.runtime/final-production-browser.log) and exact foundation comparison remain preserved. A diagnostic response-buffering experiment changed the outcome but was not used for acceptance.

After the manager authorized bounded diagnosis/repair, an independent navigation trace observed one complete section cycle succeed, then the next Agreement client transition stall despite a Flight HTTP 200 response. A normal document request to that same destination immediately rendered the selected section. [Navigation comparison](../../tests/leases/.runtime/navigation-comparison.log). The page now uses document links for its section/body/return navigation; no global router configuration changed.

The applicant repair handoff at `936c6a7` and manager-tenant repairs `7b96246e161caba6516a317f5e0e49a9aabf3eec` / `a0c727c41b4d8261696f1247202579eba0aae709` were read as prior evidence. The installed Next action reducer was also inspected: a redirect without Flight data takes its document-navigation fallback. Lease wrappers now call the original actions unchanged and, only after success, redirect through `/leases/[id]/result`. The result route authenticates the manager and authorized organization/lease, returns uncached 204 for its internal RSC request, and a relative 303 for the browser. It derives scope from the authorized lease and forwards only the known success flag. Terms/notice forms reopen with saved feedback; invalid input stays in the existing form. Existing mutation, financial setup, eligibility, confirmation and revalidation logic remains in the original actions/services.

The first repair build passed all four original failing flows. Its broader run then exposed a distinct phone upload-list refresh failure; [first repair log](../../tests/leases/.runtime/repair-first-browser.log) records 11 passes and two failures, the second being a test that attempted browser navigation to an intentionally empty 404. That security assertion now inspects the authenticated HTTP response directly.

Document controls now apply only confirmed results to their local list. Each successful upload supplies its stored metadata without leaving the page or cancelling other uploads. Rename uses an owned `/leases/[id]/documents/rename` JSON endpoint that calls the existing authenticated, organization/lease-scoped action and forces the lease ID from the route; it returns the persisted normalized name. Delete still uses the existing authenticated file API. Failed rename/delete retain the file and retry controls. These changes avoid the stale streamed refresh while preserving the uploader, MIME/size gates, file endpoints and permission checks. Concurrent upload and failure/retry checks pass at both widths.

The exact framework-internal defect remains undetermined. The scoped transport corrections are verified on production; no dependency upgrade, global configuration change, artificial response buffering or manual reload was used to obtain the final passing outcomes.

## Screenshot and route mapping

All before/after captures use the isolated seeded lease `/leases/seed-lease-maple-11?tab=<section>`, with live fixture data. Baseline captures were taken on the exact foundation before source edits; final captures were taken on build `QgtMAn84xA6NpYNLERfEP` at 2026-10-19 22:42 UTC. Minor document-list changes reflect fixture uploads during testing. Original visual-candidate captures remain under `.playwright-mcp/lease-details/pre-repair/`; the links below identify the final build.

| Section | Before desktop / phone | Final desktop / phone |
| --- | --- | --- |
| Overview | [1280](../../.playwright-mcp/lease-details/before-overview-1280.png) / [390](../../.playwright-mcp/lease-details/before-overview-390.png) | [1280](../../.playwright-mcp/lease-details/after-overview-1280.png) / [390](../../.playwright-mcp/lease-details/after-overview-390.png) |
| Agreement | [1280](../../.playwright-mcp/lease-details/before-agreement-1280.png) / [390](../../.playwright-mcp/lease-details/before-agreement-390.png) | [1280](../../.playwright-mcp/lease-details/after-agreement-1280.png) / [390](../../.playwright-mcp/lease-details/after-agreement-390.png) |
| Documents | [1280](../../.playwright-mcp/lease-details/before-documents-1280.png) / [390](../../.playwright-mcp/lease-details/before-documents-390.png) | [1280](../../.playwright-mcp/lease-details/after-documents-1280.png) / [390](../../.playwright-mcp/lease-details/after-documents-390.png) |
| Payments | [1280](../../.playwright-mcp/lease-details/before-payments-1280.png) / [390](../../.playwright-mcp/lease-details/before-payments-390.png) | [1280](../../.playwright-mcp/lease-details/after-payments-1280.png) / [390](../../.playwright-mcp/lease-details/after-payments-390.png) |
| Activity | [1280](../../.playwright-mcp/lease-details/before-activity-1280.png) / [390](../../.playwright-mcp/lease-details/before-activity-390.png) | [1280](../../.playwright-mcp/lease-details/after-activity-1280.png) / [390](../../.playwright-mcp/lease-details/after-activity-390.png) |

Final-build state evidence:

- Terms errors: [desktop](../../.playwright-mcp/lease-details/terms-error-1280.png), [phone](../../.playwright-mcp/lease-details/terms-error-390.png); notice errors [desktop](../../.playwright-mcp/lease-details/notice-error-1280.png), [phone](../../.playwright-mcp/lease-details/notice-error-390.png); saved agreement [desktop](../../.playwright-mcp/lease-details/agreement-saved-1280.png), [phone](../../.playwright-mcp/lease-details/agreement-saved-390.png).
- Upload gates: [desktop](../../.playwright-mcp/lease-details/upload-gates-1280.png), [phone](../../.playwright-mcp/lease-details/upload-gates-390.png). Upload failure/retry: [desktop](../../.playwright-mcp/lease-details/upload-failure-1280.png), [phone](../../.playwright-mcp/lease-details/upload-failure-390.png).
- Delete failure/long filename: [desktop](../../.playwright-mcp/lease-details/document-delete-error-1280.png), [phone](../../.playwright-mcp/lease-details/document-delete-error-390.png).
- Empty ledger: [desktop](../../.playwright-mcp/lease-details/ledger-empty-1280.png), [phone](../../.playwright-mcp/lease-details/ledger-empty-390.png). Pending signatures: [desktop](../../.playwright-mcp/lease-details/signature-pending-1280.png), [phone](../../.playwright-mcp/lease-details/signature-pending-390.png). [Ineligible activation](../../.playwright-mcp/lease-details/draft-ineligible-390.png).
- Scoped navigation/keyboard: [desktop](../../.playwright-mcp/lease-details/scoped-agreement-1280.png), [phone](../../.playwright-mcp/lease-details/scoped-agreement-390.png). Phone [ended restrictions](../../.playwright-mcp/lease-details/ended-agreement-390.png), [termination confirmation](../../.playwright-mcp/lease-details/terminate-confirm-390.png), and [confirmed termination](../../.playwright-mcp/lease-details/terminated-390.png).

## Hidden review runtime and isolated fixtures

The hidden production server is ready at **http://127.0.0.1:3234**, with `/sign-in` returning 200. Its process record is [runtime.json](../../tests/leases/.runtime/runtime.json): PID 32388, started at `2026-10-19T22:41:25.5620889Z`, source/build as above. The helper checks PID plus process start time before stopping its server. It launches with `-WindowStyle Hidden` and does not open a browser. No review window is being held or awaited; this records runtime readiness for the manager.

PostgreSQL is local on port **55434**; its data and local file storage remain under `tests/leases/.runtime/`. The database was created for this review, migrated and seeded from the repository seed. Use the repository's standard seeded manager account; no live account or external payment/e-sign operation is needed. Runtime records, logs, screenshots, downloads and database files are local evidence, not tracked product files.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/leases/review-runtime.ps1 -Action Status
# Start and Stop are available for this server; Start requires the existing database and build.
```

The six dedicated fixtures were restored after the final test run using `node --import ./prisma/os-userinfo.mjs --import tsx tests/leases/light-fixtures.ts`; it returned 0 and reported six prepared fixtures. The fixture helper rejects database hosts other than localhost/127.0.0.1 or ports other than 55434. It resets only its dedicated fixture records; the standard seed was not rerun.

For a scoped route, use `/leases/<lease-id>?propertyId=seed-property-maple&unitId=<unit-id>&tab=<section>`. Sections are `overview`, `agreement`, `documents`, `payments`, `activity`. The expected scoped return target is `/properties/seed-property-maple/leases?unit=<unit-id>`, and the ledger target is `/properties/seed-property-maple/payments?unit=<unit-id>`.

| Lease id | Unit id | Review state |
| --- | --- | --- |
| `light-detail-active` | `light-detail-active-unit` | Active, signed immutable snapshot, long contact/signed wording, terms and notice forms; initially empty documents. |
| `light-detail-draft` | `light-detail-draft-unit` | Eligible draft activation; fixture-only mutation. |
| `light-detail-blocked` | `light-detail-active-unit` | Draft conflicts with an existing active lease; validation message. |
| `light-detail-ended` | `light-detail-ended-unit` | Ended, no signed snapshot, empty documents/ledger/signature state. |
| `light-detail-pending` | `light-detail-pending-unit` | Partially signed with Signed, Awaiting and Declined tenant events. |
| `light-detail-terminate` | `light-detail-terminate-unit` | Active, dedicated confirmation/cancel/termination fixture. |

## Pending manager-coordinated native checklist

The previous human review window is closed. Use existing Edge only through a future manager-coordinated observation. No desktop was acquired and no replacement window requested. These are pending checks, not claimed results.

- Sign in to the hidden review runtime; inspect all five sections at desktop and 390px, including long text/file names, reachable controls and absence of page overflow.
- On the active scoped route, follow tab/body/back/payment links. Use Tab, Shift+Tab and Enter; confirm visible focus and selected Activity tab visibility after resizing to 390px.
- Exercise invalid and valid terms/notice submissions, pending and success feedback, date ordering and unchanged signed snapshot. Record whether the streaming/navigation failure recurs.
- Verify blocked draft feedback, eligible draft activation, ended restrictions, and dedicated fixture termination confirmation, cancel/focus restoration, then confirmation.
- Check upload type/size errors, retry, preview/download through authenticated endpoints, rename feedback, disabled sharing, and delete cancel/confirm/error recovery. Native download remains unobserved even though automated Chromium downloads passed.
- Inspect populated and empty ledger, no completed signature, and Signed/Awaiting/Declined states. Do not initiate a real payment or external e-sign message.

The corrected committed candidate and required automated checks are ready for review. Coordinated native Edge observations remain pending; this handoff does not claim independent acceptance or target-branch delivery.
