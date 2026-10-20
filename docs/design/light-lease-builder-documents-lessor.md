# Light lease builder: Attachments and Lessor info

Completed **Design light lease attachments and lessor screens** in `Designs/rocketrental-light-lease-documents`, **revision 5**. This is a static design and source-linked handoff, not an application implementation.

| Screen ID | Native width | Main specimen | Lower state panels |
| --- | --- | --- | --- |
| `attachments` | 1280px | Two uploaded documents, including a long filename | Empty/no lease; upload lifecycle; file validation; type saving/failure; removal; draft saving/failure/resume |
| `attachments-phone` | 390px | Same content, with stacked file controls | Same six panels |
| `lessor` | 1280px | Lessor name, phone, mailing address and email | Validation; blank optional contacts; saving; failure; saved draft/renewal context |
| `lessor-phone` | 390px | Same fields in one column | Same five panels |

The design extends the revision-1 starting screens, `Designs/rocketrental-light-lease-terms` revision **13**, `Designs/rocketrental-light-lease-people-options` revision **10**, and `Designs/rocketrental-light-system` revision **7**. It retains the cobalt/teal light palette, Inter body text, Space Grotesk headings, 8px spacing rhythm and 12px surfaces. Names, contacts and file examples are fictional.

`Diagrams/rocketrental-mindmap` revision **4** supplies `f-leasing-1` (create leases), `f-leasing-2` (edit/renew/terminate context; this task covers draft editing/resume), and `c-ux` (accessible, mobile-friendly use). Its broader document capabilities do not add controls to this wizard.

The finished [terms handoff](light-lease-builder-terms.md) at **90a7d8ac1ffa3959f1a641bb9dd3db58c4e58c94** is present in this checkout's ancestry and unchanged from that commit.

## Source and behavior mapping

