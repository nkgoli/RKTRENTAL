# Redisgn — application implementation and coverage

The approved `Designs/redisgn` look (revision 172, 40 screens; Home and Home · mobile at the
approved r134 aesthetic) is now implemented in the running application. It uses white bordered
summaries, medium Outfit headings and restrained cards. This document supersedes the visual
status in [light-rollout-coverage.md](light-rollout-coverage.md). That file's functional
inventory of routes and states still applies.

## What changed

- **Tokens and type.** `--design-*` now use the design tokens: primary `#3e4fe5`, background
  `#f4f5f8`, text `#17233a`, muted `#58677d`, accent `#007f7a`, danger `#b4233f`, 16px radius and
  8px spacing. Headings use Outfit (vendored, OFL) at weight 500. Space Grotesk was removed. Old
  palette literals in CSS modules and charts were remapped to the new values.
- **`src/styles/redisgn.css`** is loaded last. It defines the shell, page header (uppercase primary
  eyebrow, medium title, muted meta line), pill buttons, borderless-shadow cards, pill badges,
  uppercase table headings, fields, dialogs and the shared **summary band**.
- **Shell (`ManagerShell`, `nav.ts`).** The ink sidebar groups sections as Portfolio (Home,
  Properties), Leasing (People, Applications, Leases), Money (Payments), Operations (Maintenance,
  Documents) and Analysis (Returns & ROI, Rent analysis). The current item is a filled pill with a
  check icon. Integrations shows "Owner payout setup · coming soon" and is never presented as
  connected; Sign out is in the sidebar footer. Below 1024px, an app bar (brand, Notifications,
  account menu) and a five-tab bar (Home, Properties, People, Payments, More) replace the drawer.
  `/more` lists every section, plus Notifications, Integrations and Sign out, and is
  manager-protected in the middleware and policy.
- **`SummaryBand`** (`src/components/ui/SummaryBand.tsx`) shows the lead figure, detail, an
  accessible meter, a footer action and inset stat cards. The stat cards sit beside the figure on
  desktop and scroll sideways on phones. Home, Properties, People, Leases, Payments and
  Maintenance use it.
- **Home** was rebuilt to the design: the greeting and date use the viewer's clock; the meta line
  gives property and unit counts and how many things need attention. The collection band shows
  "$X open across N leases · M late past grace" with Open rent roll. Next come Needs you today
  (late rent with tenant names, application status breakdown, oldest urgent repair with Assign a
  vendor), Collection history, Occupancy by property, Renewals ahead (warning under 60 days) and
  Recent activity using the Applications status words. Open and late figures come from the same
  `loadPaymentsOverview` as Payments; Home skips payout plans through a new `payouts: false`
  option. This keeps "open" ($13,240 / 8) and "late past grace" ($4,950 / 3) separate.
- **Page headers** now follow the design words: People → "Tenant directory", Applications →
  "Applications & invitations" (Send application is primary), Documents → "Documents" with
  the "Documents and photos" meta line, Send application uses the shared header (one `h1`), and
  plus icons replace typed "+" labels.
- **Flattened surfaces.** Tinted gradient summaries on lease detail, lease templates, tenant
  profile, ledger facts, lease builder, signing, workspace cover, the tenant rent hero, and pay
  hero are now white or quiet inset backgrounds without lifted shadows. The auth card uses the
  wordmark and no shadow.
- **Tenant portal** keeps its own shell and gains the shared tokens. Its active tab is now a filled
  primary tab with white text; the earlier tint failed contrast after the token change.
- **Analysis workspace** buttons and menus use the pill style.

Behavior is unchanged: data queries (except the read-only Home additions), permissions, actions,
lifecycle and financial calculations are as before. Dedicated Property and Maintenance add/edit
pages, Save/Cancel, ROI persistence, reminders-after-review, draft deletion confirmation, FCRA and
fair-housing notices are retained.

