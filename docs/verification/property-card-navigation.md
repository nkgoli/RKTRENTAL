# Property card navigation

Clicking Cedar Row Townhomes, Harbor View Lofts or Maple Court on `/properties` left the
manager on the directory; 18 Elm Street usually opened. Every card now opens its own
property workspace.

## Cause

The cards were never mis-linked: each renders `<Link href="/properties/{id}">` with its own
record id, and the click lands inside that link from the cover, title, body and progress bar.
The fault was in the navigation that link starts, and only in production builds (`next dev`
does not reproduce it).

- `/properties/[id]` had no `loading.tsx`, so the nearest Suspense boundary was the
  `(manager)` one that is already on screen. A client navigation that suspends there is held
  on the old screen ("suspended with delay") until React is pinged to retry.
- While rendering the property, React suspends on RSC (Flight) chunks. A chunk in the
  `resolved_model` state resolves synchronously inside `then`, so its ping arrives during the
  render. React's `pingSuspendedRoot` neither restarts nor records a ping received mid-render
  in that state, and `markRootSuspended` then clears it. The transition stays suspended with
  no pending work: the URL, page and `Link` pending state never change.
- Multi-unit workspaces stream far more chunks (about 87 KB of RSC for Harbor View Lofts vs
  14 KB for 18 Elm Street), so they hit the race almost every time; Elm usually escaped it but
  could stick too. Property → property navigation failed the same way.

Evidence from an unminified isolated build (CDP logpoints in React's work loop): the final
`throw` is a `resolved_model` chunk under the property `InnerLayoutRouter`, followed by
`ping … wipIsRoot=true exit=4` and `markSuspended … wipPinged=0`. Afterwards
`pendingLanes = suspendedLanes = 28672`, `pingedLanes = 0`, and the app-router state already
holds `canonicalUrl: /properties/seed-property-harbor`.

## Fix

`src/app/(manager)/properties/[id]/loading.tsx` gives each property its own loading boundary
(the existing `LoadingState` detail skeleton). Opening a property now mounts a fresh boundary,
so React commits immediately: the property header (name, address, tabs) shows at once and the
overview streams in behind the skeleton (about 0.3–0.8 s locally). No card markup, links,
filters, actions or Redisgn styling changed, and no shared theme, Button or Card files were
touched.

## Verification

Isolated runtime: this checkout, production `next build` + `next start` on port 3472,
embedded Postgres on port 5472 with a fresh `prisma/seed.ts` demo seed. The live app and its
database were not used.

| Check                                                            | Before fix                                                        | After fix                                              |
| ---------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------ |
| Mouse click on cover, title, rent and occupancy, 4 cards, 1280px | 18 Elm Street opened; the other 12 clicks stayed on `/properties` | 16/16 opened their own property                        |
| Mouse click on title, 4 cards, 1280px (screenshot run)           | 0/4 (all stayed on `/properties`)                                 | 4/4, URL and `h1` match the card                       |
| Touch tap on title, 4 cards, 390px (screenshot run)              | 0/4                                                               | 4/4, URL and `h1` match the card                       |
| `router.push` property → property (Elm → Cedar, Cedar → Harbor)  | stuck on the first property                                       | lands on the second property                           |
| `tests/properties/card-navigation.spec.ts` (6 tests)             | 5 of 5 then-present tests failed                                  | 6/6 passed (run 3 times; 10/10 with `--repeat-each=2`) |

The spec discovers cards from the rendered directory instead of hard-coding records. It
checks:

- mouse clicks on the cover, title and body of each card;
- keyboard Tab to each card, a visible focus ring (`:focus-visible`, 3px solid outline), then
  Enter;
- touch taps on the cover and title at 390px;
- the destination URL, property name (`h1`), address, and the overview body finishing;
- browser back returning to the directory;
- the `multi`, `vacancies` and `single` filters, and per-name searches that move each card to
  the first position;
- property → property navigation and the workspace tabs under the new boundary.

Run it against a production server, because `next dev` hides the bug:

```
npm run build && npm start   # or any production server with the demo seed
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npx playwright test --project=properties card-navigation
```

Screenshots stay local (ignored `tests/properties/.runtime/evidence/`) because the tracked tree
is at its size cap:

- `before/desktop-1280-*.png`, `before/mobile-390-*.png`: after clicking or tapping each
  card, still on the Properties directory.
- `after/desktop-1280-*.png`, `after/mobile-390-*.png`: each card's own workspace header,
  with the overview loading.
- `before/results.json`, `after/results.json`: URL and `h1` for every card and input.

## Limitations

- The underlying ping loss is in the React build bundled with Next 15.5. This boundary avoids
  it for property workspaces. Other dynamic routes without their own `loading.tsx` could hit
  the same race in production if they stream large payloads.
- Opening a property now briefly shows the detail skeleton below the property header instead
  of waiting on the directory.
