# Redisgn leases: lease directory and lease workspace handoff

Design: `Designs/redisgn` (block design). This round owns four screens. Each one was last written at the revision
below and checked with `design_screenshot` at that revision or a later one.

| Screen | Device | Last written | Verified at |
| --- | --- | --- | --- |
| `leases`: Lease directory | desktop 1280 | rev 38 | rev 38 |
| `lease`: Lease workspace | desktop 1280 | rev 27 | rev 27 (unchanged at 38) |
| `leases-mobile`: Lease directory · mobile | phone 390 | rev 30 | rev 30 |
| `lease-mobile`: Lease workspace · mobile | phone 390 | rev 37 | rev 38 |

No shared token, component or other screen was changed.

## 1. Edge observations (2026-10-21, read-only)

The review used the human's Edge tab "RocketRental" at `localhost:3100`, signed in as Jordan Mills. I only clicked
tabs and links. Nothing was renewed, deleted, signed, sent or uploaded, and the tab was returned to `/dashboard`.

- **`/leases`.** Header buttons: Review applications / Lease templates / + New lease. Stats: 41 active, 1 expiring
  in 60 days, 0 awaiting e-signature. Tabs: Active 41 / Expiring soon 1 / Drafts 1 / Ended 2. The table has Tenant,
  Property / unit, Lease term, Rent, E-sign status and Actions columns. **E-sign status is blank on every active
  row**, and every row's only action is "Renew".
- **Drafts tab.** One draft: Sam Wilson · 18 Elm Street · Jan 1, 2027 – Dec 31, 2027 · $1,690/mo · "Not sent". The
  actions are **Continue setup** and a red **Delete**.
- **`/leases/seed-lease-elm-1`.** Shows "LEASE" over "18 Elm Street", **Renew lease**, ← All leases, Active, Sam
  Wilson and Online payments enabled. A bar reads "Signed Nov 24, 2025" with Agreement and Signing page links. Tabs:
  Overview / Agreement / Documents / Payments / Activity.
  - **Overview:** rent $1,690 due on the 1st, Jan 1 – Dec 31, 2026, deposit $1,690, leased premises, tenant, notice
    & move-out (none given / not scheduled), and a rent summary.
  - **Agreement:** "Prepare current signing version". **"Signing agreement not found or unavailable"** appears
    next to Check status / Documents. Also on this tab: lease terms (late fee $75 after a 5-day grace period), Edit
    terms, and "Add an amendment or addendum" → Browse templates.
  - **Documents:** an upload drop zone and "No lease documents yet".
  - **Activity:** E-signature history (Fully signed Nov 24, 2025 · Signature status). Activity entries: Lease
    created Oct 20, 2026; Lease marked fully signed Nov 24, 2025.
  - **Payments:** the preferred ledger (same as `Artifacts/input:2a621558…`). A Balance due $1,690.00 / Last payment
    Sep 3, 2026 band sits above dated rows. Each row has a Rent badge, its month, its due date, a status (Scheduled
    Dec and Nov, **Late** Oct, Paid Sep–Jul), the amount and Details. The header has Record payment and Property
    payments.

I captured these locally with Windows MCP and did not commit them (repository tree size cap). They are in this
session's `tool-results` folder as `mcp-mcp_bundled_windows_mcp-blob-17926409*.png` and `…-17926410*.png`.

## 2. What changed in the visual hierarchy

- **Directory.** One bordered stat band now names each time window: active, ending within 60 days, ending within 90
  days, and awaiting e-signature. The 40 / 1 counts can't be confused. The table is narrower, and its Status column
  is never blank ("Signed", "Signed · ends in 39 days", "Signed · renewal drafted"). This replaces the empty E-sign
  column and the repeated "Renew" link on every row.
- **Drafts vs signed.** Drafts sit in their own tinted panel, eyebrowed "Drafts · not signed" with an "E-sign not
  sent" badge. Signed leases appear only in the table and Renewals. **Delete appears only on the draft panel**. It
  is a quiet `trash` + "Delete draft" button that opens a confirmation ("Delete this draft lease?" · Keep draft /
  Delete draft). The confirmation says the current signed lease is not affected. The panel caption says signed
  leases stay on record and end through notice & move-out.
