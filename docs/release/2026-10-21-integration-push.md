# Combined release preflight — 2026-10-21

Verify combined changes and push origin/main is blocked at its required lease integration prerequisite. No release merge or push was attempted. This report preserves the independent preflight for continuation; it does not claim combined-tree verification or delivery.

## Repository and destination

- Assigned checkout: `C:/Users/nkgol/RocketRental/.orchestra/workspaces/@63x6z1p56soa9k51k1q/repository`.
- Assigned branch: `orchestra/work-2gcjdifqik3o7helc0b-0h08edahcfw2ddb0gvs`.
- Initial task HEAD and observed bound `refs/heads/main`: `a70b0801af237edc3e90cd2f1d030723eb6abced`. The task and main trees match (`git diff --quiet refs/heads/main HEAD`, exit 0).
- Bound destination: `C:/Users/nkgol/RocketRental`, checked out on `refs/heads/main`.
- Configured origin fetch/push URL in both checkouts: `https://github.com/nkgoli/RKTRENTAL.git`.
- Independent remote read: `git -c safe.directory=C:/Users/nkgol/RocketRental -C C:/Users/nkgol/RocketRental ls-remote origin refs/heads/main` returned `07e82431ddaad1d28f79b0c54c46e346ebfa373a`, exit 0, on 2026-10-21. That commit is an ancestor of the local task/main HEAD (exit 0).
- The initial restricted remote probe could not connect; the approved network-enabled read above succeeded. Per-command `safe.directory` was used for the bound repository's different Windows owner; no global Git configuration was changed.
- Final delivered main SHA and post-push remote SHA: **not available; release has not been pushed**. The observed local main and remote values above are preflight observations only.

## Verified source membership

Each commit below exists locally. `git merge-base --is-ancestor <commit> HEAD` returned the listed exit code against the initial task HEAD; that HEAD equals observed bound main.

| Source | Exact commit | Ancestor exit |
| --- | --- | --- |
| Payment reminder flow and deterministic signing-test ordering | `2bf936a4888edc4d5478734a09eb16ae0a262495` | 0 |
| Durable reminder delivery/configuration | `b35c4e2cc545f35e2aa0a2d84e70fc93c8f0730f` | 0 |
| Maintenance editor redesign | `877197ba57e078a658e484097da8957ae21df5e5` | 0 |
| Maintenance browser-history draft protection | `eb2abf16100bc285be3bc65b0f6bcc2038cffae9` | 0 |
| Compact lease summary | `9742d6355ab9d03f11517781dd219f699ac84fdf` | 0 |
| Truthful terminal lease status | `bf33105bd87e000eabc7fc691603573df3467fc5` | 0 |
| Consolidated property/edit/ROI actions | `791eea50ebcf4aad748c5dcd7e0497b13c97f2c8` | 0 |
| Preserved custom report dates | `f17324fc25d0f9ba196841925c8ff350a0f11c03` | 0 |
| Earlier lease archive submission | `87fe1039e530f2f013d128db8648e1cbef3caaad` | 1 |
| Submitted signing UI successor | `11072a2847ba00ada6c2695460d5bd5b2913f518` | 1 |

Already-contained sources need no repeated merge. The reminder candidate and observed main differ in the maintenance editor, its tests and its report; earlier full-suite evidence is therefore historical, not a new combined-release pass.

## Required prerequisite

Canonical archive Task `task:67463f93-3de5-5965-a49c-207f4196744a`, version 9, remains IN_PROGRESS. Its amended acceptance criteria require repair of the failed settlement against current main while preserving the later signing UI, main's deterministic signing-test correction and reminder schema/dependencies, followed by affected checks and a corrected submission. Its earlier archive submission is not the corrected release source.

Canonical successor `task:4ea526f7-f976-57d6-9b98-a97abdf9c99f`, version 7, remains VERIFYING with submitted commit `11072a2847ba00ada6c2695460d5bd5b2913f518` and an archive dependency. Its owner reports that commit descends from `87fe1039e530f2f013d128db8648e1cbef3caaad`.

Continuation requires the archive owner's verified corrected submission containing both retained lease results and current main, plus settlement of the signing-UI successor (or an explicit manager resolution selecting the verified combined candidate). The owner retains exclusive repair responsibility. No other task checkout was opened or edited, and no duplicate conflict repair was attempted. The release instruction explicitly requires reporting this prerequisite after independent preflight instead of polling or pushing an incomplete release.

