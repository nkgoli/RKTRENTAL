# Light account and recovery handoff

Implemented the approved account-entry, account-exit and shared recovery presentation from
`Designs/rocketrental-light-account` revision 16 and `Designs/rocketrental-light-system`
revision 7. The five design screens are mapped to the existing routes and route states; the
design's specimen catalogs are not rendered as product UI.

## Candidate and runtime identity

- Assigned branch: `orchestra/work-2gcjdifqik3o7helc0b-03ewalb5kyfkysi206t`.
- Checkout: `C:/Users/nkgol/RocketRental/.orchestra/workspaces/@5muiogkklkhe97m6n4c/repository`.
- Foundation ancestry: `37314def68c96b2cf550b0f18a90ad9c42425d75` was not an ancestor of the
  assigned base `b62f7666dbe4c644f825904201bf29b2b6bb8fdf`; it was reconciled by a
  fast-forward merge before implementation. `docs/design/light-foundation.md` and the approved
  icon/token handoff are now present in this checkout.
- Production build ID: `1j-Rdcc6JnMEAZt3np19U` (`next build`, 22 static pages).
- Review runtime: `next start` on `http://localhost:3216`, production build, existing seeded
  PostgreSQL on `localhost:5433` (`rocketrental`). The review server was left running for the
  bounded native Edge check.
- The final commit containing this handoff is recorded in the typed completion report.

## Design-to-route mapping

| Design screen | Implemented route / state | Source |
| --- | --- | --- |
| `sign-in` (phone) | `/sign-in` default, invalid-credential, signed-out feedback, native validation, pending submission and password-visible states | `src/app/(auth)/sign-in/page.tsx`, `SignInForm.tsx`, `src/app/(auth)/auth.module.css` |
| `sign-out` (phone) | `/sign-out` signed-in identity, sign-out action, stay-signed-in destination; already-signed-out state with go-to-sign-in | `src/app/(auth)/sign-out/page.tsx`, `src/app/(auth)/auth.module.css` |
| `account-desktop` | The same `/sign-in` and `/sign-out` routes at desktop widths; the design's desktop composition is the responsive card, not a separate specimen page | `src/app/(auth)/sign-in/`, `src/app/(auth)/sign-out/page.tsx` |
| `recovery` (phone) | Tenant boundary: `(tenant)/error.tsx`, `(tenant)/loading.tsx`, `(tenant)/not-found.tsx` inside `TenantShell`; shared `RouteError`, `LoadingState` and `EmptyState` | `src/components/RouteError.tsx`, `RouteStates.tsx`, `route-states.module.css` |
| `recovery-desktop` | Manager boundary: `(manager)/error.tsx`, `(manager)/loading.tsx`, `(manager)/not-found.tsx` inside `ManagerShell`; public boundary: `src/app/error.tsx`, `loading.tsx`, `not-found.tsx` with the brand and return to `/` | `src/app/(manager)/`, `src/app/(tenant)/`, `src/app/`, `src/components/` |

The tenant "No active lease yet" empty state is rendered by the tenant content pages through
the shared `EmptyState`; those pages remain owned by their current tasks. The shared component
now carries the approved teal top rule, state mark, heading, copy and action treatment.

## Preserved behavior

- Native `required` and `type="email"` validation, including the browser's own messages.
- Credential failure copy and the `?error=invalid` round trip, with the safe `next` destination
  preserved through the form.
- Show / Hide keeps the current password value and updates `type`, `aria-pressed` and the
  accessible name.
- Pending submission disables the Sign in button, exposes `aria-busy` and keeps the action
  label ("Signing in…").
- Signed-out feedback (`?loggedOut=1`) is announced with `role="status"` above the form.
- Session and role routing: an existing session is redirected to its role home; a tenant
  requesting a manager route returns to `/home`.
- Manager, tenant and public return destinations stay distinct: `/dashboard`, `/home` and `/`.
- `reset()` remains the retry action in every error boundary; no new auth, password-reset,
  account-settings or recovery features were added.
- Page-heading semantics: standalone public recovery pages and the tenant error boundary render
  `h1`; embedded manager and tenant states keep `h2` under the shell's own `h1`. The shared
  components expose an explicit `headingLevel` option and keep the same visual size.
- The existing `AccountMenu`, `ManagerShell` and `TenantShell` are consumed without edits.

## Verification

