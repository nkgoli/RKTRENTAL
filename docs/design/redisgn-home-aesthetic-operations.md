# Maintenance and Documents: approved Home aesthetic

All eight assigned screens in **Designs/redisgn** now follow approved `home` and `home-mobile` at **revision 134**. The final evidence is pinned to **revision 155**. Only screen-local styles changed; no application code or real records were involved.

## Refinements

- Maintenance and Documents summaries use white bordered panels, indigo eyebrows, dark counts and muted supporting text. Gradients, dots, lifted shadows and oversized corners are removed. Desktop inset stat cards use Home's light grey fill. Counts remain prominent: desktop `4 open` / `12 files` use Home's large summary size; phone summaries use its h2 size.
- Page greetings/titles and section/request headings use medium weight. Board cards, document cards, form cards and attachment panels use the default 16px corners and subtle borders. Existing spacing, medium headings and controls that already matched Home were retained.
- The dark Maintenance urgency panels are white, with red warning icons and urgency labels. The vendor-assignment progress is indigo instead of white. Urgency/status badges and warning alerts retain their meanings. Upload and mobile assignment actions use solid primary buttons on the new white surfaces.
- All words, counts, dates, files, vendors, status/priority options, workflow states and link targets remain. Restricted-ID locks, missing descriptions, absent addendums and unavailable file/photo previews remain explicit.

## Revision and screenshot references

Every row starts from **r134**, with the same screen ID before and after. The first saved revisions below identify this Task's writes; **r155 contains all eight final screens**. Later concurrent edits to other screen families are outside this comparison.

Screenshots remain local in the retained checkout:
`C:\Users\nkgol\RocketRental\.orchestra\workspaces\@3yuua96hcj68vlm2me8\repository`

| Screen ID | First save | Final rendered evidence at r155 |
| --- | --- | --- |
| `maintenance` | r135 | [1280px](../../.playwright-mcp/redisgn-operations-r155-maintenance-1280.png) |
| `maintenance-mobile` | r139 | [390px](../../.playwright-mcp/redisgn-operations-r155-maintenance-mobile-390.png) |
| `maintenance-new` | r141 | [1280px](../../.playwright-mcp/redisgn-operations-r155-maintenance-new-1280.png) |
| `maintenance-edit` | r143 | [1280px](../../.playwright-mcp/redisgn-operations-r155-maintenance-edit-1280.png) |
| `maintenance-new-mobile` | r152 | [390px](../../.playwright-mcp/redisgn-operations-r155-maintenance-new-mobile-390.png) |
| `maintenance-edit-mobile` | r153 | [390px](../../.playwright-mcp/redisgn-operations-r155-maintenance-edit-mobile-390.png) |
| `documents` | r154 | [1280px](../../.playwright-mcp/redisgn-operations-r155-documents-1280.png) |
| `documents-mobile` | r155 | [390px](../../.playwright-mcp/redisgn-operations-r155-documents-mobile-390.png) |

Approved reference captures: [Home r134, 1280px](../../.playwright-mcp/redisgn-operations-r134-home-1280.png) and [Home mobile r134, 390px](../../.playwright-mcp/redisgn-operations-r134-home-mobile-390.png).

## Verification

- **Passed:** visually inspected all eight changed screens with `design_screenshot` at their device widths, comparing typography, summaries and cards with both approved Home variants. Forms, attachment rows, file rows, filters and bottom actions are readable and visible.
- **Passed:** configured Playwright static-design captures at exact 1280px desktop / 390px phone canvas widths. For every changed screen, document and screen scroll widths equal the viewport width; no controls extend outside the screen. Viewport height was fitted to content to prevent the native vertical scrollbar from reducing canvas width.
- **Passed:** r134 versus r164 structural comparison. Both Home screens, all global tokens and shared components are identical. For all eight assigned screens, block types/IDs, nesting and every nonstyle property are identical; only typography, color, panel/card treatment and summary spacing changed. The screen count remains 40. No navigation targets changed, so the completed navigation review was not repeated.
- **Passed:** token contrast calculations for the changed white panels: text 15.70:1, muted 5.75:1, indigo 6.08:1, danger 6.46:1 and teal 4.86:1. Muted text on the light grey inset cards is 5.28:1. Progress indicators and urgency icons are visible against the new backgrounds.

## Limitations

These are static design-render inspections, including browser geometry checks, rather than executable application workflow tests. Save, upload, assignment, download, filters and document access were not exercised against records. Existing unavailable previews/thumbnails remain unavailable.

Maintenance's phone stat carousel intentionally scrolls sideways, as Home's does. The unchanged shared phone navigation has the same small Properties/Payments label overhang as Home; labels remain visible and no page-level overflow or clipped controls was observed. Screenshots are retained locally and excluded from Git; the committed deliverable is this handoff note.
