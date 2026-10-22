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
