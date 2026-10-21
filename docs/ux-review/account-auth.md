# Account and auth: sign in, sign out, recovery, not found

Screens reviewed: `/sign-in` (default, empty submit, invalid credentials, `?loggedOut=1` notice, `?next=` redirect), `/sign-out`, `/` as signed-out / tenant / manager, an unknown URL (`/this-page-does-not-exist`), and the account menus in both shells. Captures: `screenshots/auth-*-1280.jpg`, `screenshots/auth-sign-in-390.jpg`, `screenshots/not-found-*.jpg`.

The auth screens are clean and match `Designs/rocketrental-account-recovery`: one card, tilted monogram, 44px controls, 16px inputs on phone, correct error and signed-out copy. Findings are about flow, not look.

| ID    | Route                    | Severity | Finding                                                                                   | Status |
| ----- | ------------------------ | :------: | ----------------------------------------------------------------------------------------- | :----: |
| AA-01 | /sign-in?error=invalid   |    P1    | Invalid credentials clear the email field; the user retypes both values                   | Fixed — Email persists; password clears and receives focus. |
| AA-02 | /sign-in                 |    P1    | No "Forgot password" or any recovery path; help text says "contact your property manager" | Fixed — Email request, sandbox reset mail and one-use expiring password reset are implemented. |
| AA-03 | /sign-in                 |    P2    | Empty submit relies on native browser validation bubbles                                  | Fixed — Inline errors link to fields and focus the first invalid input. |
| AA-04 | /sign-in                 |    P2    | "SECURE ACCOUNT ACCESS" eyebrow and gradient header are filler                            | Fixed — One clear heading and plain surface replace filler chrome. |
| AA-05 | /sign-out                |    P2    | Sign out is a two-step page with two full-width buttons                                   | Fixed — Shell buttons submit sign-out directly; GET fallback is simplified. |
| AA-06 | unknown URL              |    P2    | 404 page is role-blind ("Return to your account") and uses a folder icon                  | Fixed — Neutral mark, role-aware destination and Go back link. |
| AA-07 | manager routes as tenant |    P2    | Tenant opening `/dashboard` is silently redirected to `/home`                             | Fixed — Both shells explain denied-role redirects with a dismissible notice. |

---

### AA-01

- **Route:** `/sign-in` → submit wrong password → `/sign-in?error=invalid`. Screenshot: [auth-sign-in-error-1280.jpg](screenshots/auth-sign-in-error-1280.jpg).
- **Severity:** P1
- **What is wrong:** The error banner is correct ("Email or password was not recognized…") but the form re-renders empty: the email the user just typed is gone and focus is on nothing. Every typo costs two fields.
- **Premium looks like:** Email preserved, password cleared, focus in the password field, error announced and linked to the field.
- **Fix:** Carry the submitted email back on the redirect (`?error=invalid&email=…`, or render the error in the same request with the server action) and set `defaultValue`; `autoFocus` the password input when `error` is present; add `aria-describedby="signin-error"` on both inputs and `aria-invalid="true"` on the password.
- **Files:** `src/app/(auth)/sign-in/page.tsx`, `src/app/(auth)/sign-in/SignInForm.tsx`, `src/lib/auth` sign-in action.
- **Status:** Fixed — Sign-in uses server action state to preserve email without adding it to URLs; rejected credentials clear and focus the password and announce the linked error.

### AA-02

- **Route:** `/sign-in`. Screenshot: [auth-sign-in-1280.jpg](screenshots/auth-sign-in-1280.jpg).
- **Severity:** P1
- **What is wrong:** There is no "Forgot password?" link, no magic-link option, and no account-recovery route in `src/app/(auth)/`. The only help is a sentence: "Need access or help signing in? Contact your property manager or account administrator." A tenant who forgets a password has to phone someone.
- **Premium looks like:** "Forgot password?" under the password field → email entry → "Check your inbox" → reset form, all in the same card style; the sandbox mailer logs the link.
- **Fix:** Add `/recover` (email) and `/recover/[token]` (new password) pages using the existing auth card; a "Forgot password?" link right-aligned on the Password label row; keep the help sentence but shorten it to "Need an account? Ask your property manager." This adds a route outside this Task's write scope; it is recorded here as the required UX.
- **Files:** `src/app/(auth)/sign-in/page.tsx`, new `src/app/(auth)/recover/`, `src/lib/auth`, `src/lib/notifications` (reset mail).
- **Status:** Fixed — Forgot password? opens /recover with email validation and a conditional Check your inbox confirmation; the existing sandbox mail outbox records a 15-minute reset link. /recover/[token] validates the link, confirms a new password and returns to sign-in with success feedback. Tokens bind the current password hash and auth version; an atomic compare-and-set allows one reset and revokes outstanding links and sessions. Account lookup runs after the uniform public response, reset links are excluded from the organization-wide outbox API, and production delivery remains limited to the existing explicitly enabled sandbox mail provider.

### AA-03