## Design screen → application coverage (40/40)

Desktop is ≥1024px with the sidebar; phone and tablet (<1024px) use the app bar and tab bar. The
same routes serve both.

| Design screen(s)                      | Route / state                                                      | Status                                                               |
| ------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `home`, `home-mobile`                 | `/dashboard`                                                       | Implemented: band, needs panel, chart, occupancy, renewals, activity |
| `more-mobile`                         | `/more` + phone tab bar                                            | Implemented: new route                                               |
| `properties`, `properties-mobile`     | `/properties` (grid/list, filters, search)                         | Implemented: occupancy band                                          |
| `property`, `property-mobile`         | `/properties/[id]` and its tabs, `/properties/[id]/units/[unitId]` | Restyled: tokens, cards, workspace spacing                           |
| `people`, `people-mobile`             | `/tenants` (Directory/Status), `/tenants/[id]`                     | Implemented: Tenant directory, balances band                         |
| `applications`, `applications-mobile` | `/applications` (master–detail, screening, decision)               | Implemented: header and theme; FCRA/fair-housing copy unchanged      |
| `applications-invite`, `-mobile`      | `/applications/send`, `/applications/invitations[/id]`             | Implemented: shared header, theme                                    |
| `applications-promote`, `-mobile`     | `/applications?applicant=…` → Promote to tenant                    | Theme; flow verified                                                 |
| `leases`, `leases-mobile`             | `/leases` (Active/Expiring/Drafts/Ended)                           | Implemented: lease portfolio band                                    |
| `leases-delete`, `-mobile`            | Drafts → Delete → `ConfirmDialog`                                  | Theme; text-wrapping regression fixed                                |
| `lease`, `lease-mobile`, `lease-alex` | `/leases/[id]` (Overview/Agreement/Documents/Payments/Activity)    | Restyled: flattened facts                                            |
| `payments`, `payments-mobile`         | `/payments` rent roll and row menus                                | Implemented: collection band (open vs late)                          |
| `ledger`, `ledger-mobile`             | `/leases/[id]?tab=payments`, property/unit ledgers                 | Restyled: balance band kept above dated rows                         |
| `ledger-confirm`, `-mobile`           | Row menu → `/notifications?leaseId=…` reminder review              | Theme; review opens before any send                                  |
| `maintenance`, `maintenance-mobile`   | `/maintenance` board and filters                                   | Implemented: open-requests band                                      |
| `maintenance-new`, `-new-mobile`      | `/maintenance/new`                                                 | Theme; dedicated page kept                                           |
| `maintenance-edit`, `-edit-mobile`    | `/maintenance/[id]/edit`                                           | Theme; Save/Cancel verified                                          |
| `documents`, `documents-mobile`       | `/documents`                                                       | Header and theme                                                     |
| `returns`, `returns-mobile`           | `/roi-analysis[?property]`, `/returns`, `/properties/[id]/returns` | Theme and pill actions; persistence untouched                        |
| `rent-analysis`, `-mobile`            | `/rent-analysis[?property]`, `/rent-comps`                         | Theme                                                                |

### Surfaces not pictured in the design

| Surface            | Routes                                                                          | Treatment                                       |
| ------------------ | ------------------------------------------------------------------------------- | ----------------------------------------------- |
| Auth and recovery  | `/sign-in`, `/recover`, `/recover/[token]`, `/sign-out`                         | Tokens, wordmark, flat card                     |
| Tenant portal      | `/home`, `/pay`, `/lease`, `/repairs`                                           | Tokens, flat rent/pay heroes, filled active tab |
| Lease creation     | `/leases/new` (10 steps), `/leases/templates[/id]`                              | Tokens, flat panel headers                      |
| Signing            | `/sign`, `/sign/leases/[id]`                                                    | Tokens, bordered white header                   |
| Public application | `/apply/[token]`                                                                | Tokens                                          |
| Settings/ancillary | `/integrations`, `/notifications`, property listing/media/documents tabs, `/ui` | Tokens, shared components                       |
| States             | `loading`, `error`, `not-found`, empty states, dialogs, toasts                  | Tokens; dialogs wrap text in any context        |

