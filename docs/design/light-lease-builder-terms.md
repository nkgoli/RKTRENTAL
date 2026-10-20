# Light lease builder: Clauses, Rules and Disclosures

Completed **Design light lease clauses, rules and disclosures** in `Designs/rocketrental-light-lease-terms`, **revision 13**.

| Screen ID | Width | Step and main specimen |
| --- | --- | --- |
| `clauses` | 1280px | Step 5; included clauses, expanded Security Deposit, unresolved fill-in and an inapplicable month-to-month term |
| `clauses-phone` | 390px | Same content, with long wording and stacked template actions |
| `rules` | 1280px | Step 6; expanded Quiet hours, parking/laundry/pet conditions and inapplicable balcony rule |
| `rules-phone` | 390px | Same fields and actions in one column |
| `disclosures` | 1280px | Step 7; pre-1978, owner/agent, deposit holding and inapplicable flood disclosure |
| `disclosures-phone` | 390px | Same disclosure content with wrapping placeholders and readable editors |

Each screen has six separately labeled **Supporting states** panels: add/edit/exclude, empty/validation, renewal, template saving/results, draft saving, and draft failure/resume. These panels are design references, not product UI. The main specimens show a manager-expanded item; the component initially starts with items collapsed.

## References and source identity

- Source inspected at `adcf39baaeae761058ed25b452d237a45488f567` in the assigned checkout. `git merge-base --is-ancestor 21ace4e0840bdfd0413eed4e646bb641d8818c4a HEAD` exited 0, verifying the exact [people/options handoff](light-lease-builder-people-options.md) is present.
- Read the six revision-1 terms scaffolds; finished only those six screens. Preserved the inherited stylesheet and appended scoped `.lt-*` rules.
- Read `Designs/rocketrental-light-lease-people-options` revision 10 (Options), `Designs/rocketrental-light-lease-builder` revision 14 (Rent), and `Designs/rocketrental-light-system` revision 7. Retained the reviewed shell, Inter/Space Grotesk, cobalt/teal palette, pale canvas, 12px corners and 8px spacing basis.
- Read `Diagrams/rocketrental-mindmap` revision 4, including `f-leasing-1`, `f-leasing-2` and `c-ux`. Those nodes have no additional file pointers. No input attachments were supplied.
- Behavior comes from [TemplateTermsStep](../../src/components/lease-builder/TemplateTermsStep.tsx), [template resolution](../../src/lib/lease-create/templates.ts), [LeaseBuilder](../../src/components/lease-builder/LeaseBuilder.tsx), [validation](../../src/lib/lease-create/validation.ts), [draft types/defaults](../../src/lib/lease-create/types.ts), [draft persistence](../../src/lib/lease-create/drafts.ts), [template service](../../src/lib/lease-create/template-service.ts), [entry page](<../../src/app/(manager)/leases/new/page.tsx>) and [save actions](<../../src/app/(manager)/leases/new/actions.ts>).
- `LeaseBuilder` renders `TemplateTermsStep` for all three sections. Legacy `ClausesStep`, `RulesStep` and `DisclosuresStep` in `steps.tsx` are not this implementation contract.

## Static fixture and copy

**Maple Court lease · v3** is a fictional, manager-owned property template, not an observed database record or a replacement for the standard template. Its fifteen items use exact paragraphs from [STANDARD_V2_ITEMS](../../src/lib/lease-create/standard-v2.ts), with only draft placeholder substitution in the main specimens. The real service ensures **Standard residential lease · v2**, which contains 71 items; the design does not invent pagination, omit items from that standard definition, or propose changing it.

| Section | Source item IDs used by the property fixture, in order |
| --- | --- |
| Clauses | `clause-01`, `clause-03`, `clause-05`, `clause-06`, `clause-13` |
| Rules | `rule-03`, `rule-13`, `rule-14`, `rule-15`, `rule-18` |
| Disclosures | `disclosure-01`, `disclosure-02`, `disclosure-04`, `disclosure-05`, `disclosure-06` |

Fixture context: fixed term, multi-unit property built in 1968; pets allowed, assigned parking and shared laundry; no balcony/patio or flood zone; tenant pays Electricity, Gas and Internet. Rent/deposit are $2,400, dates are 2026-11-01 through 2027-10-31, due day is 1 and renewal notice is 60 days. Owner/agent values are fictional. Deposit institution, quiet hours and landlord-paid utilities remain unresolved. Each section therefore has four included items and one conditionally excluded item.

The renewal specimen uses a fictional carried v2 alongside current v3. Changed examples compare prior signed values with a new rent/start date, quiet-hours value, or owner/agent name. They illustrate the comparison, not actual prior leases.

