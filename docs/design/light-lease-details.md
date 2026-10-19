# Light lease details and agreement states

The five detail sections are implemented from **Designs/rocketrental-light-leasing revision 46** (lease-detail and lease-detail-phone), using the foundation from **Designs/rocketrental-light-system revision 7**. The committed implementation and production build are available for review. **Browser acceptance is blocked:** the final production run passed 8 of 12 tests; client navigation and some successful mutations intermittently fail to update the displayed page. The same stuck-save symptom was reproduced on the unchanged foundation. Native Edge review has not been performed.

## Candidate and build identity

| Item | Observed value |
| --- | --- |
| Assigned checkout | `C:\Users\nkgol\RocketRental\.orchestra\workspaces\@47sysz2qw2on72fs3ld\repository` |
| Branch | `orchestra/work-2gcjdifqik3o7helc0b-5anptni2a2mg6nn3f1e` |
| Initial HEAD | `b62f7666dbe4c644f825904201bf29b2b6bb8fdf` |
| Required foundation | `37314def68c96b2cf550b0f18a90ad9c42425d75` |
| Application candidate | `74eeb99c3450c1a57d977f4e62c9939faacb520e` |
| Final production build | `yLc5xB0YWb0kJrdHoEoj3` |
| Baseline screenshot build | `gc-MHYls_HHTT3M02k1cY` on the exact foundation |
| Separate foundation comparison build | `s5mFh-o0RXBe_oFfBg-9F` on the exact foundation |

The initially clean checkout was fast-forwarded to the permitted exact foundation without conflicts before editing. `git merge-base --is-ancestor 37314def68c96b2cf550b0f18a90ad9c42425d75 HEAD` returned 0. The application candidate contains only this slice's implementation and tests. The enclosing handoff commit changes this document only; the running bundle remains the exact application candidate above. No target-main integration, push, Managed Preview publication or deployment was performed.

## Implemented behavior

- Overview uses the light terms band, premises, tenants, agreement/move-out and rent summary cards. Agreement uses accessible disclosures and retains the immutable signed snapshot and amendments route. Payments retains the real ledger; Activity presents real signature states and lease events.
- The existing shell, fonts, controls and property icon are reused. Scoped styles handle desktop/390px layout, long names and signed wording, document controls and keyboard focus. No specimen catalog or design sample data is rendered by the application.
- Existing permission checks, terms/notice validation, activation eligibility, termination action, authenticated document endpoints and MIME/25 MB gates remain in place. Forms preserve invalid input, associate errors with fields and expose pending/result feedback. Document rename and delete expose success/error feedback, and delete/terminate confirmations restore focus on cancel. Existing unavailable tenant sharing remains disabled.
- `propertyId`/`unitId` propagation and derived property/unit return targets remain in the source. The existing `LeaseSectionNavigation` resize observer is unchanged. Comprehensive client-navigation verification remains pending because of the failures below.

## Automated and production verification

Commands ran in the assigned checkout with the isolated local database and storage. Database work stayed on disk; no database export is submitted.

| Check | Command/result |
| --- | --- |
| Affected unit/component tests | `node node_modules/vitest/vitest.mjs run --config vitest.config.ts tests/leases tests/lease-create/workflow-ux.test.tsx` — **5 files, 22 tests passed**. [Log](../../tests/leases/.runtime/unit.log). |
| Scoped lint | `node node_modules/eslint/bin/eslint.js 'src/app/(manager)/leases/[id]' 'src/app/(manager)/leases/LeaseForms.tsx' tests/leases --ignore-pattern 'tests/leases/.runtime/**' --max-warnings=0` — **exit 0**. Generated runtime/cache files are excluded. |
| Typecheck | `node node_modules/typescript/bin/tsc --noEmit` — **exit 0**. [Log](../../tests/leases/.runtime/typecheck.log). |
| Production build | `npm.cmd run build` — **exit 0**, exact final build above. [Log](../../tests/leases/.runtime/final-build.log), [exit status](../../tests/leases/.runtime/build-exit.txt). |
| Patch whitespace | `git diff --check` — **passed**. |
| Production browser | `node node_modules/@playwright/test/cli.js test tests/leases/light-details.spec.ts tests/leases/leases.spec.ts --project=leases --workers=1 --grep-invert 'manager starts a renewal'` — **8 passed, 4 failed**, exit 1. The excluded renewal case belongs to the wizard slice. [Final log](../../tests/leases/.runtime/final-production-browser.log). |
| Direct-route visual captures | Five sections at 1280x900 and 390x844, full-page captures: **10 final and 10 baseline captures; no document horizontal overflow**. [Final capture log](../../tests/leases/.runtime/final-captures.log). |
| Native browser | **Not run**; manager-coordinated existing-Edge observation remains pending. |