- **Route:** `/sign-in` empty submit. Screenshot: [auth-sign-in-empty-1280.jpg](screenshots/auth-sign-in-empty-1280.jpg).
- **Severity:** P2
- **What is wrong:** Pressing "Sign in" with empty fields does nothing visible in the capture because the browser's own "Please fill out this field" bubble appears and then disappears; it does not match the red inline alert used for bad credentials.
- **Premium looks like:** The design's validation: a red summary linking to the field plus inline text under it.
- **Fix:** `noValidate` on the form; on submit validate client-side and render "Enter your email address" / "Enter your password" under the fields with `aria-invalid`; keep server validation as the fallback.
- **Files:** `src/app/(auth)/sign-in/SignInForm.tsx`, `src/app/(auth)/auth.module.css`.
- **Status:** Fixed — Shared client/server validation provides a linked summary, inline field errors and first-invalid-field focus instead of native browser bubbles.

### AA-04

- **Route:** `/sign-in`, `/sign-out`. Screenshots: [auth-sign-in-1280.jpg](screenshots/auth-sign-in-1280.jpg), [auth-sign-out-1280.jpg](screenshots/auth-sign-out-1280.jpg).
- **Severity:** P2
- **What is wrong:** Both cards open with a pale gradient header and the eyebrow "SECURE ACCOUNT ACCESS" (letter-spaced caps). It says nothing a user needs and reads like a template.
- **Premium looks like:** Logo, "Welcome back", one sentence. Stripe/Linear sign-in pages have no eyebrow.
- **Fix:** Remove the eyebrow (or replace with the product name only on `/sign-out`: "RocketRental"); keep the gradient at reduced strength (`--rr-primary-tint` → surface) or flatten to surface. Keep the tilted monogram.
- **Files:** `src/app/(auth)/sign-in/page.tsx`, `src/app/(auth)/sign-out/page.tsx`, `src/app/(auth)/auth.module.css`.
- **Status:** Fixed — Removed the filler eyebrow and flattened auth headers to the light-system surface while keeping the brand mark.

### AA-05

- **Route:** `/sign-out`. Screenshot: [auth-sign-out-1280.jpg](screenshots/auth-sign-out-1280.jpg).
- **Severity:** P2
- **What is wrong:** Choosing "Sign out" in the manager sidebar or the tenant avatar menu navigates to a full page asking "Sign out of RocketRental" / "Stay signed in" with two stacked full-width buttons. The user has already expressed intent.
- **Premium looks like:** One click signs out and lands on `/sign-in?loggedOut=1` with the teal "You have been signed out." notice (which already exists).
- **Fix:** Make the sidebar/menu "Sign out" a POST form button that signs out directly; keep `/sign-out` only as a GET fallback for links. Reduce the fallback page to one primary button and a text link "Stay signed in".
- **Files:** `src/components/shell/AccountMenu.tsx`, `src/components/shell/ManagerShell.tsx`, `src/app/(auth)/sign-out/page.tsx`.
- **Status:** Fixed — Shell account menus and the manager sidebar submit the sign-out action directly; /sign-out remains a link fallback with one primary action and a Stay signed in text link.

### AA-06

- **Route:** any unknown URL. Screenshots: [not-found-1280.jpg](screenshots/not-found-1280.jpg), [not-found-390.jpg](screenshots/not-found-390.jpg).
- **Severity:** P2
- **What is wrong:** "PAGE UNAVAILABLE" eyebrow, a teal folder icon (the Documents icon), "Page not found", and a single button "Return to your account". The copy is right (matches the design) but the icon suggests files and the button ignores who is signed in.
- **Premium looks like:** Role-aware destination ("Back to dashboard" / "Back to home" / "Sign in") and a neutral mark.
- **Fix:** Read the session in `not-found.tsx` and label the button by role; swap the folder icon for the monogram or no icon; add a secondary link "Go back" (`history.back()`).
- **Files:** `src/app/not-found.tsx`, `src/components/RouteStates.tsx` (`EmptyState icon`), `src/components/route-states.module.css`.
- **Status:** Fixed — The public 404 reads the session, labels its return link for the active role and adds Go back with a safe fallback; the unrelated folder icon and eyebrow are removed.

### AA-07

- **Route:** `/dashboard` (or any manager route) while signed in as a tenant. Observed: redirect to `/home` with no message.
- **Severity:** P2
- **What is wrong:** A tenant following a manager link (for example from an email) lands on their home page with no explanation; a manager opening a tenant route gets the same silent treatment.
- **Premium looks like:** A short notice on arrival: "That page is for property managers. You're signed in as a tenant."
- **Fix:** Redirect with `?notice=role` and render a dismissible `Toast`/alert in the destination shell; log the attempted path for support.
- **Files:** `src/lib/auth` role guard (`requireManagerRole` / tenant guard), `src/components/shell/TenantShell.tsx`, `src/components/shell/ManagerShell.tsx`.
- **Status:** Fixed — Middleware and server guards redirect denied roles with notice=role; both shells display a dismissible explanation. Middleware logs the attempted pathname and role context without account identifiers.
