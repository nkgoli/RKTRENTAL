# Light lease builder — review and signing

The final review and mock-signing references are finished in **Designs/rocketrental-light-lease-review, revision 5**. They preserve the ten-step light wizard and distinguish active leases, signing-provider outcomes and stored signed documents.

This is a design and implementation handoff. No application implementation, database operation, real email, actual signing, deployment, merge or push was performed.

## Coordinates and scope

- Task: **Design light lease review and signing screens**.
- Retained source baseline inspected: `5632094d41d499697f71b0128dd63a9d3e492547`; verified as the assigned checkout HEAD before work and as an ancestor before submission.
- Only committed path: `docs/design/light-lease-builder-review-send.md`. The exact handoff commit is supplied by the completion report; screenshots are separate workspace evidence.
- Final design screens: `review` (1280 px), `review-phone` (390 px), `signing` (1280 px), `signing-phone` (390 px), all at **revision 5**.
- Continuity references read: `Designs/rocketrental-light-lease-documents` r5 (lessor), `Designs/rocketrental-light-lease-terms` r13 (clauses), `Designs/rocketrental-light-lease-builder` r14 (rent), and review/signing starters r1.
- `Diagrams/rocketrental-mindmap` r4: `f-leasing-1` → final creation/charges; `f-leasing-2` → renewal context; `f-leasing-3` → e-signature; `f-docs-1` → stored signed lease. These nodes contain no file references; the source files below supply the behavior.

The design retains primary `#3159d9`, background `#f7f9fc`, surface `#ffffff`, text `#17243b`, muted `#58687e`, accent `#087c91` and danger `#b4233e`, Inter body text, Space Grotesk headings, 12 px corners and the 8 px spacing basis. Additive review styles preserve the preceding designs' stylesheet.

## Flow, navigation and presentation

