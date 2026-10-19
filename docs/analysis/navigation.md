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
The manager confirmed both baselines are already included. The ROI navigation/modal
and Rent filter/apply corrections are still in progress with no completed SHAs; they
are not prerequisites for this independently scoped sidebar verification and are not
represented as verified here. The full two-feature request is not claimed
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

The tested implementation is commit `2cab17dffef05bba0031520bc3c0da16ebe489f1`;
subsequent verification-note updates do not change its application source.

Native existing-Edge desktop and 390px checks are pending the coordinated desktop
turn: Rent correction, then ROI correction, then this sidebar checklist. Three early
lease requests timed out; no further request is made before a preceding release is
confirmed. The production app and isolated data are ready. No native pass or screenshot
is claimed before that bounded turn.

Native checklist (navigation only):

- Desktop: enter Rent Analysis from the sidebar; verify explicit selection, title and
  only Rent Analysis highlighted; select Maple, verify its dashboard, then Change
  property back to selection. Verify ROI Analysis and Returns remain distinct entries.
- At 390px: open the menu, keyboard-activate Rent Analysis, verify the menu closes and
  explicit selection appears; choose a property, return to selection, reopen the menu,
  close with Escape and verify focus restoration. Record screenshots of the menu,
  selection and selected dashboard without exercising filter/apply or ROI edits.
- Restore the original Edge context, disable emulation and release the desktop.
