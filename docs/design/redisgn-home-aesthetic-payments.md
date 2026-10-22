# Payments and reminders aligned with Home

Designs/redisgn now carries Home's calmer hierarchy through the six payment and reminder screens. The reference is `home` and `home-mobile` at revision 134. All six assigned screens were refined; no screens were added or deleted.

## Screen and revision evidence

Before: all six screens at r134, inspected with `design_read` and `design_screenshot`. After: individual screen-local saves below, rendered together at r149. A later read at r164 confirmed these six screens exactly match their r149 versions despite concurrent edits elsewhere.

Screenshots remain in the retained checkout, outside Git: `C:\Users\nkgol\RocketRental\.orchestra\workspaces\@3yuua96hcj68vlm2me8\repository`.

| Screen | Before | Saved | Final rendered screenshot |
| --- | --- | --- | --- |
| `payments` | r134 | r144 | [r149, desktop 1280px](../../.playwright-mcp/payments-aesthetic-payments-r149-1280.png) |
| `payments-mobile` | r134 | r145 | [r149, phone 390px](../../.playwright-mcp/payments-aesthetic-payments-mobile-r149-390.png) |
| `ledger` | r134 | r146 | [r149, desktop 1280px](../../.playwright-mcp/payments-aesthetic-ledger-r149-1280.png) |
| `ledger-mobile` | r134 | r147 | [r149, phone 390px](../../.playwright-mcp/payments-aesthetic-ledger-mobile-r149-390.png) |
| `ledger-confirm` | r134 | r148 | [r149, desktop 1280px](../../.playwright-mcp/payments-aesthetic-ledger-confirm-r149-1280.png) |
| `ledger-confirm-mobile` | r134 | r149 | [r149, phone 390px](../../.playwright-mcp/payments-aesthetic-ledger-confirm-mobile-r149-390.png) |

Home comparison screenshots: [desktop r134](../../.playwright-mcp/payments-aesthetic-home-r134-1280.png), [phone r134](../../.playwright-mcp/payments-aesthetic-home-mobile-r134-390.png).

## Refinements

- Collection and balance banners are white bordered panels. Gradients, dots and lifted shadows are removed. Indigo eyebrows/progress, dark financial totals, muted explanations and red overdue labels restore contrast on white.
- Page and section headings use medium weight. The main amounts retain Home's prominent scale: large/bold on desktop and h2/bold on phone. Row names and amounts use medium weight without reducing their size.
- Summary stats use Home's quiet grey fill on desktop. Cards use the standard corners and borders; the opaque action menus retain a subtle shadow and every row action.
- Reminder review cards use white surfaces, red eyebrows and muted context. Confirmation screens retain their restrained dialog/sheet shells and workflow; message previews gain a standard rounded border and medium subject text.
- Existing filters, badges, alerts, history, inputs, recipient/channel choices, progress steps and navigation remain in place.

## Verification

- Passed visual comparison through `design_screenshot` at each screen's native width: 1280px desktop and 390px phone. The configured Playwright browser also opened the static design targets, captured the linked full-page screenshots and checked viewport/control geometry.
- No page-level horizontal overflow or clipped controls observed. Phone stat carousels retain intentional horizontal scrolling. Existing visible overflow within shared tab labels and desktop stepper flex cells stays inside their surrounding controls/dialog; the labels remain readable.
- Changed foreground samples resolved to the intended tokens. Contrast on white is 15.70:1 for body/dark financial text, 6.08:1 for indigo, 5.75:1 for muted text and 6.46:1 for danger text. Progress bars, icons, menu entries and confirmation actions are readable in the rendered screens.
- The r134-to-r164 comparison found only presentation-property differences in the assigned block trees. All words, data, states, block/screen IDs and 19 explicit link-target occurrences are preserved, including component-instance overrides. Home variants, global tokens/components and screen order are identical to r134.
- Financial distinctions remain intact: collected versus due, open versus late, scheduled autopay versus posted payment, credit versus balance due, scheduled charges, sandbox delivery labels and truthful empty reminder history.

## Limitations

These are static design inspections, not executable application tests. No reminder was submitted, payment recorded, live record accessed, application code changed or Preview deployed. The completed navigation review was not repeated because no target changed. Screenshots are local evidence and are not committed or copied into another checkout.
