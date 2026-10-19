# RocketRental light visual system

Implementation reference for **Define the approved reusable visual system**. Use `Designs/rocketrental-light-system` **revision 7**, screens `shared-controls` and `responsive-navigation`. These complete the shared system; subsequent screen-family designs remain separate work.

The visual authority is `Designs/rocketrental-dashboard-mischief-manager` **revision 5**. Its palette-validation task owns that reference. This handoff does not modify it. `Diagrams/rocketrental-mindmap` revision 4, `f-portals` (manager and tenant portals) and `c-ux` (mobile-first, accessible use), govern the two navigation treatments; those nodes have no file pointers.

## Foundations

| Token | Value | Use |
| --- | --- | --- |
| `--design-primary` | `#3159d9` | Primary actions, active navigation, links, focus |
| `--design-background` | `#f7f9fc` | Page canvas |
| `--design-surface` | `#ffffff` | Cards, sidebar, controls |
| `--design-text` | `#17243b` | Headings, body, amounts |
| `--design-muted` | `#58687e` | Supporting text, labels |
| `--design-accent` | `#087c91` | Positive status, occupancy, secondary data series |
| `--design-danger` | `#b4233e` | Errors, overdue balances, destructive action |
| `--design-font` | Inter, system sans fallback | Body and controls |
| `--design-heading-font` | Space Grotesk, sans fallback | Headings, monogram wordmark, large amounts |
| `--design-radius` | `12px` | Surfaces and dialogs |
| Spacing unit | `8px` | 4/8/12/16/20/24/32px rhythm |

Additional semantic tokens used by this reference:

| Reference token | Value | Existing app token / purpose |
| --- | --- | --- |
| `--ls-line` | `#dce3ed` | `--rr-border`; decorative separators |
| `--ls-control-line` | `#7e8b9e` | `--rr-border-strong`; input and secondary-button boundaries |
| `--ls-tint` | `#edf2ff` | `--rr-primary-tint` |
| `--ls-primary-hover` / `--ls-primary-active` | `#264bc4` / `#203fa8` | Primary hover/pressed |
| `--ls-teal-tint` | `#f1fafc` | `--rr-ok-bg`; pair with approved teal |
| `--ls-danger-tint` | `#fff0f3` | `--rr-bad-bg`; pair with approved danger |
| `--ls-warn` / `--ls-warn-tint` | `#8a4b09` / `#fff6e8` | Pending or caution, always with text |
| `--ls-shadow-color` / `--ls-scrim` | `#17243b14` / `#17243b24` | Shadow / overlay |

Set tokens once and consume variables; keep all new component colors token-driven. Do not copy the dashboard's legacy 97KiB stylesheet into app source. The new design stylesheet is independently scoped under `.ls`; the `--ls-*` names explain the reference, not a required app API. Resolve existing local overrides when adapting the shared `--rr-*` tokens.

Use 14px/1.5 body text, 13px controls, and 12px metadata. Headings use 32/20/16px; page titles become 28px on phone. Large amounts use 38px desktop and 34px phone, with tabular numerals. Phone inputs are 16px. A compact layout reduces space before reducing type. Load both font families explicitly: the current app only declares Inter and aliases the heading font to the body font.

Cards have a 1px decorative border and 16–20px padding. Use 7px control corners and 12px surface corners. Ordinary cards have only `0 2px 3px #17243b14`; the primary financial summary can add `0 9px 24px -8px #17243b14`. Cobalt actions get a restrained 3px darker bottom shadow; pressed state removes it. Dialogs alone use the stronger `0 16px 40px #17243b24` elevation. Keep the tilted monogram and occasional decorative asterisk.

## Controls and states