The configured Playwright MCP was attempted and returned `MCP_SESSION_NOT_FOUND`. The supported fallback used the repository Playwright runner in an isolated Chromium automation context against the direct local production runtime. Personal Edge was not attached. Successful production requests were not buffered or substituted for acceptance. Tests deliberately simulated upload/delete errors and delayed one invalid terms request to observe pending feedback.

### Final browser outcomes by flow

| Flow | Desktop 1280 | Phone 390 |
| --- | --- | --- |
| Scoped tabs, body/return links, keyboard and selected-tab resize | **Failed** on first Agreement client navigation; subsequent assertions were not reached. | **Failed** on first Agreement client navigation; subsequent assertions were not reached. |
| Terms/notice invalid input, pending state, save and signed snapshot | **Passed**, including database persistence and unchanged signed snapshot. | Invalid terms feedback passed; **failed** waiting for success feedback after valid terms submission. Later notice assertions were not reached. |
| Document MIME/size gates, upload error/retry, authenticated download, rename/blank-name error, disabled sharing, delete cancel/error/retry | **Passed**. | **Passed**. |
| Empty documents/ledger, no completed signature, real Signed/Awaiting/Declined states, populated rent summary | **Passed**. | **Passed**. |
| Draft/ended restrictions and fixture termination | Combined status test uses phone width. | Blocked-unit activation feedback passed; **failed** waiting for eligible activation to display Active. Ended restrictions and terminate cancel/confirm were not reached in this final run. |

Three existing affected browser tests also passed: manager detail/upload flow, manager-session requirement, and keyboard/phone layout flow. Successful earlier attempts are not combined into a claimed clean final run. Older captures for notice/save at 390px, scoped navigation, ended state and termination are retained locally but are **not evidence of final-build acceptance**.

### Blocking observation

The original foundation was archived and built separately without source changes, using the same installed dependencies and isolated database. Against its temporary runtime on port 3235, an invalid terms submission showed the original validation error; a subsequent valid submission returned HTTP 200, but the original form remained **Saving…** after 20 seconds. [Comparison log](../../tests/leases/.runtime/baseline-flow.log). That comparison server has been stopped.

This establishes that the stuck-save symptom can occur before this slice. It does not establish the underlying cause or prove that every navigation/activation failure has the same cause. A diagnostic response-buffering experiment changed the outcome, but it was not used for acceptance and is not a fix. Root cause remains undetermined. A scope decision has been requested before changing shared runtime/dependency files outside this Task's paths. Required production-browser acceptance remains unresolved.

## Screenshot and route mapping

All before/after captures use the isolated seeded lease `/leases/seed-lease-maple-11?tab=<section>`, with live fixture data. Baseline captures were taken on the exact foundation before source edits; final captures were taken on the exact final build at 2026-10-19 21:57 UTC. Minor document-list changes reflect fixture uploads during testing.

