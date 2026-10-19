# Light property and unit overviews handoff

Implements **Implement light property and unit overviews** from Designs/rocketrental-light-portfolio revision 24 (`property-detail`, `property-detail-phone`, `unit-detail`, `unit-detail-phone`), using the dashboard predecessor's foundation and shared controls. No business logic, calculations, routes, identities, filters, access controls, or persistence behavior were changed.

## What changed

- **Workspace chrome** (`Workspace.module.css`, `WorkspaceHeader.tsx`): title and status/type badges now share one row at 34px (28px on phone), the address sits below at 13px, the cover uses the design's 140px tinted tile (64px on phone), tabs use 20px gaps with 44px targets, and the unit switcher is a labelled field with a 260px select (full-width, 44px, 16px text on phone). No `Edit property` header action was added; editing remains in the Property details card, as before.
- **Property overview** (`WorkspaceOverview.tsx`): a "Property at a glance" band now leads with real occupancy (occupied / active units, computed from the supplied record) beside the existing Payments this month strip (same paid/due/outstanding figures and progressbar semantics), followed by the lease timeline, units, Property details / Next steps pair, and Photos & documents. Tenant cells show initials marks; phone widths (≤640px) swap the units table for unit cards with the same unit, tenant, rent, status, and canonical `/properties/{id}?unit={unitId}` links. The 20-row pagination is unchanged.
- **Unit overview**: same order and content as before (timeline with lease summary, payments, Unit facts / Next steps, media); vacant and occupied states, inline facts editing, and next-step links are untouched apart from styling.
- **Lease timeline** (`LeaseTimeline.module.css`): segment colors now use the foundation tokens (current = primary, next = teal accent, draft/vacant = dashed warning tint, past = line color), the today marker is a dark rule with a surface halo, rows use the design's 44px label column, and phone rows keep 44px tracks. Segment geometry, expansion ("Show all"), and lease/unit links are unchanged.
- **Inline facts** (`WorkspaceOverview.module.css` facts styles): 108px label column (82px on phone), token backgrounds for read-only/disabled fields, and 16px input text on small phones to prevent zoom. Field names, validation, and server actions are unchanged.
- **Media** (`WorkspaceMedia.tsx`, `WorkspaceMedia.module.css`, `FileUploader.module.css`): photo tiles use the design's 8px radius and tinted preview area, cover badge and labelled text actions (`Set cover` / `Current cover` / `Remove`) at 36px (44px coarse), the upload area is the dashed design panel, and uploader colors/radii now reference the foundation tokens instead of legacy navy hex values. Photo identities, reorder/cover/delete calls, limits, counters, and the broken-preview placeholder behavior are unchanged.
- **Delete unit** (`DeleteUnitControl.tsx`): the guarded delete now presents as the design's danger row with its explanatory note. The existing `window.confirm` confirmation, disabled guards (implicit single-family unit, linked records), and server action are preserved exactly; cancellation still prevents submission.
- **Add unit form** and page spacing were aligned to the 20px rhythm; the form's fields, defaults, and validation are unchanged.

Nested Listing/Applications/Leases/Payments/Returns/Maintenance panels were not restyled; all changes are scoped CSS modules or overview-only markup, so nested tab content keeps its current presentation. The parallel directory task's `PropertyForm`/`FieldError` files and global styles were not touched.

## Verification

| Check | Result |
| --- | --- |
| `npm.cmd run test -- tests/workspace` | 9 files, 29 tests passed (includes header/switcher, overview render, media cover/placeholder, timeline, scope, and tab tests). One initial failure from a duplicated visible "Cover" label was fixed by renaming the cover button text to "Current cover". |
| `npm.cmd run typecheck` | Passed (`tsc --noEmit`, exit 0). |
| Scoped ESLint on `src/components/workspace`, `DeleteUnitControl.tsx`, `UnitForm.tsx` | Passed with `--max-warnings=0`. |
| `npm.cmd run build` | Passed; Prisma generated, Next compiled and generated all pages. |

## Limitations

- Browser verification in the existing Edge session at desktop and 390px with before/after screenshots was not performed in this run; the visual result is verified by the passing component tests, typecheck, lint, and production build only. Route/state coverage (occupied/vacant, add/edit/save/error, guarded delete/archive, no-units, photo/document upload and preview-failure recovery) is preserved from the existing implementation and its tests rather than re-exercised in a browser.
- Illustration geometry and counts in the design remain illustrative; all displayed figures come from the existing data layer.