## Field and action mapping

| Control or display | Existing source behavior to preserve |
| --- | --- |
| Lease template | `selected = draft.template ?? templates[0]`. Add the selected snapshot to choices when its id/version pair is absent. Values are `id:version`; labels are name and version. The selected old version gains **(carried over)** when the current matching version differs, including when there is no current match. |
| Selection changes | Set `draft.template` and clear the entire `termOverrides` object. This affects Clauses, Rules and Disclosures together. It does not clear `placeholderValues`, replace current fee fields, or change the renewal comparison items. |
| Reset to template | Clear all `termOverrides`, including custom additions, across the three sections. Keep the selected definition and placeholder values. There is no confirmation dialog or per-item reset control. The cross-section warning remains next to these actions. |
| Included count and order | Resolve all terms, filter by section, count `included`. Sort by stored `order`; numbering is the item's index within the complete section, so numbers can skip where an item is in the inapplicable group. No ordering controls exist here. |
| Include checkbox | Patch `termOverrides[id].included`. Any explicit inclusion override gives reason **Selected manually**. **Required by template** is informational: the checkbox remains editable, including unchecking required items. |
| Main vs inapplicable list | Main list contains included items **or any item with an explicit included override**, even a manually excluded row. Remaining items go into **Not applicable to this lease (N)**. Selecting one moves it into the main list. |
| Empty section | **No clauses/rules/disclosures included yet. Add one below or review the items that are not applicable.** appears only when the main applicable array is empty, not simply when the included count is zero. Manually excluded rows can leave a nonempty main list with zero included. |
| Expand/Collapse | Per-item expansion falls back to `allExpanded`. **Expand all / Collapse all** toggles that fallback and clears item expansion overrides. The inapplicable group is a separate native details disclosure; expand-all does not open that group itself. |
| Preview and full wording | Preview is clamped to two lines, including while expanded. Expansion reveals the full resolved paragraph and editor. Wording remains selectable and wraps; the full paragraph is not clamped. |
| Fill fields | Unresolved `{{[a-z_]+}}` tokens become highlighted `________ (key words)` in preview/full text and remain raw tokens in Wording. Expansion shows one **Fill …** input per distinct unresolved key, updating global `draft.placeholderValues[key]`. |
| Placeholder resolution | `contextFromDraft` provides dates, amounts, utilities, occupant and lessor values; placeholder overrides win. Resolution substitutes a trimmed nonblank value or leaves the token. Once a value resolves the token, the source no longer renders its Fill input. Do not silently add a permanent fill-field editor or an unresolved-token validation lock. |
| Title / Wording | Patch `termOverrides[id].title/body` on change. Their initial values are the resolved title/body. Editing resolved wording can retain already-substituted literal values. **Edited** means a title/body override exists or the item is custom, even if text happens to equal the original. Inclusion or placeholder changes alone do not set Edited. |
| + Add clause/rule/disclosure | Generate a `custom-UUID`, set current section, `included: true`, title **New clause/rule/disclosure**, blank body, and expand it immediately. Custom items resolve as nonrequired, Always items. Exclude through Include or discard all overrides through reset; there is no delete control. |
| No selected template | With neither a draft template nor an available first template, resolution produces no terms and Save as new template returns without action. Normal entry ensures a standard template. No new no-template dialog or creation flow is designed. |

### Conditions

These come from `conditionReason` and `contextFromDraft`, not legal validation.

| Condition | Inclusion test |
| --- | --- |
| Always | Always included by the definition |
| Fixed term / Month-to-month | Match `leaseType` |
| Pets allowed or pet fee set | `options` includes `pets-allowed` OR `petDepositEnabled`; this is the enabled flag, not an amount test |
| No pets | Neither pets allowed nor pet fee enabled |
| Assigned parking | `assignedParking` |
| Multi-unit / Single-family | `propertyType` is `MULTI_UNIT` / `SINGLE_UNIT` |
| Tenant pays utilities | Nonempty `tenantUtilities`; reason lists those utilities |
| Built before 1978 | Non-null `yearBuilt < 1978` |
| Balcony or patio / Shared laundry / Flood zone | Their corresponding boolean flags |
| Security deposit set | Numeric `deposit > 0` |

When a condition is false and there is no inclusion override, the reason is **Condition is not met**. Explicit included overrides take precedence over conditions. Legacy tenant-utilities wording without its token uses the source's generated utility sentence; the v2 fixture already has the token and retains its full paragraph.

## State transitions

