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

## Native Edge observations (partial)

The manager reviewed the existing Edge tab under the human grant and released the desktop at
21:11:32 UTC. The account runtime was served from `http://localhost:3216` (candidate
`539debee6a6c8f41287a574938c2147e82d8c336`, build `1j-Rdcc6JnMEAZt3np19U`) during the
21:07:29–21:17:18 UTC hold.

Observed:

- Desktop 1699x887 default `/sign-in`: passed visually.
- Empty submit: stayed on `/sign-in`, showed the native "Please fill out this field" message
  and moved focus to the email field.
- Show/Hide: the text/password type and the accessible "Show characters" / "Hide characters"
  label changed. Exact value retention could not be observed because browser inspection
  redacts password values.
- Desktop `/sign-in?error=invalid`: readable feedback; both inputs had
  `aria-describedby="sign-in-error"`.
- 390px invalid state: measured `scrollWidth === innerWidth === 390`.

Not run or not claimed:

- The phone capture sequence aborted when the server stopped; no phone screenshot is claimed.
- Manager sign-in/sign-out, the logged-out state, manager/public 404 and `/ui` native checks
  remain unrun.
- No on-disk screenshot paths were generated; the default/error desktop captures are images in
  the manager turn transcript.

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
- The native existing-Edge review is partially observed: the desktop default sign-in, empty
  submit, Show/Hide and invalid-credential states passed, and the 390px invalid state measured
  no horizontal scroll. Manager sign-in/sign-out, the logged-out state, manager/public 404,
  `/ui` and the phone captures remain unrun. Native acceptance stays pending; the review server
  is stopped and the checklist above is the remaining scope.
- No upstream push, deployment or Preview publication was performed.