Primary sources are [AttachmentsStep and LessorStep](../../src/components/lease-builder/steps.tsx#L749), [FileUploader](../../src/components/upload/FileUploader.tsx), [LeaseBuilder](../../src/components/lease-builder/LeaseBuilder.tsx), [step definitions](../../src/lib/lease-create/types.ts#L3), [validation](../../src/lib/lease-create/validation.ts#L177), [draft persistence](../../src/lib/lease-create/drafts.ts), and the [entry page](../../src/app/(manager)/leases/new/page.tsx). Source was inspected at task base `a096032b6fb6bea4ae869bcbf56e365c23b5ead5`.

### Attachments

| Trigger/state | Existing behavior to preserve |
| --- | --- |
| No lease ID | Show **Save the lease term first, then add documents here.** The uploader is absent. No new save button or file staging flow is added. |
| Saved lease, no files | Show **Documents to include**, the source's empty guidance and Browse files/drop area. Empty guidance depends on the parent's stored-file array, so it can remain while only queued/failed local items exist. |
| Browse/drop | Accept multiple files; validate each, append rejected and accepted rows, announce selection and immediately start accepted uploads. There is no separate Upload confirmation. |
| Upload transport | XHR `POST /api/files` sends multipart `file`, `targetType=lease`, lease ID and `kind=LEASE`. This is direct storage on the lease, independent of Next/Save and exit. See [transport](../../src/components/upload/FileUploader.tsx#L134) and [POST route](../../src/app/api/files/route.ts). |
| Selected/progress | **1 file selected.** is a polite announcement. **Queued** is transient; **Uploading N%** uses XHR progress with a named progress element. A transmitted 100% does not itself establish successful storage. |
| Success | Row becomes **Uploaded**; announce **[filename] uploaded.** Only a done item with a returned document ID gets a type selector. Parent receives a `LEASE` file; no draft-dirty update occurs. |
| Failure/retry | Keep the row, **Failed**, returned error or **The file could not be uploaded.**, Retry and Remove. Retry revalidates the same File before sending; invalid metadata cannot be repaired by retrying. |
| Document type | Four choices: **Lease agreement / Addendum / Disclosure / Other**, mapping to `LEASE / ADDENDUM / DISCLOSURE / OTHER`. `PATCH /api/files/[id]` sends `{kind}`; update the parent's kind only on success. [PATCH handler](../../src/app/api/files/[id]/route.ts) restricts this to existing organization-scoped, non-photo lease documents. |
| Type pending | `savingType !== null` disables **all** rendered type selectors. Keep the previously saved selection; no new Saving label or success banner is supplied. Browse, Remove and wizard navigation remain available unless parent draft saving is also pending. |
| Type failure | HTTP failure: **The type for [filename] could not be saved. Please try again.** Thrown request: **The type for [filename] could not be saved. Check your connection and try again.** The saved value remains; choose the intended type again to retry. Starting another type change clears this error. |
| Remove | Stored items call `DELETE /api/files/[id]`; success or 404 removes the parent/local item and announces **[filename] removed.** Local items without a document ID are removed locally. No confirmation dialog, undo, or removal-specific pending indicator exists. |
| Removal failure | Keep the item and show **The file could not be removed.**, or the thrown network error, in the uploader alert. Retry uses Remove. The alert is not automatically cleared by success; selecting files clears it. |
| In-flight removal | Remove remains available during upload and does **not** abort XHR. A later completion can still create a stored file. Do not invent cancellation, queue persistence, or a navigation interlock. |
| File presentation | Filename wraps without truncation. File-type icons are noninteractive. The existing uploader may show a local image thumbnail/fallback; that is not an open-preview action. Document mode has no cover, reorder, download or preview action. |

File limits come from [storage types](../../src/lib/storage/types.ts) and [metadata/body validation](../../src/lib/storage/validation.ts), enforced again by the [storage service](../../src/lib/storage/service.ts):

- Extensions: `.pdf`, `.doc`, `.docx`, `.jpg`, `.jpeg`, `.png`, `.heic`, `.heif`. Hint: **PDF, JPG, PNG, HEIC or Word · up to 25 MB each**.
- Maximum **26,214,400 bytes** per file; empty files are rejected. This document uploader has no configured file-count maximum or photo counter.
- Concrete MIME/extension mismatches are rejected; empty or generic MIME lets the extension govern. Server validation also checks body length and file signatures/container structure.
- The error specimens retain the source messages, including **File exceeds the 25 MB limit (26214400 bytes)** and **File type ".zip" is not allowed**. Other failures include **File is empty** and **File content does not match its extension**.
- Stored names are sanitized and capped at 180 characters. A selected row can still show its original local name until reload; the long-name layout must accommodate both.

### Lessor info

| Field/state | Existing behavior to preserve |
| --- | --- |
| Lessor name | `draft.lessorName`; trimmed nonblank value required on Next. Error: **Enter the lessor’s name.** |
| Mailing address | `draft.lessorAddress`; trimmed nonblank value required on Next. Error: **Enter the lessor’s address.** Keep the existing single text input. |
| Phone (optional) | `draft.lessorPhone`; may be blank. No phone formatting or validation rule is implemented. |
| Email (optional) | `draft.lessorEmail`, email input; blank is valid. A trimmed nonblank value must match the source email regex. Error: **Enter a valid email address.** |
| Validation | Parent summary **Please fix the highlighted fields.** receives focus. The shared Field wrapper provides inline errors, `aria-invalid` and description associations. Next stays on this step when invalid. |
| Editing | `update` marks the draft dirty and clears parent errors/message. No autosave. Initial new-lease name/address use organization/property values; optional contacts default blank. Saved drafts restore their four persisted values. |
| Renewal | The saved renewal draft can restore lessor values. Do not assume a brand-new renewal copies old lessor contacts or attachments; the resume panel does not promise that behavior. |

## Navigation, draft saving and accessibility

The ten-step sequence stays **Lease term → Rent, deposit & fees → Tenants → Options → Clauses → Rules → Disclosures → Attachments → Lessor info → Review & send**. Next from Attachments reaches Lessor info; Back from Lessor info reaches Attachments. Cross-design Disclosures and Review & send boundaries are labeled buttons with destination metadata. Within this design, links use matching desktop or `-phone` IDs.

| Action/state | Source contract |
| --- | --- |
| Next | Validate the current step, save strictly, then advance only on success. Attachments adds no local required-file validation. Lessor validation also participates in Review & send. Strict server saves can still return other source errors. |
| Back/visited step | With an existing lease ID, save non-strictly before changing step. Without an ID, change the in-memory step. Only indices through `furthest` are visitable. Future untouched steps are noninteractive. |
| Save and exit | Save the current step non-strictly, then navigate to `exitHref`. New draft creation still needs basic unit/date prerequisites. Header property-back uses `backHref` and is a separate navigation action. See [actions](../../src/app/(manager)/leases/new/actions.ts#L64). |
| Draft pending | Status and Next show **Saving…**. Native step controls, visited-step buttons, Back, Next and Save and exit are disabled. Property-back stays available. This does not cancel existing file requests; the source drop handlers are not separately gated by pending. |
| Draft save failure | Keep the current step and values. Preserve returned validation/service messages; thrown requests show **Your changes could not be saved. They are still here; try again.** Retry the same action. |
| Draft status | **Not saved yet**, **Unsaved changes**, **Saving…**, **Draft saved** reflect parent draft state. Upload/type/removal callbacks do not mark the draft dirty or hold Next; a saved badge can coexist with an upload error. |
| Resume | Restore saved draft, current step and furthest step. Entry queries stored non-photo documents for this lease in creation order; unrecognized non-photo kinds display as Other. Local queued files, progress and errors are not persisted. |

Desktop keeps the reviewed 208px rail. Phone uses the scrollable ten-step rail, 44px controls, 16px input/select text and an in-flow footer. Long filenames and error text wrap; phone file actions stack. The approved 24×24, 1.7-stroke, round-cap SVG family supplies back/next/check/document icons. Focus-visible, reduced-motion and forced-colors rules are inherited.

Implementation should retain LeaseBuilder's focusable heading/error summary and current-step scroll intent. The static phone rail starts at its natural scroll position; it does not execute automatic current-step scrolling. Native labels and status/alert roles are design references. Static buttons and `data-action` metadata do not execute source handlers, and the lower reference panels must not ship as product content.

## Verification and implementation boundary

| Check | Observed result |
| --- | --- |
| Native final renders | Passed: `design_screenshot`, revision **5**, all four IDs at native **1280px / 390px** widths. Main form, long filename, step rail, labels, navigation and desktop supporting grids inspected. No visible control overlap. |
| Lower supporting states | Passed: all six Attachments phone panels inspected individually; the complete Lessor phone page and all five lower panels inspected, including final resume. The complete desktop Attachments draft panel was captured separately to check the native render's lower edge. |
| Canonical HTML/CSS checks | Passed: **76 checks** against saved revision 5, covering unique IDs, resolved label/ARIA references, ten steps/one current step, matching-device links, exact fields/errors, file states and limits, pending controls, all lower panels, no invented file actions/scripts, wrapping and inherited focus/mobile CSS. Save normalization only changed whitespace and removed a CSS comment; the checker was adjusted for that normalization. |
| Browser limitation | Layout evaluation and a browser-code attempt stalled and were terminated. Intermittent `MCP_SESSION_NOT_FOUND` errors required fresh navigation before screenshot reads recovered. No computed-overflow, keyboard, dynamic navigation, upload, PATCH, DELETE or draft-persistence pass is claimed. The observed console error was a missing favicon. Fixed-width evidence is the native design renders; browser captures supplement lower-state inspection. |
| Source scope | Only this handoff is committed. App files, fixture/runtime, prior handoffs and other designs are unchanged. No application suite was run for this static design; no merge, push, Preview publication or deployment is included. |

Supporting evidence files are attached by the typed completion and remain outside implementation scope:

| View | Workspace-relative evidence |
| --- | --- |
| Attachments phone main | `.playwright-mcp/documents-attachments-phone-main-r5.png` |
| Empty / upload / file validation | `.playwright-mcp/documents-attachments-phone-empty-r5.png`; `.playwright-mcp/documents-attachments-phone-upload-r5.png`; `.playwright-mcp/documents-attachments-phone-validation-r5.png` |
| Type / removal / draft states | `.playwright-mcp/documents-attachments-phone-type-r5.png`; `.playwright-mcp/documents-attachments-phone-removal-r5.png`; `.playwright-mcp/documents-attachments-phone-draft-r5.png` |
| Lessor phone complete / validation / resume | `.playwright-mcp/documents-lessor-phone-full-r5.png`; `.playwright-mcp/documents-lessor-phone-validation-r5.png`; `.playwright-mcp/documents-lessor-phone-resume-r5.png` |
| Desktop Attachments lower draft states | `.playwright-mcp/documents-attachments-desktop-draft-r5.png` |

Consume design revision **5** and the exact handoff commit recorded in the typed submission. A submitted Git candidate, integration into Code, design acceptance and Preview publication are separate outcomes.
