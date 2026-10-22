# Redisgn — Home refinement ("tone it down a bit")

Follow-up to [redisgn-foundation.md](redisgn-foundation.md). Only the `home` and
`home-mobile` screens of Designs/redisgn were rewritten. Tokens, the shared
components (`brand`, `desktop-navigation`, `mobile-navigation`) and every other
screen were left alone.

- **Before:** revision 5 (foundation hand-off).
- **After:** `home` saved at revision 9 and `home-mobile` saved at revision 7.
  Both are current at **revision 9**. Revision 8 came from another writer and did
  not touch either Home screen.

## Before → after

| Area | Revision 5 (before) | Revision 9 (after) |
| --- | --- | --- |
| Page label `title` / `home-mobile-0` | Uppercase indigo heading (level 4) | Indigo eyebrow text; same words and ids |
| Greeting `greet` / `m-greet` | Display-size ("large"/level 1), tight tracking, bold | Level 2, medium weight, normal tracking; fits on one line on mobile |
| Collection area `band` / `m-band` | Indigo→teal gradient, dot pattern, lifted shadow, large corners, white text | White surface, 1px border, default rounded corners, no shadow or pattern |
| Amount `band-v` / `m-band-v` | Display size, black weight, tight tracking | Large (desktop) / level 2 (mobile), bold, text colour: still the biggest number on the page |
| Collection accents | Everything in white on the gradient | Indigo eyebrow and progress bar; muted "of $73,630 due"; unpaid line in danger red (desktop) |
| "Open rent roll" | Secondary outline button on the gradient | Solid primary button, so the main action stays confident |
| Stat cards `s-occ`/`s-exp`/`s-rep` | White, large corners, on the gradient | Light background fill, default corners, inside the band |
| Attention panel `attn` / `m-attn` | Large dark (`text`) card, bold headings, white ink | Bordered white panel; indigo bell; eyebrows coloured by urgency (danger for past grace/urgent repair, teal for leasing); medium-weight item headings; muted detail text |
| Section headings (h3) | Bold heading font | Medium weight, same level |
| Row names in lists | Bold | Medium |
| Card treatments | `corners: large` and `shadow: soft` everywhere; gradient on occupancy panel | Default corners; no shadows; occupancy panel is plain surface with a border |

Unchanged: layout and grid structure, every number and label, every link and
`goesTo` target, badges and their tones, the chart, the occupancy bars (teal),
the dark navigation rail, the mobile app bar, the sideways-scrolling stat cards
and the pinned tab bar.

## Calmer Home conventions (proposed for reuse; not applied elsewhere)

- One accent per element: indigo for brand labels, progress and primary actions;
  teal for occupancy and leasing; danger red only for money owed or urgent items.
- Large figures use bold weight, not black, and never display size, on
  operational screens.
- Panels are a white surface with a border and default rounding. Avoid
  gradients, patterns and lifted shadows. Keep the dark fill for the navigation
  rail only.
- Section headings are h3 medium. Page greetings are h2 medium.
- Each panel keeps one solid primary button at most; other links stay as text
  links.

These are suggestions for the other slices. Their owners decide whether to use
them.

## Verification

- `design_screenshot` of `home` at 1280 px (revisions 6 and 9). In revision 6 the
  bordered panels drew with square corners. That was fixed in revision 9 by adding
  `rounded`. No clipping. The amount, unpaid line and badges are readable.
- `design_screenshot` of `home-mobile` at 390 px (revisions 7 and 9). The greeting
  is now on one line. There is no sideways overflow apart from the intentional
  stat-card carousel. The attention panel's red and teal eyebrows read on white.
- Before screenshots of revision 5 at both widths were taken in the same session.
  They are kept locally only, because of the repository size cap.
- No application source was changed and no live data was touched.