| Pattern | Reusable rule | Current implementation touchpoint |
| --- | --- | --- |
| Buttons and links | One primary action per action group; secondary for alternatives, ghost for Cancel, outlined danger for destructive actions. Navigation uses links; mutations use buttons. 36px desktop minimum; 44px phone/coarse-pointer minimum. Icon-only targets are 44px and named. | `src/components/ui/Button.tsx`, `src/components/shell/PageHeader.tsx` |
| Hover, pressed, focus | Cobalt darkens through the two state tokens. Use a 3px primary focus outline with 3px gap. Keep visible focus on every keyboard target, including scrolling table regions and disclosure summaries. | `src/styles/accessibility.css`, `src/components/shell/focus.module.css` |
| Disabled and loading | Use native disabled for unavailable buttons. Keep text readable; avoid opacity on the whole control. Loading keeps the action label (“Saving…”), disables duplicate submission, and exposes busy/status information. The reference spinner is static. | `Button`, `src/components/RouteStates.tsx` |
| Inputs and selects | Persistent labels; hints and errors associated with `aria-describedby`; native readonly and disabled states. Use suitable input type, autocomplete, and decimal input mode in implementation. Keep hints outside the accessible label when composing fields. | `src/components/ui/Forms.tsx`, `AutoSubmitSelect.tsx` |
| Validation | A text summary links to the invalid field. Set `aria-invalid`, a danger border, and specific inline correction text; retain entered values. Only announce the current error. | Form consumers; extend `Field` error composition where needed |
| Checkbox/radio/switch | Native checked state, visible label, sufficient hit area; group radios with fieldset/legend. Existing Switch keeps `role=switch`, `aria-checked`, and an accessible name. | `Forms.tsx` |
| Badges | Paid/Occupied = teal; Pending = warning; Past due = danger; Active/Projected = cobalt; Draft = neutral. The text conveys meaning without the color or dot. | `src/components/ui/Badge.tsx` |
| Cards | Use a heading and selected depth for hierarchy. A passive card never pretends to be a button; only actionable surfaces receive hover treatment. | `src/components/ui/Card.tsx` |
| Tables | Preserve caption, column headers, row headers, and right-aligned amounts. Narrow views get a named, focusable horizontal-scroll region; page width stays fixed. Do not hide financial columns. | `src/components/ui/Table.tsx`, workspace tables |
| Tabs | Route-based tabs remain a navigation landmark with `aria-current=page`. Underline + color + weight mark the selection. Horizontal scroll is local to the strip. Use ARIA tab roles only for a real keyboard-operated in-page tab widget. | `src/components/ui/Tabs.tsx`, `src/components/workspace/WorkspaceTabs.tsx` |
| Empty/error/success | Explain the state and provide the next action. Preserve “No active lease yet”, “Something went wrong”, “Page not found”, and account feedback copy from the related designs. Use status for success/loading, alert for a new blocking error. | `RouteStates.tsx`, `RouteError.tsx`, `ui/Feedback.tsx` |
| Dialog | 440px maximum, 12px corners, readable body, Cancel before the destructive action. Production uses a real modal: focus the safe action, contain focus, make background inert, close with Escape, and restore the trigger. | `src/components/workspace/panels/operations/NewMaintenanceRequestDialog.tsx`; retain its native-dialog behavior |
| Disclosure | Native details/summary, visible plus/minus, 44px summary target. Expanded specimens expose all states without scripts. | Existing details-based state references |

`Feedback.Alert` currently supports info/warning/success, not an error tone. Add an intentional error variant when implementing; do not silently treat an error as a successful status. Existing accessibility CSS supplies useful focus/coarse-pointer/reduced-motion rules; update its white sidebar focus override for the new white sidebar.

## Navigation and responsive behavior

Manager: retain `managerNav` groups and routes from `src/components/shell/nav.ts`. Use a 208px white sidebar at **1024px and above**, with a cobalt-tinted current item and the approved icons. Below 1024px, the Main menu trigger opens a scrollable modal drawer. Retain the existing `ManagerShell` focus containment, Escape, inert background, route-close and focus-restoration behavior. Put focus on Close when it opens. Its content must fit the viewport with its own vertical scrolling.

Money always has four separate destinations: **Payments, ROI Analysis, Rent Analysis, Returns**. Rent comps stays contextual. Keep the selected property above analysis tabs, and preserve that scope when moving between analysis views. Do not collapse ROI Analysis and Returns into one icon or link.

Tenant: retain **Home / Pay / Lease / Repairs** and `/home / /pay / /lease / /repairs`. Home reuses the approved house silhouette; the others reuse payment, lease and maintenance icons. Use visible labels, `aria-current`, a top marker and tinted active background. Keep the existing 640px maximum portal width, sticky header, safe-area inset and bottom navigation in `TenantShell.tsx` / `tenant-shell.module.css`. Reserve at least 100px below content for the navigation and safe area, and keep focused controls clear of it.

At **640px and below**, the reference stacks content, uses 16px page gutters, wraps toolbars, and switches forms to one column. Native phone input text is 16px and controls are at least 44px. Long text wraps; dense tables/tabs scroll locally. The two-role reference page keeps its tenant tab bar in its own specimen's flow so it cannot obscure another specimen; the live tenant portal retains its fixed navigation with reserved body space.

## Exact icons

