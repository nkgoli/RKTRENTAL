# Redisgn — People and Applications handoff

Design: `Designs/redisgn` (block design). This round owns four screens: `people`, `people-mobile`, `applications` and
`applications-mobile`. All four are finished and were checked with `design_screenshot`. Shared tokens, the `brand`,
`desktop-navigation` and `mobile-navigation` components, and every other screen were left as they were.

| Screen | Device | Final verified revision |
| --- | --- | --- |
| `people` (Tenant directory) | desktop 1280 | 14 |
| `people-mobile` | phone 390 | 18 |
| `applications` (Applications & invitations) | desktop 1280 | 34 |
| `applications-mobile` | phone 390 | 35 |

Other Tasks wrote screens at the same time, so the revision numbers between these are not ours. Revision 35 is the
latest one that holds all four of our screens as verified.

## 1. What the live app shows (Edge, 2026-10-21)

The review used the human's existing Edge tab at `localhost:3100`, signed in as Jordan Mills. Nothing was created,
sent, approved or edited. The Send application form was opened but not submitted. The tab was returned to `/dashboard`.

- **`/tenants` Directory.** Breadcrumb "Workspace / People", title "Tenants". The header action is now **Review
  applications**; the old "+ Add tenant" from the attached before-image is gone. Four stats: Active tenants 41, Move-ins
  (30 days) 0, Leases ending in 60 days 1, Outstanding balance $13,240.00 across 8 tenants. Search, a Property select,
  and All / Current / Late / Past / No lease chips. The table shows Tenant (name and email), Property / unit, Lease end,
  Balance (a "—" for every current row), Status and a "…" menu. 43 tenants are in the view.
- **`/tenants?view=status` (Payment setup).** Current/Upcoming tenants, "Needs payment method · 36", and rows such as
  Sam Wilson "Autopay on · Bank added" and Chloe Fisher, Samuel Hunt and Lily Dixon "No payment method".
- **`/applications`.** Send application and Screening provider buttons. The Invitations empty state reads "Invitations
  and saved drafts appear here…". Pipeline counts 1 / 1 / 2 (New, Screening in progress, Ready for decision). The
  master–detail view lists Rohan Das (Awaiting consent), Marcus Bell (Screening), Nina Park (Ready) and Olivia Reed
  (Ready). Olivia's detail shows TransUnion SmartMove connected, a report from Oct 12, 2026, credit 742, background and
  eviction checks clear, "FCRA consent recorded", the fair-housing note, "Run screening again", and a Decision reason
  select that gates Decline and Approve.
- **`/applications/send`.** A red banner: "Secure application links are unavailable…". Fields for full name, email
  ("One applicant per invitation"), property and unit. A "Create invitation & preview" button with the note "Creating an
  invitation does not send email…". A three-step "From invitation to review" panel.

The before captures are kept locally and not committed, because of the repository tree size cap. They are in the
session's `tool-results` folder: `…-c9m07u.png` (dashboard), `…-pvhqd9.png` (tenants), `…-ki32wx.png` (payment setup),
`…-shxvw5.png` / `…-f85y0k.png` / `…-950ap9.png` (applications) and `…-fedkjb.png` (send application).
`Artifacts/input:357e1aae…` is the human's before-image of the old Tenants header with "+ Add tenant". The redesign
does not bring that button back.

## 2. Visual hierarchy changes

- **One band per screen, as the foundation specifies.** On People the band is the money signal: **$13,240** open across
  8 tenants, 3 of them past grace ($4,950), and "33 of 41 paid in full". It ends with **Review balances → ledger**, so the
  ledger is reviewed before any reminder. On Applications the band is the pipeline: **4 to review**, split 2 ready /
  1 screening / 1 awaiting consent, plus a note that invitations never count toward it. White Stat cards carry the
  secondary counts.