## Verification

Run on 22 October 2026 against an isolated local database (`rocketrental_redesign` on the local
Postgres, seeded with `npm run db:seed`). `next dev` ran on port 3210. The human's live database
and app on port 3100 were not touched.

**Automated checks**

- `npx tsc --noEmit`: passed.
- `next build`: passed.
- `npx vitest run` (full suite): 1329 passed, 130 skipped, 6 failed. All six failures are in
  `src/lib/tenants/tenants.test.ts` (`tx.$queryRaw is not a function` in its mock). This change does
  not touch `src/lib/tenants`. The failure was not re-run on the base commit.
- Updated or added tests: shell phone navigation (tab bar, More current state, no drawer), grouped
  nav, the sign-out footer, the analysis entry, and Home presentation (separating open from late,
  application breakdown, urgent repair link, warning tone under 60 days, card panels). The
  dashboard loader test now covers the rent roll, application counts and the urgent request.
- `eslint`: clean for changed sources. The full run reports 21 `no-require-imports` errors in
  unchanged `tests/**/*.cjs` helpers.
- Prettier: clean for all changed files.

**Browser checks** (configured Playwright, signed in as the seeded manager and tenant)

- No horizontal overflow (`scrollWidth ≤ clientWidth`) on Home, Properties, Maple Court
  workspace, Tenant directory, Applications, Leases, a lease, Payments, Maintenance, Documents,
  Rent analysis and More at 1280px and 390px. The same holds for Payments and the property
  workspace at 768px, tenant Home/Pay/Lease/Repairs at 390px, and ROI, Returns, Notifications and
  Integrations at 1280px.
- Navigation: sidebar current state, tab bar current state (More stays marked on Leases), More
  links and the app bar's Notifications link all work.
- Maintenance edit: Status was changed to Assigned and saved; the saved state was confirmed on
  reload, then reverted to New. Cancel returns to the board. The New request form renders.
- Property edit shows the populated name (Maple Court); Cancel returns to the workspace.
- Applications: mock screening, written reason, Approve, then Promote to tenant ("Tenant
  linked"). Create lease opens the wizard for Maple Court 3A with the tenant. Next saves the draft;
  Save and exit lands on Drafts 1.
- Draft deletion: the dialog names the property, unit and applicant. Escape closes it and returns
  focus to Delete. Confirming leaves Drafts 0.
- Payments: Sam Wilson's (autopay) row menu offers Open ledger. Chloe Fisher's late row opens the
  reminder review for her lease, and nothing was sent.
- Tenant portal pages render at 390px and 1280px.

Screenshots are kept locally (excluded from Git by the repository tree cap) in this checkout's
`.playwright-mcp/`. `before-1280-*` and `before-390-*` show the original UI; `after-1280-*`,
`after-390-*`, `after-flow-*`, `wip-768-*` and `wip-1280-sign-in.png` show the result and the
flow states.

## Limitations

- Sample values in the design (names, dates, counts) are fixtures; the app shows live data. For
  example, the seed has 5 open repairs where the design shows 4.
- The desktop Home eyebrow reads "Home" (as on the phone design), not the design project's title
  text "Redisgn".
- Screens whose layout is functionally dense (property workspace tabs, lease wizard, ROI
  workspace, applications master–detail, maintenance editor) keep their existing structure. They
  were restyled through shared tokens and components rather than rebuilt block by block.
- The phone summary stat cards scroll sideways on purpose. The rent-roll table keeps its existing
  internal scroll region.
- Formal WCAG conformance was not audited. Focus rings, Escape and focus return were spot-checked.
- Not pushed and not deployed. No Preview was published.
