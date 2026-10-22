# Redisgn — final corrections

**Finish coherent navigation and truthful linked design states** is saved in
`Designs/redisgn` / `Artifacts/design:redisgn`, **revision 134**, with 40 screens.
This handoff supersedes the correction requests and limitations in the earlier
`redisgn-*.md` handoffs where the mapping below says they are addressed.

The retained design was already at revision 93 when this attempt began. Its sound
corrections were preserved, the two missing Rent analysis screens were restored,
and the remaining identity, unavailable-state and layout issues were corrected.
The original review reference was revision 57. The design tokens, human-authored
“Redisgn” title, calmer Home surfaces, collection layout and preferred dated lease
ledger remain. No application source, live account or real data was changed.

## Review finding → corrected design

| Finding | Screens/components | Final treatment |
| --- | --- | --- |
| Plain navigation; no current section | `desktop-navigation`, `mobile-navigation`; per-screen Component overrides | Desktop has labelled icons, section groups and a filled current location with a check icon. Phone tabs have icons, labels and a filled active tab. |
| Mobile cannot reach every family | `more-mobile`; shared phone navigation | More lists all ten families, including Applications, Leases, Maintenance, Documents, Returns & ROI and Rent analysis. Form and confirmation screens return through their named back/cancel actions. |
| Chloe-labelled menu opens Sam | `payments`, `payments-mobile`, `ledger`, `ledger-mobile`, `ledger-confirm`, `ledger-confirm-mobile` | Expanded menu is visibly attached to **Sam Wilson, 18 Elm Street**. Open ledger and reminder actions retain Sam, whole home, Jan–Dec 2026 and $1,690.00. Other tenants are not linked to Sam's ledger. |
| Alex documents open Sam's lease | `documents`, `lease-alex`, `people`, `leases` | Named Alex links open **Maple Court, Unit 4B, Alex Rivera**, with the Dec 2025–Nov 2026 term and $1,850 rent. Sam's document shortcut is honestly labelled Portfolio documents. |
| All phone lease cards open Sam | `leases-mobile`, `lease-mobile` | Only Sam's card has a workspace target, plus an explicit “Open Sam Wilson’s lease” link. Alex, Lena and Mina are unlinked summary rows. Phone document rows say Preview unavailable rather than opening Sam. |
| Other property cards open Maple Court | `properties`, `properties-mobile` | Only Maple Court targets its workspace. Other desktop cards state Workspace preview unavailable; their phone cards have no misleading target. |
| Maintenance New/Edit/Assign absent or looping | `maintenance`, `maintenance-mobile`, `maintenance-new`, `maintenance-new-mobile`, `maintenance-edit`, `maintenance-edit-mobile` | Dedicated blank create forms and populated Kitchen sink leak edit forms have Save/Cancel and return paths. Edit preserves Maple Court 4B as text, New/Urgent status and Unassigned vendor; missing description is explicit. |
| Mobile Send has no invitation form | `applications-mobile`, `applications-invite-mobile`; desktop equivalents | Send reaches a named form with applicant/email and property/unit fields, review anatomy, and Cancel/back. The observed unavailable secure-link configuration blocks creation/send/copy; the page does not claim a draft, private link or email was created. |
| Draft, promotion and reminder dialogs unrelated to pages | `leases-delete(-mobile)`, `applications-promote(-mobile)`, `ledger-confirm(-mobile)` | Separate linked overlay/sheet states retain their subject. Keep draft, Cancel and Back to edit return to the correct family. Primary confirmation actions have return destinations; static snapshots do not simulate saved outcomes. |
| Sam balance and late/open totals disagree | `people(-mobile)`, `home(-mobile)`, `properties(-mobile)`, payment/lease/ledger family | Sam is $1,690.00 open, with autopay still scheduled. Home distinguishes **8 open / $13,240** from **3 late past grace / $4,950**. Autopay and pending payments are not treated as settled cash. 60-day and 90-day renewal windows remain distinct. |
| Assumed payment count | `ledger`, `ledger-mobile` | Payments tab has no invented “9” count. Charge count and term-to-date totals retain the inspected ledger figures. |
| Successful PDF shown for unavailable agreement | `lease`, `lease-mobile`, `lease-alex`, `documents(-mobile)` | Sam shows signed-PDF unavailable with Retry and historical signed-status context. Alex supplies the separate signed-file-on-record state. No copied Sam signing date is asserted as Alex's signature date. |
| Impossible activity chronology | `lease`, `lease-mobile` | Record creation Oct 20, 2026 and historical signed status Nov 24, 2025 are labelled separately, with an instruction to verify the original agreement. Import provenance is not invented. |
| Empty photo/PDF rectangles | maintenance and document family | Intentional unavailable-preview states show the filename/context. No matching project asset was returned by asset lookup; the repository public-image search also found none. No substitute photograph or fabricated PDF was added. |
| Negative cash flow drawn upward; offset comp baseline | `returns(-mobile)`, `rent-analysis(-mobile)` | Signed cash-flow value rows describe below/above $0. Years 2–4 retain explicit approximate markers. Rent comparisons list amounts directly, avoiding a $1,500 baseline and rounded bar lengths. Demo-market/estimate and actual/partial/missing distinctions remain. |
| Wrapping labels and implementation commentary | `rent-analysis`, `lease`, `payments-mobile`, `ledger-confirm`; other corrected copy | Renewal-pricing link occupies its own line; Retry and reminder confirmation buttons are readable; mobile Ledger link no longer wraps its arrow. Operational scope/configuration/delivery caveats remain, while renderer instructions and unverified provenance are removed. |

