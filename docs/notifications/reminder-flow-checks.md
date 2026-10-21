# Payment reminder workspace — retained implementation and checks

Status: **incomplete; backend scope decision required**. This is retained work for “Connect overdue summaries to a polished payment-reminder flow,” not an accepted or published result.

## Implemented within assigned paths

- Overview keeps current-month totals separate from all-date overdue arrears, including former leases and assessed fees. Eligibility uses the delivery service's ledger calculation.
- Property/unit links retain scope. Ambiguous leases and recipients require explicit choices. The workspace includes due dates, remaining charges, assessed fees, editable drafts, email/SMS previews, intentional sandbox/live actions, persistent history, configuration guidance and original-operation recovery.
- History labels mock records as not delivered, acceptance as unconfirmed delivery, and supported pending/delivered/failed/uncertain/cancelled outcomes distinctly.
- No existing lease, maintenance, consolidated edit or ROI controls were removed.

## Blocking service contract

The existing `PaymentReminders.preview(actor, leaseId, channel)` creates fixed content for **all** eligible contacts. Dispatch recreates that default snapshot, validates its fingerprint and creates attempts from every freshly eligible recipient. Therefore client-only edits or a recipient subset cannot be passed through safely.

The owned server action deliberately rejects unsupported content/selection changes with `REVIEW_OPTIONS_UNAVAILABLE`, preserves the client draft and never dispatches that rejected preview. Unedited previews selecting all eligible contacts work. **Required edited/subset preview and send acceptance criteria are not met.**

The recorded scope question requests `src/lib/notifications/reminders.ts`, `src/lib/notifications/reminder-content.ts` and `src/lib/notifications/reminder-api.ts`. Only the minimum service files ultimately needed should change after that authority is granted. The UI's server actions can pass reviewed options directly without changing existing HTTP routes.

## Checks observed on 2026-10-21

| Check | Observed result |
| --- | --- |
| Exact dependency membership | Both `f17324fc25d0f9ba196841925c8ff350a0f11c03` and `b35c4e2cc545f35e2aa0a2d84e70fc93c8f0730f` are ancestors of the retained branch; no merge was needed. Baseline `5013ab47a37ac7a8ff48b3fdf14a1758fdc0528c`. |
| Typecheck | `npm.cmd run typecheck` passed. |
| Scoped lint | ESLint on changed TS/TSX and reminder tests passed with zero warnings. |
| Focused interaction/integration | `RUN_DB_INTEGRATION=1` with `vitest run tests/workspace/payment-reminders tests/notifications`: 42 tests in 7 files passed. Covers selection, edits/preview UI contract, duplicate click, draft recovery/reload, SMS, unavailable/opt-out/invalid contact, paid state, status labels, scoped monthly versus older arrears and the delivery service. UI action mocks do not establish actual edited/subset service support. |
| Full automated suite | `RUN_DB_INTEGRATION=1`, `ESIGN_TEST_DB_DIR` pointing at the dedicated test cluster, `npm.cmd test`: 1,245 passed, 1 failed, 25 skipped (192 files). Existing `tests/providers/database.test.ts:58` expects 123 seeded RENT charges; the current seed creates 410. This test and seed are outside this Task's owned paths. The first run also lacked seed data and the signing directory setting; those setup issues were corrected. |
| Production build | `npm.cmd run build` passed. Existing workspace-root/Prisma configuration notices remain. |
| Database | Dedicated checkout-local PostgreSQL on port 55491. All 23 migrations deployed successfully. Test fixtures are synthetic. A Prisma read/assertion after browser sends found 3 dispatched operations and 4 mock attempts: exactly 1 operation for the double-clicked single-recipient email and 1 operation/2 attempts for the interrupted cotenant send. All statuses `MOCK_RECORDED`, provider `mock`. |
| Managed Preview | `orchestra-agent preview inspect` reported absent, generation 0. No Preview was published. Required managed-Preview checks remain unfulfilled. |
| Full browser regression suite | Not run; required service support and a managed Preview target remain unresolved. Existing full automated failure is reported above. |

## Local browser evidence

Configured Orchestra Playwright, isolated local app on port 3197, synthetic `example.invalid` recipients and test numbers only. These are **local sandbox observations, not Managed Preview evidence**. The retained checkout is `C:/Users/nkgol/RocketRental/.orchestra/workspaces/@1lgis0s596nmhz0n76a/repository`. Images stay in that checkout and are not in Git.

| Flow tried | Observation and local screenshot path |
| --- | --- |
| Scoped older arrears, desktop | Unit with an ended lease shows no current-month charges and a separate $850 overdue balance. Link opens only that unit; one lease/contact preselected. `.playwright-mcp/reminder-overview-desktop.png` |
| Exact email preview, desktop | Shows $800 remaining rent, $50 assessed fee, original due dates and exact message. `.playwright-mcp/reminder-preview-desktop.png` |
| SMS preview, 390px, keyboard | Arrow-key channel selection works. Review and intentional sandbox action fit without horizontal overflow. `.playwright-mcp/reminder-preview-390.png` |
| Email/SMS sandbox history reload, 390px | Both sandbox records survive reload with contact, channel, time and “not delivered.” `.playwright-mcp/reminder-history-390.png` |
| Multiple choices, desktop | Property-wide view starts with no lease; selected cotenant lease starts with neither recipient checked; preview disabled until selection. `.playwright-mcp/reminder-multiple-desktop.png` |
| Edited/subset request, 390px | **Blocked as intended by current service limitation**, draft preserved and explicit no-send explanation. This is not a passing acceptance check. `.playwright-mcp/reminder-edits-blocked-390.png` |
| Interrupted response, desktop | Browser intercepted the dispatch response after the sandbox operation committed. UI retained both drafts and original operation. Checking that original operation recovered one operation with two attempts, without duplicate submission. `.playwright-mcp/reminder-recovery-desktop.png` |
| All paid, 390px | No preview/send action; history remains available; no horizontal overflow. `.playwright-mcp/reminder-all-paid-390.png` |
| Opt-out / invalid contact, 390px | Email opt-out and invalid SMS contact explain next steps; preview disabled. `.playwright-mcp/reminder-contact-390.png` |
| Unconfigured, desktop / 390px | With sandbox off and live reminders disabled, preview is disabled and setup link is actionable. `.playwright-mcp/reminder-unconfigured-desktop.png`, `.playwright-mcp/reminder-unconfigured-390.png` |
| Setup guidance, 390px | Channel availability, administrator steps and consent guidance fit without overflow. `.playwright-mcp/reminder-setup-390.png` |

## Remaining external setup

Real transmission requires the existing organization's SMTP/Twilio connection, private deployment credentials, authorized sender and (for SMS delivery status) the signed public callback. Tenant consent and valid contacts are required. No live delivery was attempted or established. SMTP acceptance alone does not establish delivery. See `payment-reminders.md` for the service's configuration contract.

Continue only after the backend owned-path decision; preserve existing ledger freshness, selected-recipient eligibility, audit snapshot and same-operation/same-state duplicate protections. The external Preview target and the unrelated seed/test mismatch also need resolution before claiming the full acceptance contract has passed.