- **The directory reads as one row per tenant.** Each row groups tenant · home and lease end · balance and autopay ·
  status and action, under eyebrow column labels. The balance column now shows `$0.00` and the payment setup rather
  than "—", which also brings the Payment setup view's signal into the directory. Open balances sort first. Row actions
  are a visible **Edit** (or **Ledger** for past-due rows), not a hidden "…".
- **Ink panel for the next step.** People uses its single ink panel to say "New tenants start with an application" and
  links to Applications. Applications uses an ink card only on phone, for the selected applicant.
- **Applications master–detail is kept.** The selected applicant now has a Steps strip (Submitted → Consent → Screened →
  Decision → Promote), the provider line merged into one row, three result Stats, and the FCRA and fair-housing notices
  side by side. Decision has the reason select above the Decline / Approve buttons.

## 3. Representative states (drawn in place with Modal)

- `people`: **Edit tenant · Alex Rivera** (full name and email, a Maple Court · Unit 4B badge, Open lease workspace).
  Existing tenants stay editable. Contact edits never change the lease, rent or promotion history.
- `people-mobile`: the same edit sheet, plus a "Show all 43 tenants" control.
- `applications`: **Send application** (full name, email, property, unit; Create invitation & preview; no email until
  review). Also **Promote to tenant · existing contact**: an email match must be confirmed with **Use existing tenant**,
  saved details are never overwritten, several matches stop without a merge, and promotion creates no lease, charge or
  notification. The text follows `docs/applications/promotion.md`. The saved contact is shown generically, so no
  tenant is invented.
- **Invitation versus application status.** The "Invitation or application?" accordion covers not sent yet, accepted
  by provider (delivery unconfirmed), uncertain or failed (retry rules), link expired (renew for a new 7-day link) and
  application submitted (consent still required). These follow `docs/applications/invitations.md`. The empty
  Invitations card keeps the live configuration warning and the empty-state copy.

## 4. Workflow preservation

- There is no standalone **Add tenant**. Creation starts with Send application (full name and email). Then the
  applicant submits, the manager approves with a written reason, and the manager explicitly promotes. Both People
  screens point to this path.
- The FCRA consent and fair-housing notices keep the app's wording.
- The People band and past-due rows link to `ledger` / `ledger-mobile`. Reminders are never sent from People.
- Real names and figures only: Maple Court, Cedar Row Townhomes, Harbor View Lofts, 18 Elm Street, and the tenants and
  applicants seen in the app.

## 5. Links

- `people` links to `applications` (header, ink panel), `ledger`, `leases` and `lease`.
- `people-mobile` links to `ledger-mobile`, `leases-mobile`, `lease-mobile` and `applications-mobile`.
- `applications` links to `people` (promotion profile link).
- `applications-mobile` links to `people-mobile`.
- The phone screens pin the foundation's app bar in `top` and the `mobile-navigation` component in `bottom`.

## 6. Verification and limits

`design_screenshot` was run after every write.

- `people` rev 11: emails in the tenant column wrapped mid-word, and the edit dialog had empty stretch. Fixed at
  rev 14 by dropping row avatars, using shorter column labels and top-aligning the dialog row.
- `people-mobile` rev 16: the "Past due" badge wrapped. Fixed at rev 18 with shorter captions.
- `applications` rev 24: Approve was clipped to "Appro…" and the status badges wrapped. Rev 29 still squeezed the
  buttons. Fixed at rev 34: the reason select is full width, the buttons are right-aligned on their own row, and the
  provider row is merged.
- `applications-mobile` rev 35: nothing clipped and no horizontal overflow at 390 px. The Stat carousel on
  `people-mobile` is clipped at the edge on purpose.

Limits:

- `mobile-navigation` has no Applications tab, so phone users reach `applications-mobile` from Home and People.
- The shared nav has no active state. This round leaves both to the foundation's proposed shared-component update.
- Signed-in phone captures of the live app were not taken. Edge's viewport was not resized, to keep the human's session
  as it was.