| Trigger or state | Result and boundary |
| --- | --- |
| Renewal entry | The entry page uses the signed template snapshot, overrides and included items when available; otherwise it falls back to the property default. Prior context also informs pets, parking, utilities and feature flags. Do not assume every current draft field or placeholder value is copied from the old lease. |
| Changed | Only meaningful with a nonempty prior-item array. Compare current inclusion against prior id presence, then current title/resolved body against the matching old item. This is independent of Edited. A newly included, excluded, or text-changed item can be Changed; it is not a legal-change approval state. |
| Re-apply template | Choose the current matching template id, or the first available template. Clear overrides for all three sections. Preserve placeholder values and `renewalTerms`, so comparisons continue after reapplication. |
| Save as new template | One click, no naming dialog. Name is selected name plus ** copy**. The action resolves **all three sections**, includes only currently included items, normalizes order, and retains their condition/required flags and the selected template's default fees. It uses resolved wording, not the user's current fee fields as new template defaults. |
| Template save pending | Component-local `saving` disables its terms fieldset. The button keeps **Save as new template**; source does not supply a new Saving label here. Shell Back/Next/visited steps/Save and exit are not disabled by this local state unless a draft save is also pending. |
| Template save success | **Saved [name] · v[version]** is a status. Select returned template and clear overrides. The parent update marks the lease draft dirty; saving a template is not saving the draft. Conditions are reevaluated without manual overrides, so a manually included false-condition item can become inapplicable again. |
| Template save failure | Preserve draft edits and selection. Surface returned errors (for example **Every template item needs a title and wording.**, **Choose a template first.**, or **The new template could not be loaded.**), fallback **Could not save template.**, or thrown-request message **The template could not be saved. Your draft edits are still here. Try again.** Retry is the same button. |
| Template status lifetime | Status belongs to the step component and is not cleared at request start or by parent draft updates. Preserve source behavior; do not promise new automatic dismissal. Step remount resets local status/expansion. |
| Clauses Next validation | With `draft.template`, require at least one included CLAUSE and a nonblank title/body for every included term across all sections. Exact errors: **Include at least one lease clause.** and **Give each included term a title and wording.** Both write `errors.clauses`, so blank wording wins if both fail. |
| Rules / Disclosures Next | Their validators return no section errors when a template is selected. There is no required-rule/disclosure checkbox lock or unresolved-placeholder check. Clauses and Review & send still perform the included-term checks. |
| Validation presentation | Parent summary **Please fix the highlighted fields.** displays the errors and receives focus. `TemplateTermsStep` is not passed errors, so this design does not claim implemented inline term errors. Template save separately validates template contents through the service. |
| Draft editing | `update` resolves dates, updates the draft ref, marks dirty and clears parent errors/message. Status becomes **Unsaved changes**. Editing does not autosave. |
| Next | Validate current step, then save strictly and advance only on success. The sequence stays **Options → Clauses → Rules → Disclosures → Attachments** within the unchanged ten steps. |
| Back / visited step | `jump` saves non-strictly when a lease id exists, then navigates. Without an id it changes step in memory. Only indices up to `furthest` are visitable; future untouched steps remain noninteractive. |
| Save and exit | Save current step non-strictly, then use `exitHref` (draft list in this specimen). Saving a new draft still needs the source's basic unit/date prerequisites. Header property-back uses `backHref` and is not the save action. |
| Draft save pending | Parent `pending` disables step fields, Back, Next, visited-step buttons and Save and exit. Status and Next show **Saving…**. Property-back remains available. |
| Draft save failure | Keep current step and values. Parent handles returned validation/service errors; thrown request displays **Your changes could not be saved. They are still here; try again.** Retry uses Next or Save and exit. |
| Draft resume | Stored data restores template, overrides, placeholder values, current step and furthest step. Clean saved drafts show **Draft saved**; no-id untouched drafts show **Not saved yet**. Local expansion/template feedback is not persisted. |
| Signed wording | `createTermsSnapshot` copies definition, context, included terms and overrides. Later template changes do not replace the lease's saved wording. Keep the source reminder below Add. |

## Layout, keyboard intent and implementation boundary

Desktop retains the 208px step rail and single readable form column. Phone stacks template actions, uses 44px controls and 16px field text, and keeps footer actions in document flow. Long full paragraphs and token names wrap; wording areas have useful initial height and remain vertically resizable. A wrapping readout below carried-version selects exposes the entire name/version/status when the native select clips its display.

Use the approved 24×24, 1.7-stroke round-cap lease/back/next/check SVG family. Inherit the cobalt focus ring, reduced-motion and forced-colors rules; extend the focus ring to textareas. Keep explicit field labels, distinct Include accessible names, status/alert roles, and the focusable step heading/error summary. Source step changes focus the heading and scroll the current step into view; the static phone rail remains horizontally scrollable. Do not reorder the ten steps to make a screenshot.