- **Renewals.** A Renewals ahead card shows Alex Rivera (39 days, warning) with a named "Renew Alex Rivera's lease"
  button. It also shows Sam Wilson ("Renewal drafted"), 38 more leases ending Dec 31, and a note that ended leases
  and their PDFs stay in Documents.
- **Workspace header.** It has breadcrumbs (Leases / 18 Elm Street), an eyebrow with the term, the title, and a
  meta row (Active badge, Sam Wilson link, whole property · $1,690/mo · online payments). Two labelled actions sit on
  the right: Signed PDF and Renew lease.
- **Signing bar.** It reads "Fully signed Nov 24, 2025" and adds **individual signer badges** (Tenant · Sam Wilson ·
  signed; Owner / lessor · signed) and the rule that changes go in an addendum. It keeps **Review agreement &
  signatures** and **Signing page**.
- **Ledger first.** The workspace shows the Payments tab. The preferred ledger is kept: a balance-due / last-payment
  band above dated Rent rows with status badges. The Late row carries "Late · past grace" (danger, money past grace
  only) and a **Review reminder →** link to `ledger`, so no reminder is sent from here. A side column holds Terms
  (rent, deposit, late fee, notice/move-out), Documents (Signed lease agreement PDF Download, Addendums · Add
  addendum, All lease documents → `documents`) and Activity.
- **Mobile.** The mobile screens follow Home · mobile: an app bar, an eyebrow heading, a primary→accent dotted
  gradient band, white cards and the shared bottom tab bar.
  - `leases-mobile` has a "41 active leases" band, search, tabs, tappable lease cards (→ `lease-mobile`) and the
    same draft panel with Continue setup / Delete draft.
  - `lease-mobile` has a "← Leases" app bar, Renew / Signed PDF, a signer card, and the ledger band in the gradient
    above the rows, with a "Review balance before any reminder →" link to `ledger-mobile`. Documents and Activity
    follow.
- **Icons.** Every icon sits beside a text label (plus, file, users, edit, trash, refresh, download, share,
  credit-card, check). No critical action is icon-only.

## 3. Representative states shown

The screens show these states: active and signed, ending soon (warning), renewal drafted (info), a draft that is not
signed with e-sign not sent, the delete-draft confirmation, rent scheduled / late past grace / paid, documents with a
signed PDF and no addendums, and no notice / no move-out.

## 4. Workflow preservation

All of these stay reachable: New lease, Lease templates, Review applications, the Active / Expiring soon / Drafts /
Ended tabs, search, Continue setup and confirmed Delete (drafts only), Renew, Review agreement & signatures, Signing
page, Signed PDF, Add addendum, Record payment, Property payments → `payments`, and lease documents → `documents`.
Reminders stay a reviewed step on `ledger`.

Links: `lease` → `leases`, `ledger`, `payments`, `documents`, `people`. `leases` → `lease`, `applications`,
`documents`. Mobile screens use the `-mobile` ids.

## 5. Notes and requests

- **Revision 6 restyled desktop Home.** It now uses a bordered surface band and medium-weight headings, and has no
  gradient or ink panel. Home · mobile kept the gradient. The desktop lease screens follow the current desktop Home,
  and the phone screens follow Home · mobile.
- **Live data gaps.** The design shows the intended signed state, with a signed PDF in Documents. The live seed lease
  instead reports "Signing agreement not found or unavailable" and has 0 lease documents. The app needs an
  unavailable-PDF state; a follow-up should design and build it.
- **Shared component request (not applied).** `mobile-navigation` has no Leases tab, and its links have no active
  state. The foundation's proposal (icon buttons with an active variant) would let `leases-mobile` / `lease-mobile`
  mark their section.
- The table shows the first 7 of 41 active leases. Pagination stands in for the rest, and the Open link stands in for
  row clicks, because the Table block has no per-row link.
