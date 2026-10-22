# Property, unit and lease workspace: audit and conventions

Scope: the property/unit workspace header and overview (`src/components/workspace/`) and the lease
detail page (`src/app/(manager)/leases/[id]/`). The draft and ledger slices own their functional
changes. They should follow the conventions below.

## Screen audit (before)

| Screen                          | Issue                                                                                                                                                     | Change made                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Property header                 | Address on its own line, type label beside the badge and a full-width "Edit property" button on a third row. The header took about 230px before the tabs. | Status badge sits beside the title. Address and type share one muted meta row with a compact **Edit** action (`aria-label="Edit property"`, tooltip). Cover reduced to 120px. The unit switcher no longer stretches to full width.                                                                                                                                                                                                                                                                                                                                                                 |
| Property overview: details card | Address and type repeated the header.                                                                                                                     | Removed both rows. The card keeps year built, units and owner. The component still accepts `address`/`typeLabel` (deprecated) so existing callers compile.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Payments strip                  | Text button "Send payment reminder" plus a separate "Reminder history" text link. The caption "All dates · includes…" was hard to read.                   | **Send reminder** (bell, secondary) appears only when there is an overdue balance. History is an icon-only action with a tooltip. Caption: "Total to date; includes older arrears and assessed fees". "View payments" became **Payments →**.                                                                                                                                                                                                                                                                                                                                                       |
| Next steps                      | Decorative "↗" glyph, gradient card and small hit area.                                                                                                   | Each row is a whole 44px link with a trailing chevron. The card uses a plain surface.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Units table                     | Ghost "Open" text button in every row.                                                                                                                    | Icon-only chevron action named "Open unit N". The mobile cards keep the labelled button.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Unit facts / unit lease line    | Text button "Edit unit" and a plain "View lease" link.                                                                                                    | **Edit** action (pencil, `aria-label="Edit unit"`). **View lease →** uses the same action style.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Lease header                    | A decorative ✳ after the title, a "←" text arrow and a summary line that repeated the signature state.                                                    | Removed the ✳. The back link uses the arrow-left icon. The summary row shows status, tenants (people icon) and online payments (card icon).                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Lease signing banner            | A large card with a full-size primary button plus the sentence "Owner / lessor signing link: Open signing page", shown on every tab and in every state.   | One compact `Agreement signing` bar whose tone and copy follow the state: **done** (green tint, check, "Signed Nov 24, 2025"), **pending** (Sent/Partially signed) or **attention** (Not sent/Declined, amber tint). For pending and attention states the action reads **Review signatures** and is primary, except on drafts, where it is quiet because the page already leads with "Continue in lease wizard". Signed leases get a quiet **Agreement** link. That link is hidden on the Agreement tab, which already has the signer panel. **Signing page** (external icon) is always available. |
| Lease overview cards            | "One property · one unit" badge, the sentence "This lease covers…", text arrows "→" and the signature repeated in "Agreement & move-out".                 | Coverage now appears on the address line ("… · Whole property" or "Unit 4B only"). Header links are trailing-arrow actions (**Property**, **Manage agreement**, **View rent ledger**). The card is now "Notice & move-out" because the signing bar owns the signature status. Tenant rows end in a chevron.                                                                                                                                                                                                                                                                                        |
| Lease payments / activity       | Ghost button "View payments →" and a full-width "See each party's current signature status" button.                                                       | **View payments →** action. **Signature status** (signature icon, secondary) keeps the full sentence as its accessible name.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

Preserved: every href, permission gate, server action, confirmation and form, as well as the
`Lease summary` landmark, the back-link text, `View payments`, `Manage agreement`,
`View rent ledger`, `Lease documents (n)`, `View lease`, `Open unit N` and the
`Edit property` and `Edit unit` accessible names.

## Visual conventions for subsequent slices

1. **Actions use `Action` from `@/components/ui`.** It takes an `icon` (any shell `Icon` key or
   one of `edit`, `bell`, `history`, `signature` or `external`), a full `label` and optional short `text`.
   - If the visible text is shorter than the label, the full label becomes the `aria-label` and a
     hover/focus tooltip (`data-tip`).
   - With no text, the action is icon-only and must be named by `label`.
   - Tones: `quiet` (default link-like), `secondary` (bordered) and `primary` (one per area at
     most, for the next required step).
   - `trailing` puts the icon after the text. Use it for "go to" arrows and chevrons. Leading
     icons describe the action itself (edit, remind, sign).
   - `document` renders a plain `<a>`. Use it for lease section links, which must reload the
     whole document.
2. **No typed glyph arrows** ("→", "↗", "←", "✳") in UI copy. Use the icon set.
3. **Identity appears once.** The workspace or page header owns the name, address, type and
   status. Cards must not repeat them. A card may add only the scope (for example "Unit 4B only").
4. **Status chips remain text badges** (success/info/warning/danger). Money that is owed stays
   `--design-danger`. Collected or paid amounts stay neutral or text colour.
5. **Banners are single rows** with a `data-state` of `done`, `pending` or `attention`, a status
   icon, a short headline and an `action-group` on the right. They wrap on mobile. Do not write
   explanatory sentences; the action names carry the meaning.
6. **Touch and focus:** actions are 32px tall on desktop and 44px at ≤640px or with a coarse
   pointer. The global 3px primary `:focus-visible` outline applies. Tooltips open on hover and on
   keyboard focus, extend leftward from the action and never widen the page.
7. **Ledger slice:** use trailing-arrow actions for header links (for example **View payments**)
   and `Action` for row actions. Do not use text "View" buttons. Use the existing badges for
   Paid/Late/Scheduled.
8. **Draft slice:** "Continue in lease wizard" and a "not sent" agreement are both attention
   states. Use the signing-bar pattern rather than a separate card.

9. **Deleting a draft lease** uses `DeleteDraftButton` (`src/components/lease-create/`). It is an
   `Action` with the `danger` tone (trash icon), which opens the shared `ConfirmDialog`. Cancel is
   focused first; the title names the property and unit; the description says what is kept.
   - **Where:** the Drafts rows in the portfolio list ("Delete"), the draft cards in the
     property/unit Leases panel ("Delete") and the lease detail summary row ("Delete draft").
     It is offered only for drafts that are `DRAFT` and `NOT_SENT`.
   - **Server rule:** `deleteLeaseDraft` locks the unit and then the lease, and re-checks status,
     signature, agreements, charges, payments, reminders, autopay and pinned files. A refusal
     stays in the dialog as an error alert.
   - **After deleting:** the browser loads the list it came from (`/leases/draft-deleted`), which
     shows a "Draft lease deleted." toast once.

## Verification

- The before and after screenshots were taken at 1440×900 and 390×844 against a local dev server.
  They cover property overview, multi-unit overview, unit overview, and the lease overview,
  payments, agreement, activity and draft views. They are stored locally in
  `tests/evidence/ux-workspace/{before,after}/` (gitignored).
- Keyboard checks:
  - The Edit property link shows a solid focus outline and its tooltip appears on focus.
  - Reminder history shows its tooltip on focus.
  - Tab order runs from the signing bar to the Signing page link. Pressing Enter on the bar's
    agreement action opens the Agreement tab.
  - Pressing Enter on Edit unit opens the inline form, and Cancel closes it.
- No horizontal overflow on any captured page at either width.
