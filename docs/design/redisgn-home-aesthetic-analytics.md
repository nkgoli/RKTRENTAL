# Analysis and More aligned with Home

The five assigned screens in Designs/redisgn now follow the approved Home and Home · mobile at revision 134. Screen-local writes were used throughout; all five were inspected together at revision 142. A subsequent read at revision 172 confirmed these screens still matched that inspected revision.

## Changes and revision references

Every before reference below is Designs/redisgn r134. The latest design was read before each screen write.

| Screen ID | Saved revision | Refinement | Final rendered screenshot (r142) |
| --- | --- | --- | --- |
| `returns` | 136 | White bordered summary; 50.6px medium financial heading; subtle inset metrics; white actuals panel with explicit warning and unavailable-data emphasis. | [Desktop, 1280px](../../.playwright-mcp/analytics-design-returns-r142-desktop.png) |
| `returns-mobile` | 137 | White summary and actuals panel; 32px medium financial heading; theme-radius cards and quiet estimate section. | [Phone, 390px](../../.playwright-mcp/analytics-design-returns-r142-mobile.png) |
| `rent-analysis` | 138 | White summary and market-rent panel; 50.6px medium financial heading; restrained metric cards and map section. | [Desktop, 1280px](../../.playwright-mcp/analytics-design-rent-analysis-r142-desktop.png) |
| `rent-analysis-mobile` | 140 | White summary and market-rent panel; 32px medium financial heading; primary tag icon and confidence progress restored for the light surface. | [Phone, 390px](../../.playwright-mcp/analytics-design-rent-analysis-r142-mobile.png) |
| `more-mobile` | 142 | Medium page heading and theme-radius cards. Its white surfaces, grouping, padding and spacing already matched Home and were retained. | [Phone, 390px](../../.playwright-mcp/analytics-design-more-mobile-r142.png) |

Gradient, dots and lifted shadows were removed from the analysis summaries. Section headings use medium weight; existing tables, lists, filters, period selectors, information order and phone metric carousels remain. Desktop summaries use Home's 32px padding and measured grid gaps. Important financial values retain a larger scale than surrounding headings.

Reference captures: [Home r134, 1280px](../../.playwright-mcp/analytics-design-home-r134-desktop.png) and [Home · mobile r134, 390px](../../.playwright-mcp/analytics-design-home-r134-mobile.png).

## Verification

- **Visual comparison passed:** `design_screenshot` rendered all five screens at r142, compared with Home r134 at the specified device widths. The linked PNGs are those exact Design mode renders, retained at 1280px/390px with each complete canvas. The configured Playwright browser also opened each fixed-revision design target for static layout and computed-style observations at those widths.
- **Layout passed:** document and canvas widths matched 1280px on desktop and 390px on phone. Rendered buttons, selects, links and accordions had no horizontal clipping; the More lists and shared bottom bars were also inspected visually. Only the existing phone metric carousels scroll horizontally (358px visible, 762px content); neither causes page-wide overflow.
- **Contrast passed:** primary, muted, danger and body text on white have token contrast ratios of 6.08:1, 5.75:1, 6.46:1 and 15.70:1. Negative cash flow and risk use danger; confidence and market-rent icons use primary. No white foreground/progress fill remains on the changed light panels.
- **Preservation passed:** structural comparison with r134 found only styling/heading-level changes in the five assigned screens. All block IDs, text, amounts, signs, table/list data, form values/options, workflow states and link targets are unchanged. Home variants, tokens, shared components and the 40-screen ID list are exactly unchanged. This includes partial/unrecorded/unavailable actuals, projected and scheduled distinctions, demo-comp warnings, listed/saved/suggested rents and signed market gaps.

## Limitations and retained evidence

These are static design inspections and browser geometry observations. Selects, Save analysis, Apply to Unit 3A and other controls were not exercised as application workflows; no records were changed. A supplemental browser capture pass encountered `MCP_SESSION_NOT_FOUND` after the successful geometry/style observations; the final linked evidence uses the exact-width Design mode renders. The completed navigation review was not repeated because no destination changed. No application code, deployment or executable application tests were involved. No remaining visual defect was observed at the requested widths; the existing phone metric carousels remain intentional.

Screenshots remain local, outside Git, in this retained checkout: `C:/Users/nkgol/RocketRental/.orchestra/workspaces/@3yuua96hcj68vlm2me8/repository`. The links above identify individual evidence files; they do not copy those images into another checkout.