| Check | Command and result |
| --- | --- |
| Focused unit/component tests | `node node_modules/vitest/vitest.mjs run --config vitest.config.ts tests/auth tests/recovery tests/tenant-portal/states.test.tsx`: 4 files, 13 tests passed. |
| Shared UI regressions | `node node_modules/vitest/vitest.mjs run --config vitest.config.ts tests/auth tests/recovery tests/tenant-portal/states.test.tsx tests/ui`: 8 files, 69 tests passed. |
| Scoped lint | `node node_modules/eslint/bin/eslint.js "src/app/(auth)" src/components/RouteStates.tsx src/components/RouteError.tsx "src/app/(manager)/error.tsx" "src/app/(manager)/loading.tsx" "src/app/(manager)/not-found.tsx" "src/app/(tenant)/error.tsx" "src/app/(tenant)/loading.tsx" "src/app/(tenant)/not-found.tsx" src/app/error.tsx src/app/loading.tsx src/app/not-found.tsx tests/auth tests/recovery tests/tenant-portal/states.test.tsx --max-warnings=0`: exit 0. |
| Typecheck | `node node_modules/typescript/bin/tsc --noEmit`: exit 0. |
| Production build | `node node_modules/next/dist/bin/next build`: exit 0, 22 static pages generated. `npm.cmd run build` could not run `prisma generate` because the shared root Prisma engine DLL was locked by the already-running review server; the generated client was already current and the Next build itself passed. |
| Browser flows | Playwright against `http://localhost:3216`: manager sign-in reached `/dashboard`; sign-out reached `/sign-in?loggedOut=1` with "You have been signed out."; tenant sign-in reached `/home` and `/dashboard` returned to `/home`; Show/Hide changed the password type while keeping the value; an empty submit stayed on `/sign-in` with the native "Please fill out this field." message; `/tenants/does-not-exist` rendered the manager not-found inside the manager shell; an unknown public URL rendered the public not-found. The `/ui` capture shows the shared empty and loading states, not `RouteError`; no browser observation of `RouteError` or its reset action is claimed. |
| Accessibility regression | `PLAYWRIGHT_BASE_URL=http://localhost:3216 node node_modules/@playwright/test/cli.js test tests/a11y/foundation.spec.ts --project=a11y --workers=1`: 3 tests passed, including the shared loading/empty states and the manager 390/768 navigation and chart axe checks. |
| Overflow measurement | At 390px, `/sign-in`, `/sign-out`, the public not-found and the manager not-found all report `document.documentElement.scrollWidth === innerWidth === 390`. The `/ui` page reports 472 because of its wide `.table` specimen; the changed empty and loading boxes are 310.67px wide within the 390px viewport. |
| Heading semantics | Unit assertions cover public error `h1`, tenant error `h1`, manager error `h2`, public not-found `h1`, and manager/tenant not-found `h2`. Browser check: the public not-found renders `h1` "Page not found" with no `h2`; the manager not-found renders the shell `h1` "Tenants" plus the embedded `h2` "Page not found". |

Before/after screenshots are in `.playwright-mcp/` in this checkout:

- `before-sign-in-1280.png`, `before-sign-in-390.png`, `before-sign-in-error-390.png`
- `before-sign-out-1280.png`, `before-sign-out-390.png`
- `before-not-found-1280.png`, `before-not-found-390.png`
- `after-sign-in-1280.png`, `after-sign-in-390.png`, `after-sign-in-error-390.png`
- `after-sign-out-1280.png`, `after-sign-out-390.png`, `after-sign-out-signed-in-1280.png`,
  `after-sign-out-signed-in-390.png`, `after-sign-out-feedback-390.png`
- `after-not-found-1280.png`, `after-not-found-390.png`
- `after-manager-not-found-1280.png`, `after-manager-not-found-390.png`
- `after-shared-states-390.png` (element capture of the `/ui` page-states section, excluding the
  unrelated wide table specimen)

## Native Edge observations

The account native review was completed under fresh human grant
`eeb730ea81ec54ea51aeb06f9d35188eed9b85b3b12166b2107633853ea25ac5` (21:59:59–22:14:59 UTC
maximum). The manager used the existing Edge extension session (`browser1`), opened review tab
`712378459` in the same session (the original tab `712378442` was detached), and did not open a
new window. The runtime served `http://localhost:3216` with build
`1j-Rdcc6JnMEAZt3np19U` and implementation `539debe`; the handoff HEAD `db862db` is
documentation-only.

Desktop 1699x935:

- Default `/sign-in` visual passed.
- Seeded manager login reached `/dashboard`.
- `/sign-out` displayed "Jordan Mills", "Sign out of RocketRental" and "Stay signed in".
- Sign-out reached `/sign-in?loggedOut=1` with the teal `role="status"` feedback.
- Manager `/tenants/does-not-exist` rendered `h1` "Tenants" plus the embedded `h2` "Page not
  found" inside the shell, with "Back to dashboard".