Admitted canonical receipts: `corpus-receipt:f6086a17-c6e6-496a-84f4-8e85d1a0b9f7` (archive), `corpus-receipt:bc11f548-7848-4d9d-980d-7241f781fc40` (signing UI), and `corpus-receipt:3397541e-1554-43ff-b8a3-0f00828bdaf8` (closed reminder flow Task `task:1c9de52b-972d-57e2-9bc8-160294c44be6`, version 13).

## Verification status

Observed in this release preflight: branch/HEAD/origin inspection, independent remote-ref read, source-object/ancestry checks, task/main tree comparison, and local-change inventory passed. No merge conflicts were created or resolved.

The final combined tree does not yet exist here. Its full automated suite with relevant isolated database checks, typecheck, production build and affected desktop/390px signing/archive/Documents, reminder, property/ROI and maintenance smoke checks are **not run**. They remain required after the corrected source is available. No tenant messages, production data changes or Preview publication occurred.

Historical evidence was read for planning and must be reused only where the later merge leaves the tested behavior unchanged:

- `docs/notifications/reminder-flow-checks.md` and the canonical reminder submission: 54 focused reminder/provider tests; full automated suite with `RUN_DB_INTEGRATION=1`, dedicated migrated/seeded `reminder_final_task10` and `ESIGN_TEST_DB_DIR` selecting its isolated cluster: 1,256 passed, 25 skipped. Typecheck/build and desktop/390px reminder acceptance flows passed. The optional 121-test broad browser run reported 48 passed, 58 failed, 3 skipped and 12 not run; unrelated fixture/selector/launcher failures remain documented. Relevant owned settings/auth/provider reruns passed. This release does not claim the broad browser suite is green or repeat it without a reason.
- `docs/maintenance/editor-redesign.md`: 67 scoped tests, 11 isolated PostgreSQL editor checks, typecheck/build and desktop/390px flow/layout checks; the history-guard follow-up reran scoped tests, typecheck and lint and checked Back/Forward/draft protection and settled photo preview. Its database/build evidence predates that follow-up.
- `docs/workspace/lease-summary.md`: 28 scoped tests, typecheck/lint/build and desktop/390px terminal-lease history checks. Actual ending dates are unavailable to the summary; neutral terminal wording is intentional.
- `docs/workspace/overview-actions-verification.md`: 39 focused tests, typecheck and isolated database/browser checks for edit actions, scoped ROI, custom dates, keyboard/history and 390px layout.
- Canonical archive submission: 89 targeted tests including 23 real PostgreSQL signing/archive scenarios, migration deployment, typecheck/lint and all 22 synthetic PDF pages inspected. Canonical signing-UI submission: 1,125 full-suite tests passed with 77 gated skips; 23 separate PostgreSQL signing/archive checks; typecheck/build; owner-first new lease and tenant-first renewal with two tenants at desktop/390px, one final PDF and separate addendum per version. These remain owner observations on earlier candidates, not proof of the outstanding merge repair.

Browser images and database data remain at the retained locations cited by their source reports. No images were copied or added to this release commit.

## Preserved work and continuation

The task checkout began with a clean tracked index/worktree and no untracked files. Bound main has unrelated `prisma/package-lock.json` edits (6 insertions, 1 deletion) and untracked `start-rocketrental.ps1`. Neither was changed or staged. Observed SHA-256 values:

- `prisma/package-lock.json`: `E0374A667501AEEEA1BF8A013BD8866362EED83659133BF0F48A7D523AF840E0`.
- `start-rocketrental.ps1`: `EAC3F9D3F765EDE3A7FAA32DE7FB2E755C1835FA1127EA46D7C03FCC34B9251F`.

Root ignored environment, runtime, database, dependency and cache paths were preserved, including `.env`, `.data/`, `.next/`, `.orchestra/`, `node_modules/`, `prisma/.local-postgres/`, `prisma/node_modules/`, runtime logs and `tsconfig.tsbuildinfo`. Retained PDF evidence in the lease owner's checkout was not accessed or modified.

After the prerequisite is resolved, verify the exact corrected commit and current root/main/origin again; integrate with ordinary non-force Git and `merge --no-overwrite-ignore`; run the required combined checks; reconcile concurrent origin/main updates; push bound main and independently read the remote ref. Update this report with actual conflict resolutions, final source containment and delivered SHAs before completion. This documentation-only preflight commit must be preserved when continuing.