The steps remain in [WIZARD_STEPS order](../../src/lib/lease-create/types.ts#L3): Lease term; Rent, deposit & fees; Tenants; Options; Clauses; Rules; Disclosures; Attachments; Lessor info; Review & send. Review is zero-based step 9, with all nine earlier steps visited.

| Control | Source action / destination | Static design behavior |
| --- | --- | --- |
| Back | `jump(8)`, saves the existing draft non-strictly | `data-destination="lessor"` / `lessor-phone`; preceding design owns the screen |
| Visited step | `jump(index)`, then `save(step, index, false)` | All ten labels remain; earlier buttons carry matching step/destination metadata |
| Save and exit | `save(step, step, false)`, then `/leases?tab=drafts` | Illustrated button; exits only after save success in the implementation |
| Property back | `props.backHref`, currently `/properties/[propertyId]/leases` | Illustrated route button; source leaves it available during pending/created states |
| Send for e-signature | `send()` → `sendWizardLeaseAction` | `screen:signing` from desktop; `screen:signing-phone` from phone |
| Return to review reference | Design navigation only, outside product panel | `screen:review` / `screen:review-phone`; never an edit action on an active lease |
| View lease detail | `/leases/[leaseId]` | Illustrated route button, not a live-record link |
| Complete mock signing | `completeSigningAction` with hidden leaseId | Illustrated action; no signing occurs in the design |

[LeaseBuilder save/navigation](../../src/components/lease-builder/LeaseBuilder.tsx#L115) and [page destinations](../../src/app/%28manager%29/leases/new/page.tsx#L207) are authoritative. Cross-design steps are metadata-backed handoff controls, not fabricated same-design links. Only the review/signing screen pairs have executable design links.

At 1280 px the summary sits beside a 208 px stepper. At 390 px labels and values stack, amounts stay readable, all controls have a 44 px minimum height, filenames wrap without ellipsis, and the horizontal stepper initially exposes Lessor info and Review & send. It retains all ten items in source order. Footers remain in normal flow; no sticky controls cover content. Semantic headings, definition lists, an accessible step navigation label, `aria-current="step"`, a skip link, focus-visible outlines, disabled pending controls, alert/status regions and reduced-motion/forced-color styles are retained.

All supporting panels are under a separate, initially expanded **Supporting states** disclosure after the product panel. They are explicitly marked static references for mutually exclusive conditions. Source explanations, discrepancies, reference links and recovery specifications belong there and in this document, not in production product copy. The current design has no scripts.

## Summary and charge mapping

[ReviewStep](../../src/components/lease-builder/steps.tsx#L896) displays:

| Summary section | Source and rendering rule |
| --- | --- |
| Lease | Unit label; selected tenant names; `termLabel(draft)`; month-to-month suffix when applicable; renewal notice days |
| Rent, deposit & fees | Monthly rent and ordinal due day; deposit; enabled move-in and pet deposits; enabled late fee/grace rule or None; `dueAtSigning` |
| Scheduled charges | [ChargesPreview](../../src/components/lease-builder/steps.tsx#L275) uses `previewScheduledCharges`; move-in rows/total, first monthly date, last month and monthly count |
| Terms | Option labels; only included resolved template titles for CLAUSE/RULE/DISCLOSURE, or legacy label helpers when no template exists; uploaded attachment names |
| Lessor and signature | Lessor name and optional address; Electronic · mock provider · primary tenant name |

Empty optional lists show **None**; unselected tenants show **Not selected**; missing money, dates or lessor name use **—**. Zero is not treated as a missing amount. The long filename fixture is plain text, not a download control. Attachment names are taken from uploaded file records, not an invented packet-generation capability.

The review fixture follows the r14 Rent example: May 15, 2027–May 14, 2028; $1,850 monthly, due on the 5th; $1,850 deposit; $150 move-in fee; $250 pet deposit; $50 late fee after five grace days. With proration enabled, May 15–June 4 is 21 of 31 days:

- Prorated rent: round(185000 × 21 / 31) = 125323 cents = **$1,253.23**.
- Setup total / this fixture's Due at signing: 125323 + 185000 + 15000 + 25000 = 350323 cents = **$3,503.23**.
- Twelve full monthly charges run June 5, 2027–May 5, 2028, at **$1,850** each; late fees are conditional.
- [feesFromDraft](../../src/lib/lease-create/fees.ts#L12), [proration/setup planning](../../src/lib/ledger/lease-setup.ts#L61), [monthly preview](../../src/lib/ledger/lease-setup.ts#L145) and [dueAtSigning](../../src/lib/lease-create/validation.ts#L285) govern the numbers. The preview's `asOf` excludes past rent months; these dates are future relative to this review.
- The starter's $3,700 “Move-in charges” simplification has been replaced by actual setup rows and the separate recurring row. No payment is collected by this design or by the e-signature action.

Term titles use the preceding template design's title conventions. They are illustrative draft selections, not a claim that the r13 template fixture, r14 rent fixture and review are one persisted database record. Review shows titles, not full clause wording. Full wording remains in the terms steps and activation's terms snapshot.

## Validation, saving and sending

| Design state ID (both review screens) | Source / trigger | Display and permitted recovery |
| --- | --- | --- |
| `review-validation` | [validateReview](../../src/lib/lease-create/validation.ts#L193), [send local validation](../../src/components/lease-builder/LeaseBuilder.tsx#L175) | “Please fix the highlighted fields.” plus exact field messages; focus summary; use visited stepper to correct fields or Save and exit |
| `review-sending` | Shared `pending` transition during send | Summary stays visible; Back, visited steps, Save and exit and send disabled; Sending… CTA; no repeated send |
| `review-saving` | [save / jump / saveAndExit](../../src/components/lease-builder/LeaseBuilder.tsx#L115) | Non-strict save of existing draft; Saving… badge, disabled controls; keep current step until success |
| `review-save-error` | Returned save error or caught save exception | Retain values/current step; exact fallback “Your changes could not be saved. They are still here; try again.”; retry same save action |
| `review-service-error` | [activation validation and overlap](../../src/lib/lease-create/drafts.ts#L369), LeaseServiceError | Preserve returned message; overlap maps to startDate/Lease term; no-longer-open draft requires status inspection |
| `review-uncertain` | [send catch](../../src/components/lease-builder/LeaseBuilder.tsx#L195) | Exact warning “We could not confirm that the lease was sent. Check its status before trying again.”; outcome unknown, proposed direct lease-detail recovery and disabled resend |
| `review-resume` | Saved DRAFT snapshot or saved renewal | Restore step 10, draft, attachments, furthest step and renewal context |
| `review-long-empty` | Long or optional values; alternate term | Wrap full values; source empty labels; month-to-month shows the end of its start month, custom uses the entered date |

Final review combines unit/tenants, dates, rent/fees, clauses/documents, options, rules, disclosures and lessor validation. [Validation functions](../../src/lib/lease-create/validation.ts#L72) require a primary selected tenant, at least one included clause, valid dates and rent, lessor name/address, and a valid lessor email only when nonblank. Template items need nonempty titles and bodies; unresolved placeholder tokens are not an extra final-review validator in this source.

Return-to-step mapping: dates/overlap → Lease term; rent/deposit/fees → Rent; tenant selection/primary email → Tenants; renewal notice/options/occupants → Options; clause/term wording errors → Clauses; legacy rules/disclosures → their steps; document-name errors → Attachments; lessor fields → Lessor info. The source uses its existing stepper, not clickable error links. The supporting validation card's step buttons illustrate those stepper actions.

The primary tenant's missing email is checked before activation; **the provider requires every tenant's email**. A non-primary missing email can therefore produce the active-but-not-sent state. The mock provider additionally checks that signer emails contain @. The design does not promise stricter validation than the source provides.

### Activation and provider boundary

[sendWizardLeaseAction](../../src/app/%28manager%29/leases/new/actions.ts#L94) runs these operations in order:

1. Save the current draft at Review, non-strictly.
2. Activate the draft in a separate transaction: validate all fields, verify renewal source when present, lock/check the unit for overlapping active dates, store terms snapshot/version, update tenants, set lease ACTIVE, mark the unit OCCUPIED only for a new lease, and ensure setup charges once.
3. Call [sendLeaseForSignature](../../src/lib/esign/service.ts#L29). It checks all tenants, obtains the mock envelope, updates eSignStatus to SENT and records events.
4. Return a created result. A caught **EsignError** from sending returns `ok: true`, leaseId and **NOT_SENT** because activation already succeeded. Other errors can escape to the uncertain-outcome warning.

Setup-charge de-duplication uses deterministic descriptions and transaction locking in [ensureSetupCharges](../../src/lib/ledger/lease-setup.ts#L193). It does not authorize blind resend after a transport, event-recording or other unexpected failure. Neither a thrown response nor NOT_SENT means activation rolled back.

## Signing result and stored PDF

| Design state ID (both signing screens) | Source / condition | UI and actions |
| --- | --- | --- |
| Main product panel | Returned created result with SENT | Lease active; E-signature status SENT; signed PDF waiting; View lease detail and Complete mock signing; explicit no-real-email copy |
| `sign-not-sent` | Caught EsignError after activation | Warning treatment; lease Active and signing NOT_SENT; actual returned error; View lease detail only; no mock-signing or wizard-resend control |
| `sign-pending` | Separate `signing` flag from useActionState | Last confirmed SENT, Signing… disabled, no PDF success; lease detail remains available |
| `sign-error` | Returned EsignError from completeSigningAction | Actual error message; previous SENT status retained; same available signing action and lease detail; no storage-success claim |
| `sign-uncertain` | Unexpected mock-signing exception | Proposed inline recovery; check signing status **and documents** before retry; source currently rethrows these errors |
| `sign-complete` | Successful completeSigningAction including storage | SIGNED and **Signed lease agreement.pdf** stored as a lease document; View lease detail; signing action gone |
| `sign-renewal` | Created renewal result | Same SENT/NOT_SENT/uncertain distinctions for the renewal lease; retain renewal heading/context |

[completeSigningAction](../../src/app/%28manager%29/leases/new/actions.ts#L143) calls [completeMockSigning](../../src/lib/esign/service.ts#L174). The mock simulates every signer; it requires sandbox mode and sends no network email. The [mock implementation](../../src/lib/esign/mock.ts#L18) stores deterministic envelopes in process memory.

The [signed callback](../../src/lib/esign/service.ts#L99) changes the provider envelope first, then loads the lease, uploads **Signed lease agreement.pdf** as kind LEASE when no same-named document exists, records signing/completion events, and updates database SIGNED/signedAt. A later storage/database failure can leave provider status ahead of the database or document state. A same-named existing document is the source's duplicate check; the design does not certify file contents or make an independent integrity claim.

[getLeaseSignStatus](../../src/lib/esign/service.ts#L77) prefers the provider envelope and otherwise reads the stored lease status. [signingStatusAction](../../src/app/%28manager%29/leases/new/actions.ts#L167) exists but is not wired into LeaseBuilder. Its status string alone is insufficient evidence that a signed PDF was stored. Display storage success after the successful completion action or a verified stored-document result, not merely a provider SIGNED response. An uploaded **Lease agreement.pdf** is a separate document.

No in-wizard PDF download/preview, real-provider invitation, email receipt, signer completion percentage or resend capability is invented.

## Draft and renewal continuity

[loadLeaseDraft](../../src/lib/lease-create/drafts.ts#L106) reads only DRAFT rows and restores stored draft data, current step, furthest step and renewId. Legacy drafts without wizard state rebuild at step 0. [findOpenDraft](../../src/lib/lease-create/drafts.ts#L165) resumes the newest matching open unit/renewal draft. [NewLeasePage](../../src/app/%28manager%29/leases/new/page.tsx#L63) redirects an activated `?draft=` record to lease detail. Reopening it must not start another send.

[renewalDefaults](../../src/lib/lease-create/service.ts#L139) carries source unit, tenants/primary, next-year dates, rent/deposit/late fee/grace and due day. [Renewal page initialization](../../src/app/%28manager%29/leases/new/page.tsx#L120) additionally carries signed template/overrides/terms and relevant conditions; a saved snapshot takes precedence. New renewal contacts and attachments are not promised to copy. Saved attachments reload from that draft's non-photo documents.

Server activation requires an active renewal source and a start after the current lease end, performs overlap checking and records events on both leases. It does not terminate the old lease or skip validation, snapshotting, charges or signing. The source uses “Renew a lease”, “Renewal” and “Renew lease” while preserving all ten steps.

## Explicit implementation discrepancies

These are design handoff requirements or source limitations, not completed application fixes:

1. **Misleading created badge:** LeaseBuilder renders “Lease sent” for every `sent.ok && leaseId`, including NOT_SENT. Use neutral **Lease active** and separate **E-signature status**. Source labels the latter “Lease status”, although ACTIVE is a different field.
2. **Message treatment:** the created branch uses success styling even for NOT_SENT and returned mock-signing errors. Use the warning/error treatments shown here.
3. **Uncertain send recovery:** source warns to check status but re-enables Send after the transition and lacks a direct recovery action. The design disables blind resend and provides View lease detail. Do not implement an automatic resend as a substitute for status inspection.
4. **Unexpected signing failure:** source catches only EsignError; other failures rethrow. The `sign-uncertain` card proposes inline recovery. Check both status and file storage; a provider envelope is not document evidence.
5. **Pending labels:** one transition flag currently says Saving… in the intro while the review CTA says Sending… even for a draft save. The sending reference proposes an accurate Sending… badge; the saving reference documents the current CTA discrepancy. An implementation needs operation-specific copy.
6. **Summary coverage:** ReviewStep omits returned-payment/key fees, occupants, separate lessor phone/email and full term wording. It shows only options labels and included term titles, not every condition field. This design preserves that scope rather than asserting a complete legal packet review.
7. **Due-at-signing edge case:** when proration is off, `dueAtSigning` adds a full month's rent even though the move-in preview can contain only deposits/fees and first full rent is due later. Do not equate those totals across all inputs. This fixture has proration enabled, so its displayed total agrees with the setup rows.
8. **Mock email and primary label:** source review copy says “emails the signer” before its no-real-email qualification, and the signature summary names the primary tenant although all lease tenants become signers. The design removes the email implication and explains the all-tenant mock completion.
9. **Historical memory:** the older note that rent due day is fixed to the 1st is superseded by inspected source supporting days 1–28. No historical test result was reused as current live acceptance.

## Verification and capture references

Observed: four `design_screenshot` renders at revision 5; all ten step labels and exactly one current step per screen; correct same-device review/signing link destinations; supported-state separation; readable long summary values; static pending/error/result treatments; no observed overlapping controls. Playwright opened the exact private design targets at 1280 × 900 and 390 × 844 and captured full pages and lower state panels. Private target URLs are deliberately not persisted here.

| Screen / inspected region | Exact workspace capture |
| --- | --- |
| Review desktop, full page | [.playwright-mcp/lease-review-r5-desktop-full.png](../../.playwright-mcp/lease-review-r5-desktop-full.png) |
| Review desktop, all eight supporting states | [.playwright-mcp/lease-review-r5-desktop-states.png](../../.playwright-mcp/lease-review-r5-desktop-states.png) |
| Review phone, full page | [.playwright-mcp/lease-review-r5-phone-full.png](../../.playwright-mcp/lease-review-r5-phone-full.png) |
| Review phone, uncertain send | [.playwright-mcp/lease-review-r5-phone-uncertain.png](../../.playwright-mcp/lease-review-r5-phone-uncertain.png) |
| Review phone, saved draft/renewal | [.playwright-mcp/lease-review-r5-phone-resume.png](../../.playwright-mcp/lease-review-r5-phone-resume.png) |
| Signing desktop, full page | [.playwright-mcp/lease-signing-r5-desktop-full.png](../../.playwright-mcp/lease-signing-r5-desktop-full.png) |
| Signing desktop, all six supporting states | [.playwright-mcp/lease-signing-r5-desktop-states.png](../../.playwright-mcp/lease-signing-r5-desktop-states.png) |
| Signing phone, full page | [.playwright-mcp/lease-signing-r5-phone-full.png](../../.playwright-mcp/lease-signing-r5-phone-full.png) |
| Signing phone, uncertain mock signing | [.playwright-mcp/lease-signing-r5-phone-uncertain.png](../../.playwright-mcp/lease-signing-r5-phone-uncertain.png) |
| Signing phone, renewal result | [.playwright-mcp/lease-signing-r5-phone-renewal.png](../../.playwright-mcp/lease-signing-r5-phone-renewal.png) |

The captures are attached workspace evidence, not committed application assets. The full phone design renderer image is height-limited; separate lower-state captures and full Playwright captures address that limit.

Static link mapping was verified from saved design markup and browser snapshots. Click/evaluate automation encountered Playwright MCP session loss/timeouts, so no successful click-flow, automated overflow audit or keyboard interaction claim is made. Fresh navigation, semantic snapshots and screenshots succeeded. This does not establish live application acceptance.

No application build, lint, unit suite, database integration test or live send/sign operation was run. Those are outside this design-only change and the Task explicitly excludes repeating other Tasks' successful tests. The documentation is checked with `git diff --check`, local source/capture link existence and a path-limited commit inspection.