## Route walkthrough and attempted click-through

The saved `goesTo`/`links` graph was expanded through shared Components and their
per-screen overrides. **All 40 screens resolve: 20 from Home and 20 from Home ·
mobile.** There are no missing targets or phone-to-desktop links. Content actions
have no self-loop destinations; the shared current-location nav entries naturally
point to their own section. Twenty-five explicit workflow/return assertions passed.

Configured Playwright opened each final screen at its device width and checked its
visible subject. An actual click on **Send late-rent reminder** in Sam's menu at
revision 93 did **not** change the screen. Final revision 134 exposes zero native
links/buttons/inputs/selects/textareas/tabindex controls on every rendered page.
This is a read-only block-design renderer. Consequently the following is a verified
saved-route and rendered-state walkthrough, **not a passed executable click-through,
keyboard test or persistence test**.

| Flow | Saved route and observed state | Cancel/back or outcome boundary |
| --- | --- | --- |
| Row reminder, both sizes | Sam rent-roll menu → `ledger(-mobile)` → `ledger-confirm(-mobile)`; Sam, 18 Elm Street, $1,690.00, October rent, one email recipient and sandbox/not-delivered copy agree. | Back to edit → same ledger; desktop Cancel → rent roll; mobile Back to edit → ledger, whose Cancel → rent roll. Record sandbox send returns to the ledger snapshot; no send/history mutation occurred. |
| Lease/document identity | `documents` → `lease-alex` → `documents`; all retain Alex/Maple Court/4B. `leases` has separately named Alex and Sam links. `leases-mobile` links only Sam to `lease-mobile`. | Breadcrumbs return to Leases. Mobile Alex document previews are explicitly unavailable. Download controls describe the intended file action but deliver no PDF from this renderer. |
| Maintenance create | New request → `maintenance-new(-mobile)`; blank title/description and unselected location, optional vendor, Normal priority. | Save and Cancel → the matching maintenance board. No request was created and the static board does not change. |
| Maintenance edit/assign | Edit request and Assign vendor → `maintenance-edit(-mobile)`; Kitchen sink leak, Maple Court 4B, New, Urgent, Unassigned and missing description. | Save/Cancel and breadcrumb/app-bar back → the same board. No vendor or status was changed. |
| Applicant invitation | Send application / mobile Send → `applications-invite(-mobile)`; Maple Court 3A, applicant/email fields and review-before-send panel. | Cancel and named back → Applications. Secure links are unavailable; creation, copy and sending are explicitly unavailable. Configured delivery outcomes are described by the existing Applications disclosure, not asserted as performed. |
| Promotion | Olivia's approval action → `applications-promote(-mobile)`; approved Olivia/Maple Court 3A, existing-contact confirmation, saved details preserved, no automatic lease/charge/notification. | Cancel → Applications. Use existing tenant also returns to the application snapshot; no tenant association is persisted by the design. No unobserved saved phone/name is invented for the matching contact. |
| Draft deletion | Sam renewal Delete draft → `leases-delete(-mobile)`; unsigned Jan–Dec 2027 draft, current Jan–Dec 2026 lease explicitly unaffected. | Keep draft → Leases; confirmed Delete has the same return family. The static directory still shows its original draft; deletion was not executed. |
| All sections | Desktop labelled rail and phone More expose every family. Current location uses per-instance styling. | Dedicated phone forms use a named family back action. Focus, Escape handling, focus return and screen-reader interaction require the eventual implementation. |

## Visual verification and retained evidence

Every screen was inspected with `design_screenshot` at 1280 px (desktop) or 390 px
(phone). Unchanged successful images from revisions 123/127 were reused; subsequent
changed screens were rechecked through revision 134. The clipped Retry control,
mobile Ledger arrow and crowded desktop reminder footer were repaired and rechecked.

All **40 final revision-134 screenshots** were also saved through configured
Playwright, with 1280×900 or 390×844 viewports and full-page capture. Every page had
`document.scrollWidth === viewport width` and design-frame `scrollWidth ===
clientWidth`: no page-level horizontal overflow. Intentional stat carousels retain
their own horizontal scrolling. This check does not claim that every control is
interactive or that formal accessibility testing passed.