[light-system-icons.json](light-system-icons.json) contains **20 exact SVGs** extracted from approved revision 5, their primitive attributes, app mappings, four tenant aliases, and the three decorative/activity glyphs. Reuse the full geometry, not a similar library icon.

- Navigation/actions: 24 × 24 viewBox, 1.7 stroke, round caps/joins, no fill, currentColor; normally displayed at 18px.
- Property miniatures: 40 × 40 viewBox, 1.4 stroke, normally 29px. Keep all four approved building shapes.
- Monogram: 32 × 32 viewBox, 3.5 square-cap stroke plus filled corner motif. The 25px SVG sits in a 29 × 32px cobalt tile rotated −5°.
- Preserve decorative `✳`, lease-created `↗`, and payment-received `✓` as glyphs with their reference font/context. Never make meaning depend on a glyph.
- Hide decorative SVGs from assistive technology, prevent separate SVG focus, and label the containing control.
- Current `shell/Icons.tsx` uses 1.8 strokes and similar but different paths. In particular, ROI Analysis currently shares `returns`, and Rent Analysis uses `rent-comps`. These require the distinct approved mappings; no application source was changed here.
- `dashboard/MiniCover.tsx` currently uses Cover assets. Use the approved small-building fallback where appropriate and retain real property photos.

## Related screen families

| Reference read | Apply this system while preserving its content/flow |
| --- | --- |
| `Designs/rocketrental-app` revision 337 | Manager lists, property/unit workspaces, lease builder, payments, documents, maintenance, integrations; tenant home/pay/lease/repairs. Reuse their routes and labels; adapt shared controls and theme first. |
| `Designs/rocketrental-account-recovery` revision 5 | Sign-in/out, generic credential error, loading, no active lease, retry and not-found. Keep exact recovery messages and safe return destinations. |
| `Designs/rocketrental-analysis` revision 36 | Property selector, ROI Summary/Projections/Scenarios/Benchmarks, Rent Analysis, exact amounts and local table overflow. Keep projected/actual distinctions and assumptions. The phone specimen's values come from this reference. |

These are observed source revisions for implementation mapping, not revised screen-family approvals.

## Self-check evidence

Both assigned screens were rendered and visually inspected at **1280 × 900** and **390 × 844** viewport sizes in the configured Chromium browser. Final revision 7 shows the archive dialog, account feedback, payment review, lease details, full manager menu, and assumptions expanded. Default/collapsed layouts were also inspected during authoring. A tenant-navigation overlap and a teal-tint contrast failure were found and corrected.

Submitted screenshot evidence (separate Task artifacts, not application files):

| Screen | Desktop | Phone |
| --- | --- | --- |
| Shared controls, expanded | `light-system-controls-expanded-1280.png` | `light-system-controls-expanded-390.png` |
| Responsive navigation, expanded | `light-system-navigation-expanded-1280.png` | `light-system-navigation-expanded-390.png` |

Full-page PNG content widths are 1265px and 375px respectively because Chromium reserves 15px for the vertical scrollbar. Their content does not extend beyond the viewport. Forms, menus and dialog text wrap; wide table content is intentionally clipped inside its horizontal-scroll region. Focus presentation is visible on the specimen's Save and Cancel controls. Reduced-motion and forced-colors rules are present but have not had an assistive-technology audit.

Calculated from exact sRGB tokens using relative luminance and `(Llighter + 0.05) / (Ldarker + 0.05)`:

| Pair | Contrast |
| --- | ---: |
| Text / white | 15.53:1 |
| Muted / white; muted / canvas | 5.68:1; 5.39:1 |
| White / cobalt; primary / primary tint | 5.90:1; 5.26:1 |
| White / hover; white / pressed | 7.28:1; 8.98:1 |
| Teal / teal tint | 4.61:1 |
| Danger / danger tint | 5.85:1 |
| Warning / warning tint | 6.34:1 |
| Control boundary / white; boundary / canvas | 3.46:1; 3.28:1 |

All checked text pairs meet 4.5:1; checked essential control boundaries meet 3:1. Decorative separators are not control boundaries. This is token-pair validation, not a claim of full WCAG conformance.

The design viewer is deliberately script-sandboxed. Its DOM-evaluation and click helpers stalled with blocked-script errors, so script-dependent keyboard/modal behavior was **not verified**. Expanded states were authored with native `open` disclosures, rendered, and inspected without relaxing the sandbox. The dialog is explicitly a nonmodal presentation specimen; functional modal behavior, server validation, payments, and recovery transitions remain implementation checks. No app build/test suite was run for these design and documentation changes.
