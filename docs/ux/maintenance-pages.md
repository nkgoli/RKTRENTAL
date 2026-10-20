# Dedicated maintenance forms

Add requests now opens `/maintenance/new`; editing issue details opens `/maintenance/[id]/edit`. The earlier inline/dialog creation flow is replaced by full-page sections for location, issue details and photos. Edit retains assignment/status, existing photos, comments and history through the existing services. Location is read-only on edit.

## Entry points and return context

| Entry                                                   | Destination                                                                                                 |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Global Maintenance header and empty state               | New page with current property/unit and list query in returnTo                                              |
| Property or unit Maintenance Add / first-request action | New page with validated property/unit preselection and scoped return path                                   |
| Global Manage request > Edit request                    | Edit page with request scope and current list query                                                         |
| Property/unit Manage request > Edit request             | Edit page with request scope and scoped return path                                                         |
| Back / Cancel                                           | Validated maintenance-only origin; no write                                                                 |
| Created confirmation                                    | Origin plus created-request anchor; partial photo failure remains a successful creation with retry guidance |

Edit saves only title, description and priority with organization, request, property and unit constraints in the database mutation. It does not accept relocation/status/vendor fields. Manager authentication and service validation remain mandatory. Create excludes archived units, validates scope on the server, and retains existing photo failure handling. Assignment and status continue through their existing services and event semantics.

## Verification

- `npm run typecheck`: passed.
- Scoped ESLint, excluding generated runtime files: passed.
- `git diff --check`: passed.
- `npm test -- tests/maintenance tests/workspace/operations --exclude **/.runtime/** --exclude **/.dev-runtime/**`: 22 tests passed across six files. Includes scoped updates, manager authorization, invalid issue fields, safe navigation, retained draft and error focus, and existing action regressions.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3294 npx playwright test --project=maintenance`: two browser scenarios passed, desktop 1440 and phone 390. Tests cover global create cancellation; property/unit preselection; rejected create and draft correction; create with photo; edit/reload persistence; vendor/status/comment persistence; another issue edit preserving existing activity/photo/status; edit cancellation; and blocked foreign property/unavailable request forms.
- Configured Playwright MCP additionally exercised global create/edit, edit validation and correction, photo upload after creation, assignment, status, comment, global and scoped cancellation, scoped photographed creation and phone edit. Error feedback receives focus. Final mobile form has no horizontal overflow; Save/Create is 44px high, reachable and focusable. Screenshots below are actual runtime captures.

## Runtime and evidence

`node tests/maintenance/runtime.cjs seed` creates only the named synthetic QA organization, manager, property, unit and vendor in the local development database. It does not reseed/reset shared data. `node tests/maintenance/runtime.cjs` serves a task-owned source snapshot on 3294 with its own Next cache, auth secret and storage directory under `tests/maintenance/.runtime`. The fixture and uploaded files remain on disk. The server is stopped after verification. Exact candidate/source hashes, listener identity and release observations are in `tests/maintenance/evidence/runtime-identity.json`, submitted with the captures.

| Flow                                     | Capture                                                                                                                                                                |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop create with photo                | `tests/maintenance/evidence/create-desktop-final.png`                                                                                                                  |
| Desktop rejected edit / retained draft   | `tests/maintenance/evidence/maintenance-validation-desktop.png`                                                                                                        |
| Desktop persisted actions                | `tests/maintenance/evidence/maintenance-edit-actions-desktop.png`                                                                                                      |
| Phone create action clearance            | `tests/maintenance/evidence/create-clearance-390.png`                                                                                                                  |
| Phone rejected edit / retained draft     | `tests/maintenance/evidence/edit-validation-390.png`                                                                                                                   |
| Phone scoped cancellation                | `tests/maintenance/evidence/cancel-property-390.png`                                                                                                                   |
| Phone access isolation                   | `tests/maintenance/evidence/access-isolation-390.png`                                                                                                                  |
| Automated create and edit at both widths | `tests/maintenance/evidence/automated-create-1440.png`, `automated-edit-1440.png`, `automated-create-390.png`, `automated-edit-390.png` in the same evidence directory |

## Limits

Verification uses a development Next runtime and synthetic data. Production build, native desktop browser and external notification delivery were not tested. Next streams its not-found UI after the shell with HTTP 200 in this runtime; isolation tests assert the unavailable page and absence of forms rather than a pre-stream HTTP status. No push, publication or target-branch integration is claimed.