Screenshots are local, excluded from Git, in this retained checkout:

`C:/Users/nkgol/RocketRental/.orchestra/workspaces/@47g20fiky2300pwyglr/repository`

Each row names an individual file under `.playwright-mcp/`:

| Surface | Desktop evidence | Phone evidence |
| --- | --- | --- |
| Home | `redisgn-r134-home.png` | `redisgn-r134-home-mobile.png` |
| More/all families | — | `redisgn-r134-more-mobile.png` |
| Properties | `redisgn-r134-properties.png` | `redisgn-r134-properties-mobile.png` |
| Maple Court workspace | `redisgn-r134-property.png` | `redisgn-r134-property-mobile.png` |
| People | `redisgn-r134-people.png` | `redisgn-r134-people-mobile.png` |
| Applications | `redisgn-r134-applications.png` | `redisgn-r134-applications-mobile.png` |
| Invitation form/review | `redisgn-r134-applications-invite.png` | `redisgn-r134-applications-invite-mobile.png` |
| Promotion confirmation | `redisgn-r134-applications-promote.png` | `redisgn-r134-applications-promote-mobile.png` |
| Leases | `redisgn-r134-leases.png` | `redisgn-r134-leases-mobile.png` |
| Draft confirmation | `redisgn-r134-leases-delete.png` | `redisgn-r134-leases-delete-mobile.png` |
| Sam unavailable agreement | `redisgn-r134-lease.png` | `redisgn-r134-lease-mobile.png` |
| Alex signed-file state | `redisgn-r134-lease-alex.png` | — |
| Rent roll/row menu | `redisgn-r134-payments.png` | `redisgn-r134-payments-mobile.png` |
| Ledger/reminder composer | `redisgn-r134-ledger.png` | `redisgn-r134-ledger-mobile.png` |
| Reminder confirmation | `redisgn-r134-ledger-confirm.png` | `redisgn-r134-ledger-confirm-mobile.png` |
| Maintenance | `redisgn-r134-maintenance.png` | `redisgn-r134-maintenance-mobile.png` |
| New request | `redisgn-r134-maintenance-new.png` | `redisgn-r134-maintenance-new-mobile.png` |
| Edit/assign request | `redisgn-r134-maintenance-edit.png` | `redisgn-r134-maintenance-edit-mobile.png` |
| Documents | `redisgn-r134-documents.png` | `redisgn-r134-documents-mobile.png` |
| Returns & ROI | `redisgn-r134-returns.png` | `redisgn-r134-returns-mobile.png` |
| Rent analysis | `redisgn-r134-rent-analysis.png` | `redisgn-r134-rent-analysis-mobile.png` |

## Scope, checks and remaining limits

- Read the eight original `redisgn-*.md` handoffs and their referenced invitation/
  promotion contracts. Confirmed all eight original design-document commits are
  ancestors of this checkout's starting HEAD with `git merge-base --is-ancestor`.
  Source commits: `03f09a14cc69b80600ee8f87ba2f3c2766d40fdb`,
  `87be946140ed040bcfb00c066b9e6bdb978f7026`,
  `4ed65093395e165b78d0bbd37fa8565afa95e65a`,
  `d3ec8e55042762146ff53e78a156794cac36e794`,
  `5e5060c24ed40642446001fdbe493fef658d9707`,
  `3a8d91d0d4fdfe422ac441d439f6b0b0a38dabfd`,
  `799bcc3c2680c95f1187beee7264c6bc736dc73b`,
  `6725f3b7ffaae04e1ef779e01f8f4144bca294ac`.
- Passed saved-route assertions, subject/amount checks, no assumed Payments 9,
  no empty Image blocks, signed/value-row comparisons, and calm Home surface checks.
  Passed screenshot presence/count (40 files, 9,463,227 bytes) and scoped whitespace
  checks. App build/test suite was not run: this Task changes design and documentation.
- The design service limits a design to **40 screens**. Additional outcome screens
  were rejected without changing saved state. The final set preserves main desktop/
  mobile families, dedicated forms and confirmations. It does not provide a separate
  post-save/delete/send result snapshot or every tenant/property's detail preview.
- The block renderer cannot execute navigation, form entry, validation, downloads,
  modal dismissal or keyboard flows. These are material verification limits; the
  report makes no claim of end-to-end behavior or formal accessibility conformance.
- Exact monetary figures remain inspected demo snapshots. Home uses Oct 21 local
  time; ledger/analysis as-of labels use Oct 22 UTC. No timestamp was invented to
  imply a fresh live-data fetch. Cash-flow years 2–4 are approximations, not new
  calculated forecasts. The unavailable Sam agreement still needs source validation.
- Only this handoff document is submitted in Git. The design revision is saved in
  Orchestra, screenshots remain local, and no Preview publication or app deployment
  is claimed. Previously retained ignored scratch work was preserved.
