# Delete draft in the lease wizard

A manager resuming a saved draft can delete it from the wizard's top bar, beside **Save and exit**.
It reuses the shared `DeleteDraftButton` and `deleteDraftLeaseAction` (see
[property-lease-workspace.md](property-lease-workspace.md)); the server still decides eligibility.

## Behaviour

- **When it shows.** Only once the draft is persisted (a resumed draft, or a new lease after its
  first save) and until the lease is sent or activated in the wizard. An unsaved new lease has
  nothing to delete.
- **Context.** The dialog names the property and unit from the top bar, the primary tenant when one
  is chosen, the uploaded file count, and for a renewal says the lease it renews stays active.
- **Cancel** (button, Escape or the close icon) closes the dialog and returns focus to the trigger.
  Typed but unsaved wizard edits, the current step and the "Unsaved changes" status are kept.
- **Pending work.** The action is disabled while a save or send is running. Once a delete is
  confirmed, the status reads "Deleting draft…" and Back, Next, step links, Save and exit and Send
  are disabled; the wizard's save and send also refuse to start, so nothing can write to (or
  recreate) the draft while the delete redirects.
- **Success** goes to `/leases?tab=drafts` with "Draft lease deleted." The list, counts and the unit
  picker are rendered fresh, so the unit no longer offers **Resume draft**.
- **Already deleted** (for example in another tab): saving shows "This draft is no longer open."
  without creating a new draft; Delete goes to the Drafts list with "That draft was already
  deleted."
- **Ineligible** (sent, signed, ledger or payment history): the server's reason stays in the dialog
  and the wizard is unchanged after Cancel.

## Layout

Desktop keeps the danger-tone "Delete draft" text action before Save and exit. At 640px and below
the action is icon-only (44px target, full accessible name and tooltip) and the top bar wraps to two
rows: back and place, then save status and the two actions. The bar no longer shrinks to its
minimum height inside the builder's flex column, which had let the wrapped second row overlap the
step list.

## Verification (synthetic data, isolated database)

- Ordinary draft at 1440px: keyboard open, Cancel focused first, Escape and Cancel keep an unsaved
  rent edit; confirm returns to Drafts with the toast; the unit picker shows no draft for the unit.
- Renewal draft at 390px: Tab order Back → Delete → Save and exit; dialog names the tenant and the
  kept renewal source; keyboard confirm returns to Drafts; the source lease is still Active.
- Stale: a draft deleted in a second tab refuses Next without recreating it, then Delete reports it
  was already deleted. Ineligible: a draft marked sent keeps the refusal in the dialog.
- Opening a deleted draft's old `?draft=` link directly still shows the existing not-found page.

## Tenants step: new people go through Applications

The wizard no longer links to standalone tenant creation (`/tenants?add=1`). Tenants are created
only by promoting an approved applicant, so the Tenants step points there instead:

- **Applicant who isn't a tenant yet** shows "Not a tenant yet" with **Review application**, linking
  to `/applications?propertyId=…&unitId=…&applicant=…#selected-applicant`. It has no checkbox, so
  it can't be added to the lease until promotion makes them a tenant.
- **Review applicants for this unit** (under the search) and the empty state ("No tenants yet.
  Tenants are added by approving and promoting an applicant for this unit.") replace the old
  "Add a new tenant" links. The unit picker copy reads "choose existing tenants".
- **Draft progress.** A plain click or Enter saves the current step (non-strict) and then opens
  Applications in the same tab. If the save fails, the wizard stays put and shows the error.
  Ctrl/Cmd/Shift-click and middle-click are left to the browser, so a new tab keeps the wizard open.
  Browser Back, or **Resume draft** from the unit picker or Drafts, returns to the Tenants step
  with the saved selection.
- Existing tenants and promoted applicants are still selectable. Delete draft, Cancel, save and send
  locking, renewal carry-over and signing are unchanged.

### Verification (seeded data, isolated database on port 55519)

- Maple Court · Unit 3A at 1440px: empty selection and populated selection (Sam Wilson as primary).
  Olivia Reed (in review, not a tenant) shows **Review application** without a checkbox. The only
  `/tenants` link is the sidebar.
- Keyboard: removed Sam, picked Lena Castillo (status "Unsaved changes"), focused **Review
  application** and pressed Enter. Applications opened scoped to Maple Court · Unit 3A with Olivia
  selected. Back returned to the Tenants step with Lena as primary and "Draft saved".
- 390px: no horizontal overflow; Delete draft is still in the top bar. Enter on **Review applicants
  for this unit** opened scoped Applications, and Back restored the unsaved selection (Sam Wilson).
- The "No tenants yet" empty state, the scoped hrefs, save-before-leave, save failure and
  modified-click behaviour are covered in `tests/lease-builder/tenants-applications.test.tsx`. The
  wizard and deletion suites (`tests/lease-builder`, `tests/lease-create`) pass.
- Screenshots are kept locally in `.playwright-mcp/` (not committed, because of the repository size
  cap).