- Public `/native-review-page-does-not-exist` rendered the brand, `h1` "Page not found" and
  "Return to your account".
- `/ui` empty and loading states rendered correctly; no `RouteError` browser claim is made.

Phone 390x844:

- Captured default sign-in, invalid-credential, signed-in sign-out, logged-out feedback,
  manager 404, public 404 and `/ui` states.
- `scrollWidth === innerWidth === 390` for sign-in, the invalid state, sign-out and both 404s.
- Inputs use 16px text; the input and Show/Sign in controls are 44px high.
- The invalid state kept `aria-describedby="sign-in-error"` on both email and password.
- `/ui` overall `scrollWidth` is 472 because of the documented wide-table specimen; the loading
  box is 310.67px and the changed states fit visually.
- Show/Hide toggled the accessible labels and pressed state; a disposable synthetic value
  `NativeReview2468!` remained visibly intact after Hide then Show (screenshot), then was
  cleared.
- Empty submit stayed on `/sign-in` and focused the email field. This turn's DOM mirror
  returned an empty `validationMessage` and the screenshot omitted the browser popup, so the
  earlier native "Please fill out this field" observation is retained without claiming it was
  recaptured.

The native screenshots are images in the manager tool transcript (titles: "Capture desktop
sign-in and test manager authentication", "Capture the desktop sign-out confirmation", "Check
phone sign-out layout and complete sign-out", "Capture signed-out feedback and inspect the
credential error", "Capture phone credential error and default sign-in", "Capture manager
recovery at both widths and open public recovery", "Capture public recovery and inspect shared
UI states", "Capture shared states and begin the dashboard review", "Verify Show/Hide preserves
a disposable test value"). No on-disk screenshot paths exist and none are fabricated here.

The account checks are finished. The account desktop release was confirmed at 22:09:34 UTC:
the viewport was reset and independently measured 1699x935, the temporary review tab
`712378459` was closed, the original user tabs were left intact, and `release_desktop` returned
`released:true`. The account runtime was then stopped with the guarded procedure below; the
shared seeded database on `localhost:5433` and all other services were preserved.

## Review-server lifecycle diagnosis

- The review server is a child of the agent's execution turn. Turn-end cleanup cancels the
  command and its descendants; WMI- and App-launched processes also did not survive turn
  boundaries.
- Overlapping start attempts produced `EADDRINUSE`; the process that was actually serving could
  be killed while a duplicate failed, leaving the port refused.
- The 21:07:29–21:17:18 hold kept one server (PID 53576, HTTP 200) alive for the desktop
  default/error captures. The server stopped at the hold end, which aborted the phone capture.
- Next window: start exactly one server in the same turn as the hold, verify the port, hold
  60–120 seconds beyond the window end, do not start duplicates, and keep the turn active until
  the manager confirms release.

## Review runtime procedure

The review runtime is a task-owned hidden process, not a child of the agent command session.

Start exactly one instance:

```powershell
Start-ScheduledTask -TaskName 'RocketRentalReview3216'
```

The task runs `wscript.exe` with
`C:\Users\nkgol\AppData\Local\Temp\opencode\rocketrental-review-3216-hidden.vbs`, which runs
`rocketrental-review-3216.cmd` hidden. The wrapper sets the database/auth environment and runs
`next start -p 3216` from this checkout.

Stop only the confirmed review process and only the exact task registration:

```powershell
$expectedPid = 31004
$expectedCreated = [datetime]'2026-10-19 14:51:16'
$proc = Get-CimInstance Win32_Process -Filter "ProcessId=$expectedPid" -ErrorAction SilentlyContinue
if (
  -not $proc -or
  $proc.Name -ne 'node.exe' -or
  $proc.CommandLine -notmatch 'next start -p 3216' -or
  [math]::Abs(($proc.CreationDate - $expectedCreated).TotalSeconds) -gt 5
) {
  throw 'Refusing to stop: PID 31004 no longer matches the recorded review process.'
}
Stop-Process -Id $expectedPid -Force

$task = Get-ScheduledTask -TaskName 'RocketRentalReview3216' -ErrorAction SilentlyContinue
$action = $task.Actions | Select-Object -First 1
if (
  -not $task -or
  $action.Execute -ne 'wscript.exe' -or
  $action.Arguments -ne '"C:\Users\nkgol\AppData\Local\Temp\opencode\rocketrental-review-3216-hidden.vbs"'
) {
  throw 'Refusing to remove: the scheduled task action no longer matches this review.'
}
Unregister-ScheduledTask -TaskName 'RocketRentalReview3216' -Confirm:$false
```

Do not force-stop whichever process happens to own port 3216, and do not remove a task whose
action no longer matches this review.

Current identity: the latest handoff HEAD (implementation `539debe`), build
`1j-Rdcc6JnMEAZt3np19U`, node PID 31004 created 2026-10-19 14:51:16 local, parent `cmd.exe` PID
25404. Both `http://localhost:3216/sign-in` and `http://127.0.0.1:3216/sign-in` return HTTP 200.
The same PID was still listening after the turn boundary, so turnover survival is observed for
this task-owned hidden process; the manager also received HTTP 200 independently. The runtime
was stopped after the final release at 22:09:34 UTC; the procedure is retained for a future
review.

## Pending native Edge checklist

The manager performs these checks in the existing Edge session after a fresh bounded human
grant. Do not open a new Edge window, drive the desktop, restart the review server, rerun the
passing checks or change the committed source. The review server is `http://localhost:3216`
(production build `1j-Rdcc6JnMEAZt3np19U`) against the seeded database on `localhost:5433`.

Desktop (the existing window's desktop viewport):

1. `/sign-in` default: gradient card header, brand mark, "Welcome back", email and password
   fields, Show, Sign in and the help text; no design specimen catalog is rendered.
2. `/sign-in?error=invalid`: the red credential alert sits above the form and both fields keep
   their `aria-describedby` association.
3. `/sign-in?loggedOut=1`: the teal "You have been signed out." status sits above the form.
4. Password Show / Hide: the input type toggles, the typed value is preserved and the
   accessible name changes between "Show characters" and "Hide characters".
5. Empty submit: the browser's native required-field message appears and the URL stays
   `/sign-in`.
6. Manager sign-in reaches `/dashboard`; `/sign-out` shows "You are signed in as Jordan Mills.",
   "Sign out of RocketRental" and "Stay signed in"; signing out reaches
   `/sign-in?loggedOut=1`.
7. `/tenants/does-not-exist`: the manager not-found renders inside the manager shell with
   "Page unavailable", the folder mark, "Page not found" and "Back to dashboard".
8. An unknown public URL: the public not-found renders the brand above the card and
   "Return to your account" to `/`.
9. `/ui`: the shared empty state (teal top rule) and loading state (spinner plus skeleton)
   render. The page's wide table specimen is a pre-existing overflow outside the changed
   states; the changed state boxes themselves stay within the viewport.

390px (the existing window's phone emulation):

1. `/sign-in` default: the card fits, inputs use 16px text, controls are at least 44px and the
   page has no horizontal scroll.
2. `/sign-in?error=invalid`: the alert wraps and the form remains usable.
3. `/sign-out` signed in: both actions are full width and the card does not overflow.
4. `/tenants/does-not-exist`: the manager mobile menu and the not-found card fit without
   horizontal scroll.
5. An unknown public URL: the brand and card fit without horizontal scroll.

Record the exact Edge window/session, viewport sizes, pass/fail per item, any screenshots and
the desktop release confirmation. Return those observations for this Task's record.

## Limitations

- The manager and tenant **error** boundaries are not directly routable without a runtime
  failure; they are covered by `tests/recovery/states.test.tsx` only. The public not-found
  flow uses `EmptyState`, and the `/ui` capture shows the shared loading and empty states, not
  `RouteError`; no browser observation of `RouteError` or its reset action is claimed. The
  tenant **not-found** boundary is likewise covered by unit tests because no tenant route
  currently calls `notFound()`.
- The `/ui` showcase's horizontal scrollbar is caused by its wide `.table` specimen (measured
  645px before and 686px after at a 390px viewport), not by the changed `EmptyState` or
  `LoadingState`; both changed state boxes measure 310.67px wide within the 390px viewport.
  The actual changed pages (sign-in, sign-out, public not-found, manager not-found) have no
  horizontal scroll. The refreshed shared-state evidence is an element capture of the
  page-states section.
- The tenant "No active lease yet" state keeps the shared component's default (no state mark)
  because the tenant content pages that compose it are owned by other tasks; adding the
  design's document mark there would require editing those pages.
- The source/state handoff at `output/account-recovery/source-state-handoff.md` from the closed
  design task was not present in this checkout or in the project artifacts. The implementation
  used the approved design revision and the existing source anchors instead.
- The account native existing-Edge review is complete: desktop default sign-in, manager
  sign-in/sign-out, logged-out feedback, manager/public 404 and `/ui` states passed; the 390px
  captures and measurements passed. The desktop was released at 22:09:34 UTC and the account
  runtime was stopped with the guarded procedure; the shared seeded database and other
  services were preserved. The earlier partial window's native required-message observation is
  retained; the fresh window's DOM mirror did not recapture the popup.
- No upstream push, deployment or Preview publication was performed.