Native `details/summary` provides the static term expansion specimen. Implementation should retain the component's button with `aria-expanded`/`aria-controls` and its existing expansion state. The static prototype does not execute include/placeholder/reset/save actions or synchronize Expand all; `data-action` attributes document source bindings only. Supporting panels must not ship as product content.

Internal **Clauses ↔ Rules ↔ Disclosures** links use matching desktop or `-phone` screen IDs. Options and Attachments are cross-design boundaries represented by the existing labeled buttons and destination/step metadata, rather than unresolved local-screen hyperlinks. Earlier visited steps are represented as source jump actions. Their implementation wiring remains in LeaseBuilder.

No runtime/source change, legal determination, new validation, dialog, deletion/reordering capability, desktop acquisition, application test run, Preview publication, push or deployment is part of this result.

## Inspection evidence

| Check | Observed result |
| --- | --- |
| Final native design renders | Passed: `design_screenshot` revision **13**, all six IDs above, at native **1280px / 390px** widths. Inspected header/rail, fields, expanded long wording, count/conditions, inactive groups, actions, footer and upper support panels. No control overlap or unintended horizontal content overflow was visible. |
| Lower phone panels | Passed: configured Playwright screenshots at 390px, with a taller viewport for complete element captures. Inspected every editing, empty, renewal, template-result, draft-pending and draft-failure panel for all three steps. A clipped carried-over select label was corrected with the full wrapping readout and re-inspected on all three phone screens. Initial too-short viewport capture was replaced. |
| Canonical static checks | Passed: **65 assertions** on revision-13 HTML/CSS: unique IDs, resolved label/ARIA references, matching-device existing links, all ten steps and single current state, six separate support panels, editable required checkboxes, preserved main markup, full carried label, no invented destructive controls/scripts, pending/failure coverage, desktop/phone content parity and inherited CSS/focus sizing. Initial checker overmatching of `data-term-id` and `lw-phone-hint` was corrected; final failures: zero. |
| Supplemental desktop state inspection | Viewed the complete lower desktop reference grids through browser captures. Required fixed-width evidence comes from the native 1280px design renders; browser viewport resets made those supplemental width measurements unreliable. |
| Browser interaction | Inconclusive. Scripted layout evaluation and a bounded click/keyboard sequence stalled; the design console reported sandboxed script execution blocked. Later calls intermittently returned `MCP_SESSION_NOT_FOUND`; fresh navigation restored screenshot reads. No keyboard, dynamic navigation, action persistence or live application-flow pass is claimed. |
| Scope | Only this handoff is committed. App source/runtime and the other Tasks' files were preserved. No application test suite was run for this static design change. Git whitespace, file links, scope and commit identity are recorded in the typed completion. |

The completion attaches these existing, workspace-relative lower-phone evidence files; they are evidence artifacts, not repository implementation files:

| Screen | Editing / empty / saving | Renewal / template result / failure |
| --- | --- | --- |
| Clauses phone | `.playwright-mcp/terms-clauses-phone-editing-r7.png`; `.playwright-mcp/terms-clauses-phone-empty-r7.png`; `.playwright-mcp/terms-clauses-phone-saving-r7.png` | `.playwright-mcp/terms-clauses-phone-renewal-r13.png`; `.playwright-mcp/terms-clauses-phone-template-r13.png`; `.playwright-mcp/terms-clauses-phone-failure-r13.png` |
| Rules phone | `.playwright-mcp/terms-rules-phone-editing-r13.png`; `.playwright-mcp/terms-rules-phone-empty-r13.png`; `.playwright-mcp/terms-rules-phone-saving-r13.png` | `.playwright-mcp/terms-rules-phone-renewal-r13.png`; `.playwright-mcp/terms-rules-phone-template-r13.png`; `.playwright-mcp/terms-rules-phone-failure-r13.png` |
| Disclosures phone | `.playwright-mcp/terms-disclosures-phone-editing-r13.png`; `.playwright-mcp/terms-disclosures-phone-empty-r13.png`; `.playwright-mcp/terms-disclosures-phone-saving-r13.png` | `.playwright-mcp/terms-disclosures-phone-renewal-r13.png`; `.playwright-mcp/terms-disclosures-phone-template-r13.png`; `.playwright-mcp/terms-disclosures-phone-failure-r13.png` |

The three reused revision-7 Clauses panels are unchanged in revision 13. Consume the exact handoff commit in the typed submission and design revision 13. A submitted Git candidate, integration into Code, design review/acceptance and Preview publication are separate states; this document does not claim application implementation or delivery beyond the observed submission.