| Section | Before desktop / phone | Final desktop / phone |
| --- | --- | --- |
| Overview | [1280](../../.playwright-mcp/lease-details/before-overview-1280.png) / [390](../../.playwright-mcp/lease-details/before-overview-390.png) | [1280](../../.playwright-mcp/lease-details/after-overview-1280.png) / [390](../../.playwright-mcp/lease-details/after-overview-390.png) |
| Agreement | [1280](../../.playwright-mcp/lease-details/before-agreement-1280.png) / [390](../../.playwright-mcp/lease-details/before-agreement-390.png) | [1280](../../.playwright-mcp/lease-details/after-agreement-1280.png) / [390](../../.playwright-mcp/lease-details/after-agreement-390.png) |
| Documents | [1280](../../.playwright-mcp/lease-details/before-documents-1280.png) / [390](../../.playwright-mcp/lease-details/before-documents-390.png) | [1280](../../.playwright-mcp/lease-details/after-documents-1280.png) / [390](../../.playwright-mcp/lease-details/after-documents-390.png) |
| Payments | [1280](../../.playwright-mcp/lease-details/before-payments-1280.png) / [390](../../.playwright-mcp/lease-details/before-payments-390.png) | [1280](../../.playwright-mcp/lease-details/after-payments-1280.png) / [390](../../.playwright-mcp/lease-details/after-payments-390.png) |
| Activity | [1280](../../.playwright-mcp/lease-details/before-activity-1280.png) / [390](../../.playwright-mcp/lease-details/before-activity-390.png) | [1280](../../.playwright-mcp/lease-details/after-activity-1280.png) / [390](../../.playwright-mcp/lease-details/after-activity-390.png) |

Final-build state evidence:

- Terms errors: [desktop](../../.playwright-mcp/lease-details/terms-error-1280.png), [phone](../../.playwright-mcp/lease-details/terms-error-390.png); desktop [notice error](../../.playwright-mcp/lease-details/notice-error-1280.png) and [saved agreement](../../.playwright-mcp/lease-details/agreement-saved-1280.png).
- Upload gates: [desktop](../../.playwright-mcp/lease-details/upload-gates-1280.png), [phone](../../.playwright-mcp/lease-details/upload-gates-390.png). Upload failure/retry: [desktop](../../.playwright-mcp/lease-details/upload-failure-1280.png), [phone](../../.playwright-mcp/lease-details/upload-failure-390.png).
- Delete failure/long filename: [desktop](../../.playwright-mcp/lease-details/document-delete-error-1280.png), [phone](../../.playwright-mcp/lease-details/document-delete-error-390.png).
- Empty ledger: [desktop](../../.playwright-mcp/lease-details/ledger-empty-1280.png), [phone](../../.playwright-mcp/lease-details/ledger-empty-390.png). Pending signatures: [desktop](../../.playwright-mcp/lease-details/signature-pending-1280.png), [phone](../../.playwright-mcp/lease-details/signature-pending-390.png). [Ineligible activation](../../.playwright-mcp/lease-details/draft-ineligible-390.png).

## Hidden review runtime and isolated fixtures

The hidden production server is left running at **http://127.0.0.1:3234**, with `/sign-in` returning 200. Its process record is [runtime.json](../../tests/leases/.runtime/runtime.json): PID 61560, started at `2026-10-19T21:56:47.2034222Z`, source/build as above. The helper checks PID plus process start time before stopping its server. It launches with `-WindowStyle Hidden` and does not open a browser.

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

Use the existing Edge review session only through the manager's coordinated observation. These are requested checks, not claimed results.

- Sign in to the hidden review runtime; inspect all five sections at desktop and 390px, including long text/file names, reachable controls and absence of page overflow.
- On the active scoped route, follow tab/body/back/payment links. Use Tab, Shift+Tab and Enter; confirm visible focus and selected Activity tab visibility after resizing to 390px.
- Exercise invalid and valid terms/notice submissions, pending and success feedback, date ordering and unchanged signed snapshot. Record whether the streaming/navigation failure recurs.
- Verify blocked draft feedback, eligible draft activation, ended restrictions, and dedicated fixture termination confirmation, cancel/focus restoration, then confirmation.
- Check upload type/size errors, retry, preview/download through authenticated endpoints, rename feedback, disabled sharing, and delete cancel/confirm/error recovery. Native download remains unobserved even though automated Chromium downloads passed.
- Inspect populated and empty ledger, no completed signature, and Signed/Awaiting/Declined states. Do not initiate a real payment or external e-sign message.

The implementation is reviewable, but the required production-browser failures and the coordinated native observations remain open. Completion or acceptance is not claimed.
