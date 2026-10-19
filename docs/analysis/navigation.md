# Analysis navigation

Rent Analysis is a visible Money destination at `/rent-analysis`, alongside ROI Analysis
at `/roi-analysis`. Returns remains separate. The existing `/rent-comps` route remains
hidden from navigation and retains its title. Neither analysis entry includes a property
query: selecting a property remains an explicit authorized workspace action.

The existing shared shell supplies the icon, topbar fallback title, active state and
mobile drawer behavior. Rent Analysis uses the existing `rent-comps` icon. The page's
existing header override shows “Choose a property” on selection and “Rent Analysis”
after selection. Design reference: `Designs/rocketrental-analysis`, revision 36,
`analysis-selection`, `rent-analysis`, and `analysis-phone`; the compact shell is retained.

## Candidate identity and scope

Starting checkout HEAD: `dd10e867068d84c53744f32e052dcdf77e4230a2`.
Ancestry checks confirmed these completed candidates are present:

- ROI summary: `ee8ba5aba8588ae9baf36a418653b5a2915bbc06`.
- Rent workspace: `95af5cd5e001b2629ecc371fa603f7eaacddc286`.

This change owns only navigation, scoped tests/helpers and this document. It does not
change ROI unsaved-edit handling, Rent filters/application, calculations or authorization.
The manager confirmed both baselines are already included. The later ROI navigation/modal
correction `6025e4fb3b699017b54d032d31cd2b4d06b2a6e6` and Rent filter/apply correction
`134efdaea75a5ebbce150bae1d272ce860da096e` were supplied at desktop handoff. They are
not integrated into this tested runtime and are not represented as verified here.
The manager explicitly confirmed they are not prerequisites for this independently
scoped sidebar verification. The full two-feature request is not claimed
complete. No push or Managed Preview publication is performed.

## Isolated verification

Locked dependencies were installed in this checkout with `npm.cmd ci --no-audit --no-fund`;
the optional locked embedded PostgreSQL dependency used `npm.cmd ci --prefix prisma
--ignore-scripts --no-audit --no-fund`. The sandbox registry attempt failed with EACCES;
the permitted retry passed. initdb also required the permitted execution surface after
Windows restricted-token error 87. Port 55438 was already occupied and was not used.

Production output: `.next/build-analysis-navigation`. App: `http://127.0.0.1:3159`.
PostgreSQL 16.14: `127.0.0.1:55561/rocketrental`, data under
`.orchestra/navigation-db`, storage under `.orchestra/navigation-storage`.
All 19 migrations applied only to this newly allocated database; the standard seed
created 4 properties, 45 units and 41 leases. `verify-identity.mjs` confirmed database,
server port, absolute data directory and those counts using read-only Prisma queries.
Retained runtimes 3143/55443 and 3146/55436 were untouched.

The task-owned launchers use a dedicated TypeScript config and Next output. Run:

```powershell
node node_modules/vitest/vitest.mjs run --config vitest.config.ts tests/ui/manager-shell.test.tsx tests/analysis-navigation tests/rent-analysis/page.test.tsx
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js src/components/shell/nav.ts tests/ui/manager-shell.test.tsx tests/analysis-navigation --max-warnings=0
node --import ./prisma/os-userinfo.mjs tests/analysis-navigation/verification-build.mjs
```

Observed: **37 tests across 3 files passed**, typecheck passed, scoped lint passed,
and production build passed including `/rent-analysis`, `/roi-analysis`, `/returns`
and `/rent-comps`. The integration test renders the real Rent page in ManagerShell,
activates the real menu entry with Enter, follows explicit property selection to its
unit dashboard, and returns to selection. Its authorized data boundary is mocked;
native runtime checks remain necessary for actual browser navigation.

The tested implementation is commit `2cab17dffef05bba0031520bc3c0da16ebe489f1`.
The actual checkout HEAD during native checks was
`2c343b49de78544bcb0390c1fa0bcb9c34129f49`, a documentation-only follow-up; its
application source and the production output are identical to that implementation.

## Native existing-Edge results

After the manager relayed the preceding ROI owner's release, one bounded desktop
request was granted for 600 seconds. Windows MCP drove a temporary tab in the existing
Edge session against `http://localhost:3159` (the app redirected sign-in from 127.0.0.1
to localhost). Responsive dimensions were explicitly entered as **390 × 844 CSS pixels**.
Screenshots were captured through Windows MCP with `capture-native.ps1`; files below
are under `tests/analysis-navigation/evidence/`.

- Desktop sidebar Rent Analysis opened `/rent-analysis` with no selected property,
  the “Choose a property” title and only Rent Analysis highlighted:
  `desktop-selection.png`.
- Explicitly selecting Maple Court reached `?property=seed-property-maple`, displayed
  the “Rent Analysis” title and its 12-unit dashboard: `desktop-selected.png`.
  Change property returned to selection. ROI Analysis opened its own explicit selector
  with only ROI highlighted (`desktop-roi-entry.png`); Returns opened `/returns` with
  “Returns and metrics” and its own highlight.
- At 390px, the menu showed ROI Analysis, Rent Analysis and Returns as separate entries:
  `phone-menu.png`. Eight Tab presses from the close control reached Rent Analysis;
  the accessibility snapshot confirmed focus. Enter opened `/rent-analysis` with the
  drawer closed and explicit selection: `phone-selection.png`.
- Searching Maple with Enter, then selecting its Open Rent Analysis link reached its
  dashboard at the same authorized property URL: `phone-selected.png`. Change property
  returned to unfiltered selection. Reopening the drawer and pressing Escape closed it
  and the accessibility snapshot confirmed focus on Open menu: `phone-return-focus.png`.
- Direct legacy `/rent-comps` retained its existing redirect to
  `/properties/seed-property-elm/listing?unit=seed-unit-elm-1`; no Rent comps sidebar
  entry appeared: `desktop-legacy-redirect.png`. Its nav-model fallback title/hidden
  state are also covered by the shell tests; the actual legacy route redirects first.

The phone selection/context fit the viewport; the existing unit table remains internally
scrollable. These checks exercise navigation only, not filter/apply or unsaved ROI edits.
No business data was edited. Device emulation was disabled, DevTools closed, temporary
tab closed and the original GitHub tab restored. `release_desktop` returned
`released: true`. The isolated runtime/database are retained for review.
