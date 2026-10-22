# People and applications · Home aesthetic handoff

All eight assigned screens in **Designs/redisgn** now follow approved **Home / Home · mobile r134**. Screen-local saves span r165–r172; the complete inspected result is **r172**.

## Meaningful refinements

- People and Applications summaries use Home's white bordered surface, 16px corners, primary progress bars and quiet background KPI cards. Gradients, dotted patterns and lifted shadows are removed. The $13,240 balance retains Home's prominent financial scale: large on desktop and level 2 on phone.
- Page, directory, guidance and applicant headings use medium weight. Directory names and balances retain their sizes with calmer weight. Dark guidance and selected-applicant cards are now white with primary icons/eyebrows, muted supporting text and an accent consent label.
- Invitation forms use subtle bordered cards. Phone Property and Unit selectors stack at full width so their saved values do not wrap into cramped controls.
- Promotion page headings and saved-contact emphasis follow Home. The existing modal/bottom-sheet layout, overlay, notices and actions already matched the restrained operational hierarchy and remain in place.

Inputs, tabs, status badges, steps, notices and sections already fitting Home keep their structure. No screens were left wholly unchanged.

## Screen and screenshot evidence

Before: r134. Final screenshots: r172, rendered with `design_screenshot(name="redisgn", revision=172, screen=<id>)`. The approved reference screenshots are [Home · 1280px](C:/Users/nkgol/AppData/Local/Temp/orchestra-redisgn-people-a5ca572e/home-r134.png) and [Home · mobile · 390px](C:/Users/nkgol/AppData/Local/Temp/orchestra-redisgn-people-a5ca572e/home-mobile-r134.png).

| Screen | Width | Saved at | Before screenshot | Final screenshot |
| --- | --- | --- | --- | --- |
| `people` | 1280px | r165 | [r134](C:/Users/nkgol/AppData/Local/Temp/orchestra-redisgn-people-a5ca572e/people-r134.png) | [r172](C:/Users/nkgol/AppData/Local/Temp/orchestra-redisgn-people-a5ca572e/people-r172.png) |
| `people-mobile` | 390px | r166 | [r134](C:/Users/nkgol/AppData/Local/Temp/orchestra-redisgn-people-a5ca572e/people-mobile-r134.png) | [r172](C:/Users/nkgol/AppData/Local/Temp/orchestra-redisgn-people-a5ca572e/people-mobile-r172.png) |
| `applications` | 1280px | r167 | [r134](C:/Users/nkgol/AppData/Local/Temp/orchestra-redisgn-people-a5ca572e/applications-r134.png) | [r172](C:/Users/nkgol/AppData/Local/Temp/orchestra-redisgn-people-a5ca572e/applications-r172.png) |
| `applications-mobile` | 390px | r168 | [r134](C:/Users/nkgol/AppData/Local/Temp/orchestra-redisgn-people-a5ca572e/applications-mobile-r134.png) | [r172](C:/Users/nkgol/AppData/Local/Temp/orchestra-redisgn-people-a5ca572e/applications-mobile-r172.png) |
| `applications-invite` | 1280px | r169 | [r134](C:/Users/nkgol/AppData/Local/Temp/orchestra-redisgn-people-a5ca572e/applications-invite-r134.png) | [r172](C:/Users/nkgol/AppData/Local/Temp/orchestra-redisgn-people-a5ca572e/applications-invite-r172.png) |
| `applications-invite-mobile` | 390px | r170 | [r134](C:/Users/nkgol/AppData/Local/Temp/orchestra-redisgn-people-a5ca572e/applications-invite-mobile-r134.png) | [r172](C:/Users/nkgol/AppData/Local/Temp/orchestra-redisgn-people-a5ca572e/applications-invite-mobile-r172.png) |
| `applications-promote` | 1280px | r171 | [r134](C:/Users/nkgol/AppData/Local/Temp/orchestra-redisgn-people-a5ca572e/applications-promote-r134.png) | [r172](C:/Users/nkgol/AppData/Local/Temp/orchestra-redisgn-people-a5ca572e/applications-promote-r172.png) |
| `applications-promote-mobile` | 390px | r172 | [r134](C:/Users/nkgol/AppData/Local/Temp/orchestra-redisgn-people-a5ca572e/applications-promote-mobile-r134.png) | [r172](C:/Users/nkgol/AppData/Local/Temp/orchestra-redisgn-people-a5ca572e/applications-promote-mobile-r172.png) |

The retained source checkout is `C:/Users/nkgol/RocketRental/.orchestra/workspaces/@3yuua96hcj68vlm2me8/repository`. Screenshot files are local, outside Git in the temporary evidence location linked above, to honor the single-file repository fence. [Screenshot dimensions, sizes and SHA-256 hashes](C:/Users/nkgol/AppData/Local/Temp/orchestra-redisgn-people-a5ca572e/screenshot-manifest.json) identify the retained PNGs. Their immutable design revisions allow re-rendering if local temporary evidence is cleared.

## Targeted checks

- **Passed — visual acceptance:** inspected every final screen against the approved device-specific Home at 1280px/390px. Changed surfaces, typography, icons and progress indicators are readable; no clipped controls or unintended page-wide horizontal overflow were observed. Contact edits, decision controls, invitation preview/status and promotion confirmation remain visible.
- **Passed — foreground contrast:** source token contrast against the new white surfaces is text 15.70:1, muted 5.75:1, primary 6.08:1 and accent 4.86:1. White progress strokes became primary; formerly white guidance icons became primary. This is a token calculation plus rendered inspection, not a browser computed-style accessibility audit.
- **Passed — preservation:** [structural comparison of r134 to r172](C:/Users/nkgol/AppData/Local/Temp/orchestra-redisgn-people-a5ca572e/preservation-check-r172.json) found style-only changes across all 437 assigned blocks. Block types, IDs/order, text, data, fields/options/values, workflow states, component references/overrides and link targets are preserved. Home variants, all global tokens/components and the complete screen ID list compare exactly equal.
- **Passed — lifecycle and availability:** submitted applications remain distinct from invitations/drafts; approval precedes explicit promotion. Secure links remain unavailable; no invitation has been created or emailed. The existing-contact/duplicate-contact rules and no-lease/no-charge/no-notification copy are unchanged.
- **Passed — evidence files:** all 18 PNGs (eight before/after pairs and two Home references) decode correctly and have their required 1280px/390px widths.

## Limits

These are static Design-mode observations. No executable browser, keyboard, scrolling, sending, screening or real-record interactions were performed. The People phone KPI rail intentionally scrolls sideways as Home does; its default position is shown, with later cards partially offscreen. The existing navigation review was not repeated because no targets changed. Inherited badge, alert and modal rendering remains unchanged; the contrast calculation covers the foreground tokens used on the changed surfaces.
