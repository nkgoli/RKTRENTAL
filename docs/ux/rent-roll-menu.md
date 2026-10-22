# Rent-roll row menu (RowMenu)

The overflow (⋯) menu on rent-roll rows, and on the Tenants, Leases and workspace lease lists,
is `src/components/ui/RowMenu.tsx`. The styles are the `.row-menu` rules in
`src/styles/globals.css`.

## What was wrong

When the menu was open, the next row's **Record payment** button and ⋯ trigger were drawn on top
of it. Clicks there went to that row, not the open menu. Menus on the last visible rows were also
cut off.

- **Stacking.** Rows are `tr.row-link`. The row's anchor uses `::after` to cover the whole row,
  so each control in the row is raised with `position: relative; z-index: 1`. The old menu was a
  `<details>`, and that rule raised it too. That made each menu its own stacking context, so the
  panel's `z-index: 30` only applied inside it. Later rows' controls, also at `z-index: 1`, were
  painted over the panel and got its clicks. In the browser, `elementFromPoint` inside Chloe
  Fisher's panel returned Lily Dixon's **Record payment** link.
- **Clipping.** The panel used `position: absolute`. The rent roll's `.tableScroll` (overflow
  auto, max-height 740px) and `.card` (overflow hidden) clipped it on the last visible rows.

## Fix

- **Placement.** The panel is now `position: fixed`. RowMenu places it in viewport coordinates
  from the trigger's rectangle, so neither the row's stacking context nor the scroll container
  can cover or clip it.
  - It opens below the trigger, or above when there is more room there. Its end edge (or start
    edge with `align="start"`) lines up with the trigger.
  - It stays at least 8px inside the viewport and scrolls internally if it is too tall.
  - If a transformed ancestor becomes the containing block, the measured drift is corrected.
  - The fade-in uses opacity only, so no transform skews that measurement.
- **Scrolling and resizing.** While open, the panel follows its trigger when the page or any
  scroll container scrolls or the window resizes. It closes once the trigger is no longer visible
  inside its scroll container or the viewport.
- **One menu at a time.** Opening a menu closes any other open menu.
- **Dismissal.** The menu closes on:
  - an outside pointer press
  - Escape, which returns focus to the trigger
  - Tab past the last action
  - following a link or a direct submit button
- **Interaction model: disclosure.** The trigger is a button with `aria-expanded` and
  `aria-controls`. The panel's links and buttons keep their native roles, because the panel mixes
  links, buttons, forms and status text, and existing consumers and tests find actions by
  `link`/`button` role.
  - Enter or Space toggles the menu and keeps focus on the trigger. Tab moves into the actions.
  - ArrowDown or ArrowUp on the trigger opens the menu and focuses the first or last action.
  - Inside the menu, ArrowUp/ArrowDown, Home and End move between actions.
- **ConfirmButton dialogs.** A ConfirmButton's dialog is inside the panel, so the menu stays open
  behind it.
  - Cancel and Escape close only the dialog, and focus returns to the action.
  - After a confirmed submit, the menu closes once the dialog is gone and focus returns to the
    trigger.
  - Menu item styling is scoped to direct children (`> .btn`), and the panel's `nowrap` is reset
    inside `dialog`. Before, the dialog's buttons lost their borders and its description was
    cut off.

## Verification

- `tests/ui/row-menu.test.tsx` covers ARIA state, one-open, outside click, keys, focus restore,
  cancel versus confirm, and links.
- `tests/payments/rent-roll-menu.test.tsx` uses a mocked synthetic rent roll. It checks that
  Record payment hrefs and the posted late-fee `leaseId` belong to the selected row.
- `tests/payments/rent-roll-menu.spec.ts` is the Playwright spec. Run it only against a
  throwaway seeded database, because it adds one late fee and records a $1.00 payment. It covers:
  - hit tests over neighbouring rows
  - anchoring at 1440px and 390px
  - the first and last rows, and flipping at the viewport edge
  - table scroll and resize, and closing when the row leaves view
  - switching menus and outside click
  - keyboard
  - dialog open, cancel, Escape and confirm, and targeting
