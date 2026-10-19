# Light lease builder: Term and Rent — implementation

Implements `Designs/rocketrental-light-lease-builder` revision 14 (`term`, `term-phone`, `rent`, `rent-phone`) against `Designs/rocketrental-light-system` revision 7, following the handoff in [light-lease-builder-start.md](light-lease-builder-start.md). The ten-step order, validation, charge calculations, draft save/resume, renewal context and navigation semantics are unchanged; only shared presentation and the first two steps changed.

## Source-to-design mapping

| Design element                                                                | Implementation                                                                                                             |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Light top bar, back control, Save and exit                                    | `lease-builder.module.css` `.topbar` / `.back` / `.exit`; caption in `LeaseBuilder.tsx` and `UnitPicker.tsx`               |
| Draft status badges (Not saved yet / Unsaved changes / Saving… / Draft saved) | `.introDraft` with `.draftNeutral` / `.draftUnsaved` and `.spinner` in `LeaseBuilder.tsx`                                  |
| 1152px wrap, 208px step column, panel head band and icon                      | `.layout`, `.cardHead`, `.panelIcon`                                                                                       |
| Ten-step list, visited/current markers, phone horizontal scroll               | `.steps` with `tabIndex`/`aria-label`, `.phoneHint`; 700px media query                                                     |
| Term choice cards with computed end dates and hint bars                       | `TermStep` in `steps.tsx` using `endOptionDates`; no specimen dates hard-coded                                             |
| Rent fields, optional-fee grid, proration and scheduled charges preview       | `RentStep` / `ChargesPreview` with `.fees` and `.ledger` styles; calculations still come from `fees.ts` / `lease-setup.ts` |
| In-flow panel footer, Next destination, focus and disabled states             | `.footer` (static), `data-next-step` on Next, 3px focus outline, readable disabled controls                                |

Supporting-state specimens in the design (validation, saving, failure, unit entry, resume/renewal, proration options) remain references; the application renders the equivalent real states through the existing handlers, error summary and pending fieldset, not as a static gallery.

## Verification

- New focused tests: `tests/lease-builder/light-lease-builder.test.tsx` (term choices with computed dates, 28 due-day options, charge preview, accessible step list, draft status, disabled Back, Next destination).
- Existing suites: `tests/lease-create/` run unchanged.
- Typecheck and lint run on the touched files.

## Remaining native checklist

- Manager-coordinated native Edge review of the create / draft / resume / navigation flows at desktop and 390px is still required for final acceptance; no Edge grant was available in this Task, so no native pass is claimed.
- Isolated production-browser captures should be taken on the reserved app/DB ports only after confirming ownership; automated observations above do not replace that checklist.
