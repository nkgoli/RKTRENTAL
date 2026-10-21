# ROI UX polish: core projection charts (Equity, Cash Flow, Expenses, Amortization)

This slice applies the overview patterns in `roi-ux-polish.md` §3 to the Charts tab's first
four sub-tabs: C6–C13 and C17. No calculation, horizon, option or data path changed. The same
keyboard readout reads the same cents before and after. For example, Elm Year 2 reads
`Property Value $438,151.70; − Mortgage Balance $282,323.13; = Equity $155,828.57`.

Base: `dc0991f` (the overview slice). Owned files: `RoiProjections.tsx`, `RoiExpenses.tsx`,
`RoiAmortization.tsx`, `projections.module.css`, `detail-charts.module.css` and their tests.

## 1. What changed

**Every card in the four groups**

- The subtitle is one plain sentence about what the chart answers.
- The basis facts that were packed into the subtitle with "·" are now `basis` tags (kind, unit,
  period, tax). Examples: `Projected · USD · After debt service and reserves · Before tax`, and
  `Scheduled loan · USD · Running totals · Full 30-year term`.
- Cards show whole dollars. Cents now appear only in the exact tables. Before, these showed
  cents: the cash-flow tiles (`-$154,664.52`), the recovery tile (`-92.3370%`), the Equity growth
  and Year-1 bars (`$124,000.00`) and the Equity & cash flow total.
- Exact tables moved into `MoreDetail` disclosures. Each summary says what opens, for example
  "Exact annual amounts, all 10 years". The tables, captions and cents are unchanged. Removing
  the separate always-open table cards takes 30-row tables (Equity, Amortization) off the page
  until asked for.
- The Charts toolbar shows basis tags (`Projected`/`Out of date`, `N-year hold`, `USD`, `Before
tax`) instead of a "·" sentence. The page note now says that cards are whole dollars and the
  tables are to the cent.

**Equity (C6, C7)**

- C6 drops the reference's fixed `[0, ceil(max × 1.1 / 50k) × 50k]` domain. Its ticks were
  uneven ($0k, $90k, $180k, $350k on Elm; $0k, $250k, $500k, $950k on the RealROI sample).
  The automatic nice scale gives equal steps ($0k, $75k … $300k).
- C6 also drops the mirrored right "Debt" axis: it repeated the same scale. One axis title
  ("USD, year-end" or "Index (Y1 = 100)") covers both the bars and the mortgage line.
- The C6 legend follows the stack, bottom up: Down payment, Principal paid, Appreciation, Value
  decline, then the Mortgage balance line.
- For all-cash purchases, the title drops "vs Debt Paydown", and there is no Principal paid or
  Mortgage key. C7 becomes "Property Value & Equity" with no flat $0 mortgage line, and its
  tooltip reads "No loan". The spoken readout keeps the exact `$0.00`.
- C7 labels every year on short holds, with "Start" instead of "0". The thinning logic still
  applies on phones. The footnote no longer calls the blue band "teal".
- The indexed view states "Y1 = 100" once, in the subtitle. A footnote appears only when Year-1
  equity cannot be indexed.

**Cash Flow (C8, C9, Year-1 bars)**

- The C8 legend names only what is drawn. There is no "Post-breakeven" key when the range never
  breaks even, and no blue "Cash Flow" key when every year is negative. The band labels now
  read "Before/After breakeven".
- When the best year is still a loss ("Best: -$15,217"), the chip is neutral rather than "good"
  teal.
- The recovery tile is now "Initial cash recovered" at one decimal (it was a four-decimal
  rate). When the figure is negative it is red and the note reads "Still paying in at year N".
- In C9, debt service is an amber dashed line and NOI is teal. Before, the grey dashed debt
  line sat on top of the light-blue GOI line and the two blues were hard to tell apart.
- The legend labels are shorter.
- The Year-1 bars card holds "Exact annual amounts, all N years". That table is the
  `Projection amounts` table.

**Expenses (C10, expense growth)**

- The year picker is labelled "Year shown", because Y1/Y5/Y10 select a single year here, not a
  range.
- The category table opens from "Exact amounts by category, year N".
- In the expense-growth chart, operating expenses are navy and the reserve is amber dashed.
  Before, they were grey and blue-dashed.
- The two method paragraphs move into "How expenses grow". "Exact expense projections, all N
  years" and the Edit expense assumptions button stay in the card.

**Amortization (C11, C12/C13/C17)**

- In C11, the three areas were 60% opaque and overlapped into brown. They are now light 15%
  fills under 2.5 px lines, so the crossing points read clearly.
