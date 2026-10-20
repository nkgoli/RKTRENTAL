# Dedicated maintenance forms

## Activity draft preservation review

Unsaved title, description and priority now survive the edit page's activity refresh. Immediately before a successful vendor/status/comment/photo action navigates, the current issue fields are captured into a request/property/unit-scoped, tab-local session-storage handoff. The next issue form restores those values, consumes the handoff once, and identifies them as unsaved. No core issue save is performed by an activity action. Explicit Cancel discards the restored draft; returning to edit shows persisted values. Storage failure or a concurrent issue save prevents navigation and keeps the current draft visible with guidance. Pending feedback uses plain `Saving...`.

- Corrected production build passed compilation, lint/types, generation and route tracing.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3294 npx playwright test tests/maintenance/draft-activity.spec.ts --project=maintenance`: **2 passed in 12.7s**, at 1440 and 390. Each changes all three issue fields without saving, performs all four activity actions, and checks restoration after every refresh. A separate browser tab confirms the core persisted values remain unchanged. Explicit Cancel discards only the draft; comment/vendor/status/photo changes remain.
- `npm test -- tests/maintenance/issue-draft.test.ts tests/maintenance/issue-form.test.tsx tests/maintenance/feedback.test.tsx`: **7 passed in three files**, covering one-shot restoration, scope separation, pending-save protection and existing form/error behavior. Scoped lint and whitespace checks passed.
- The previously successful layout, access/service and full production-flow evidence below is reused; those unrelated checks were not repeated.
- Latest captures: `tests/maintenance/evidence/draft-activity-1440.png`, `tests/maintenance/evidence/draft-activity-390.png`, `tests/maintenance/evidence/draft-cancel-1440.png`, `tests/maintenance/evidence/draft-cancel-390.png`. The refreshed runtime identity records this candidate/build and guarded release.

Add requests opens `/maintenance/new`; issue editing opens `/maintenance/[id]/edit`. Both use a responsive page column capped at 880px. The form explicitly fills the column, and the edit activity section shares its width and left edge. Location is read-only on edit.

## Entry points and return context

| Entry                                                 | Destination                                                                      |
| ----------------------------------------------------- | -------------------------------------------------------------------------------- |
| Global Maintenance header and empty state             | New page with property/unit scope and current list query in returnTo             |
| Property/unit Maintenance Add or first-request action | New page with validated preselection and scoped/filter return context            |
| Global Manage request > Edit request                  | Edit page with request scope and list query                                      |
| Property/unit Manage request > Edit request           | Edit page with request scope and scoped/filter return context                    |
| Back / Cancel                                         | Validated maintenance-only origin, document navigation, no write                 |
| Created confirmation                                  | Origin plus created-request anchor; partial photo failure retains retry guidance |

Issue saves update only title, description and priority using organization/request/property/unit constraints. Location, vendor, status, events, photos and history are preserved. Manager authentication, scope validation and existing maintenance services remain mandatory.

Production verification exposed unusable Flight responses for Cancel and edit actions. Back/Cancel/confirmation now use document navigation. Issue forms submit through `/maintenance/form`, which returns JSON from the existing authenticated services. Retained assignment/status/comment/photo actions on the edit page use this same handler and reload the document after success with a fixed success notice. Existing global/property action services and their access/status rules remain intact.

## Final review verification

- `node tests/maintenance/runtime.cjs build`: passed optimized production compilation, lint/type validation, static generation and route tracing, including new, edit and form-handler routes.
- `node tests/maintenance/runtime.cjs start`: production runtime on port 3294 with the retained synthetic fixture and task-only storage/cache.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3294 npx playwright test --project=maintenance`: two production scenarios passed at 1440 and 390. Both use long titles and descriptions. They assert desktop form width above 800px, phone width above 330px, matching edit/activity widths and left edges, no horizontal overflow, and focused Save/Create actions. They also cover global creation cancellation, scoped creation/photo/preselection, rejected save and draft correction, edit/reload persistence, vendor/status/comment persistence, subsequent issue editing preserving photo/activity/status, Cancel, and unavailable IDs.
- Configured Playwright browser observations additionally measured a shared 880px desktop form/activity width and about 343-358px on phones, no overflow and 44px actions in the viewport. JSON edit save feedback was observed. The later browser session was reset by the MCP server; the final captures below come from the passing production Playwright scenarios on the corrected source.
- Affected tests: `npm test -- tests/maintenance/form-route.test.ts tests/maintenance/issue-form.test.tsx tests/maintenance/actions.test.ts tests/maintenance/feedback.test.tsx`: 15 passed in four files. Existing unrelated service/isolation results (22 tests across the original six files) were reused rather than rerun.
- Scoped ESLint and whitespace checks passed. Production build supplies the corrected source's typecheck.

## Final capture manifest

These actual production captures supersede the earlier narrow-form development captures. Each automated capture is taken during the named passing scenario with long content; edit captures include persisted vendor, status, activity and photo.

| Flow                                                                      | Actual submitted path                                      |
| ------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Desktop create and validation correction                                  | `tests/maintenance/evidence/automated-create-1440.png`     |
| Desktop persisted edit and aligned activity                               | `tests/maintenance/evidence/automated-edit-1440.png`       |
| Phone create, photo and action clearance                                  | `tests/maintenance/evidence/automated-create-390.png`      |
| Phone persisted edit and aligned activity                                 | `tests/maintenance/evidence/automated-edit-390.png`        |
| Scoped filter return on Cancel (retained list capture; unaffected layout) | `tests/maintenance/evidence/cancel-scoped-filters-390.png` |
| Foreign property protection (retained unavailable-page capture)           | `tests/maintenance/evidence/access-isolation-390.png`      |

## Runtime identity and release

`tests/maintenance/evidence/runtime-identity.json` records the candidate, exact source/snapshot hashes, production build ID, runtime health/listener and release observations. The runtime snapshot is under `tests/maintenance/.runtime`; no shared build output is used. The synthetic organization and uploaded storage files are retained on disk. Only this Task's server process is stopped after checks; no database reset or shared fixture reseed is performed. Native desktop browser and external notification delivery remain untested. No push, publication or target-branch integration is claimed.