- The note under C11 explains how to read the crossing. The monthly payment is no longer
  repeated, because the schedule tile shows it once.
- The separate "Amortization schedule" card is gone. Its annual table and the monthly schedule
  (with its year picker) are two disclosures at the foot of the schedule card.
- The all-cash card keeps "All-cash purchase · debt service $0.00…", with `All-cash purchase ·
USD` basis tags.

**Unchanged**: calculations; horizons and their defaults (Equity Y30, Cash Flow Y10, Expenses
Y1); the down-payment, indexed, sort, what-if, Summary/Detailed, Expand/Collapse and insight
selects; selected sub-tabs in the address; "Unavailable"/"No loan"/"Paid off" for unknown
values; touch and keyboard readouts; reduced motion.

## 2. Shared findings (for the final slice, not changed here)

1. `ComboChart` speaks the exact value for a tooltip row even when the row shows `text`
   ("No loan" is read as "$0.00"). That is correct, but the visual and spoken forms differ. The
   final slice may want a spoken override.
2. `fixedDomainScale` is still used by other charts. Its uneven last step (`…, 500k, 950k`)
   hurts readability wherever `domainMax` is passed.
3. `useHorizon` cannot carry a visible label. The expense "Year shown" label is a local
   wrapper; a `label` option on the control would serve every single-year picker.
4. On Amortization, C11's y ticks follow the reference scale ($95k steps). They are evenly
   spaced but not round. A round-number option in `referenceScale` would help C11 and Exit.

## 3. Evidence and verification

Untracked evidence lives in `evidence/roi-ux-core/` (146 files, about 14.5 MB). There are
`before/` and `after/` sets. Each set has every group for 7 properties at 1440 and 390 px
(`<group>-<property>-<width>.jpg`), `*-expanded` captures with every disclosure open, the
equity tooltip and controls captures, and `ux-core-report.json`. `after/` adds the
`missing-<group>-<width>.jpg` captures.

The runtimes were fully isolated:

- Each build was this branch's owned files over a `git archive` of `dc0991f`, in the ignored
  `.data/ux-core-before/`. The base build ran first (before), then the overlaid build (after).
- They ran against a fresh embedded Postgres on 5544, created and seeded by `start.ps1`.
- `demo:roi` added the fictional examples, which give the all-cash, financed and tight cases.
- Ports were 3194 (before), then 3197 (after), because another Task took 3194.
- The live 3100/5434 app was not touched or restarted, and nothing was pushed.

Harness: `node tests/analysis/ux-core-runtime.mjs <baseUrl> <outDir> [namePattern]`. It refuses
port 3100. `UX_CORE_MISSING=<propertyId>` opts into one save, which clears that property's
vacancy, so use it only on an isolated database. The harness checks:

- page overflow and overlapping SVG labels for every group, property and width;
- that the selected sub-tab stays selected;
- the equity readout via keyboard (Home/→) at 1440 and tap at 390;
- the horizon, Indexed and down-payment controls;
- sub-tab arrow keys and tap, kept in the URL and after a reload;
- the expense sort menu (Enter/↓/Enter, Escape) and the what-if toggle;
- the Detailed schedule, Year 1 expand and Collapse All;
- that every disclosure opens by Enter or tap;
- console errors;
- that nothing animates under `prefers-reduced-motion: reduce`.

Results:

- **Before**: 198 checks, 0 failures; 1 disclosure per width.
- **After**: 216 checks, 0 failures; 7 disclosures opened at each width. The missing-data
  checks covered Cedar Row with vacancy cleared: every group shows "Complete your assumptions to
  see charts", with no chart, no overflow and no console errors.
- The cases covered:
  - Normal and negative: 18 Elm Street (−$15,723 Year 1, no breakeven) and Maple.
  - Positive: Harbor and the fictional Financed rental.
  - All-cash: the fictional Cash Purchase.
  - Tight: the fictional Tight Cash Flow.
  - Missing: Cedar Row after the opt-in edit.
- **Focused checks**:
  - `tsc --noEmit` passed.
  - ESLint (`--max-warnings=0`) and Prettier passed on the changed files.
  - `vitest run tests/analysis` gave 195 passed and 17 skipped (the database suites). That
    includes three new presentation tests: legends without breakeven, disclosures holding the
    exact tables, and the all-cash state.
  - Updated pins: C6's evenly spaced axis replaces the $950k reference domain, the recovery
    figure "24.5%" now appears in both the insight and the tile, and C11's fills are 0.15.
