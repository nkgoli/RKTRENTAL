# Maintenance and documents UX review

Reviewed 18 October 2026 against the foundation's `full-app-review.md`, Designs/rocketrental-app revision 288 and Diagrams/rocketrental-mindmap revision 4 (`f-maint`, `f-docs`). The diagram has no additional file references. No input attachments were supplied.

## Coverage and decisions

| Route / screen                               | Disposition                    | Changes and rationale                                                                                                                                                                                                                                                                                                                                              | Verification                                                                       |
| -------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `/maintenance`                               | Improved                       | Clear request titles, status grouping, compact priority/vendor/date context, expandable management, attachment counts instead of broken cover images, scoped filter recovery, separate create dialog                                                                                                                                                               | Focused query/action/feedback tests; native Edge desktop/phone review and evidence |
| `/properties/:id/maintenance`                | Improved                       | Every request now exposes vendor/status/photo/comment controls without leaving its property. Labelled table headers/scroll region; phone rows become labelled blocks. All attached photos are fetched together instead of showing only the cover                                                                                                                   | Scoped list and action tests; native Edge desktop/phone review and evidence        |
| `/properties/:id/maintenance?unit=:unitId`   | Improved                       | Existing unit validation remains; create options and server mutations also enforce the current property/unit. Empty state offers the same create dialog. Archived-unit scopes explain unavailable creation                                                                                                                                                         | Cross-unit rejection/ownership tests; native scoped empty/dialog checks            |
| `/documents` and property/unit queries       | Improved                       | File browsing is first. Upload is an expandable panel with a wide destination field and explicit destination choice before immediate uploads. Property/unit filters cannot retain a unit from another property. Clear filters, meaningful no-results state, wrapped names and labelled preview/download links. Lease Manage files opens the existing Documents tab | Upload destination and filter tests; native Edge desktop/phone review and evidence |
| `/properties/:id/documents` and unit queries | Already coherent               | Compatibility redirect continues to property Overview, preserving unit and other query state. It does not point to the portfolio file library. Editing the Overview media controls belongs to Portfolio                                                                                                                                                            | Redirect regression passed; native scoped redirect confirmed                       |
| Design `maintenance`                         | Improved                       | Scoped request table, date/status filters, management disclosures, new-request dialog and existing workspace tabs                                                                                                                                                                                                                                                  | Saved revision 301; inspected at revision 303                                      |
| Design `maintenance-empty`                   | Improved                       | Compact empty state and consistent create dialog with the selected unit. Removed unsupported issue-type/notify controls from the older mockup                                                                                                                                                                                                                      | Saved revision 302; inspected at revision 303                                      |
| Design `documents`                           | Improved                       | Expandable upload, explicit destination, searchable property/unit scope, grouped files and direct management links                                                                                                                                                                                                                                                 | Saved revision 303; inspected at revision 303                                      |
| Properties design / shared lease tabs        | Already coherent for this task | Context only. Properties is owned by Portfolio. Existing Overview / Agreement / Documents / Payments / Activity lease tabs and shared uploader were preserved                                                                                                                                                                                                      | Source inspection and native lease Documents navigation; shared controls preserved |

The foundation coverage map also mentions providers/integrations. Those routes are outside this Task's current owned-path contract and were not changed or claimed as reviewed here.

## Behavior and safeguards

- Request actions return inline validation, failure and success feedback. Pending fieldsets prevent repeat submissions. Failed forms retain the entered values. Successful updates refresh the current URL, preserving scope, status/date filters and pagination. Creation offers a link to an unfiltered request list retaining the property/unit, so the new request remains reachable when the previous view excluded New requests.
- Property/unit actions check organization and current scope before delegating to the existing maintenance services. Their role, vendor, file validation, audit and notification behavior remains in place.
- Creation reports a successfully created request even if its optional photo fails, preventing a retry from silently creating a duplicate. The user can add the photo through Manage request.
- Image failures show “Photo preview unavailable” with Open photo and Download actions. Missing stored file bodies are not recreated or reseeded. The three latest comments remain the existing list-service limit; this is labelled Recent comments.
- The native dialog supports Close, Cancel and Escape. Opening a fresh dialog resets its local form. Requests with no available active unit explain why creation is unavailable.
- Uploads still start immediately after file selection. Destination selection is now explicit unless a valid property/unit scope supplies it. The shared uploader still handles type/size checks, progress, retry and selection removal. Rename/share/delete stay on the existing lease or property screen with their existing confirmations.
- New local error boundaries explain a failed requests/files load and provide Retry and a list destination. Existing shared loading skeletons are retained.

## Runtime and checks

The baseline was observed in the human's existing Personal Edge session at `http://localhost:3100`. Native Windows MCP used the desktop lease; screenshots include the browser address and, for phone checks, Edge's responsive toolbar at 390 × 844.

The after runtime is an isolated production snapshot of this shared checkout at `http://localhost:3112`, in `tests/workspace/operations/.runtime`. The local `runtime.cjs` launcher uses the existing PostgreSQL instance on 5433 and root file storage, process-local HTTP-cookie configuration and the existing local-development signing configuration. No database or storage migration/reset, seed, provider setup or publication was performed. Other area processes and their Next caches were preserved.

Snapshot preparation copies `src`, `next.config.ts`, `tsconfig.json`, `package.json` and `next-env.d.ts` into the isolated directory. Dependencies resolve from the existing ancestor installation. Build and serve use:

```powershell
node --env-file=C:/Users/nkgol/RocketRental/.env --import file:///C:/Users/nkgol/RocketRental/.orchestra/workspaces/@6fmicph499j20nbevsv/repository/prisma/os-userinfo.mjs tests/workspace/operations/runtime.cjs --build
node --env-file=C:/Users/nkgol/RocketRental/.env --import file:///C:/Users/nkgol/RocketRental/.orchestra/workspaces/@6fmicph499j20nbevsv/repository/prisma/os-userinfo.mjs tests/workspace/operations/runtime.cjs
```

| Check                                                                                                                                                             | Observed result                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scoped Vitest: `npm.cmd run test -- tests/maintenance tests/documents tests/workspace/operations/operations.test.tsx tests/workspace/documents-redirect.test.tsx` | 21 passed in six files                                                                                                                                                                                                                                                                          |
| ESLint on owned TS/TSX and tests with `--max-warnings=0`                                                                                                          | Passed                                                                                                                                                                                                                                                                                          |
| `npm.cmd run typecheck`                                                                                                                                           | Passed. An earlier concurrent leasing prop mismatch was resolved by that area's changes; Operations did not edit those files                                                                                                                                                                    |
| Isolated Next production build                                                                                                                                    | Passed compilation, type/lint phase, static generation and tracing. Build ID `CHmup-hsmZ6-gaY2NsWO8`. Ancestor lockfile warning remains. The initial relative preload path failure was repaired with an absolute preload; a CSS alignment warning was fixed and the build repeated successfully |
| Financial/destructive submissions                                                                                                                                 | Not performed. Existing data was preserved. Maintenance mutation semantics and partial-success/error cases were checked with isolated mocks                                                                                                                                                     |

The whole project suite was not run. Existing data-changing Playwright maintenance/document scripts were updated for the new dialog and labelled file links, but are not part of the 21 Vitest tests and have not been run against the shared database. The [production build log](../../tests/workspace/operations/evidence/production-build.txt) records the final successful build. Owned source files match that snapshot ignoring whitespace; the local runtime launcher also passes `node --check`.

### Shared development runtime follow-up

The manager's later runtime instruction was applied on 18 October 2026. `http://localhost:3102` was unoccupied and now serves the current request checkout through `tests/workspace/operations/shared-dev.cjs`. It is left running for the other area checks.

| Identity | Observed value |
| --- | --- |
| URL / binding | `http://localhost:3102`, loopback `127.0.0.1:3102` |
| Launcher PID | `38376` |
| Listening Next server PID | `41536`, child of `38376` |
| Source checkout | `C:\Users\nkgol\RocketRental\.orchestra\workspaces\@6fmicph499j20nbevsv\repository` |
| Generated project directory | `tests/workspace/operations/.dev-runtime` within that checkout |
| Development output | `tests/workspace/operations/.dev-runtime/.next-ux-dev` within that checkout |
| Next version / mode | `15.5.27`, development |

The launcher uses ordinary Next CLI configuration in the generated project directory, importing the checkout's Next configuration and setting `distDir` there. It copies and watches `src` and `public`; changes, additions and removals propagate after a short debounce. Regular copies are necessary because this installed Windows Next watcher did not discover routes through a directory junction. Copies use atomic file replacement and retry transient Windows locks. Package/configuration changes require restarting this launcher. The generated files are ignored, and the source checkout remains authoritative.

The launch command, started as a hidden background process with logs in the evidence directory, is:

```powershell
node --env-file=C:/Users/nkgol/RocketRental/.env --import file:///C:/Users/nkgol/RocketRental/.orchestra/workspaces/@6fmicph499j20nbevsv/repository/prisma/os-userinfo.mjs tests/workspace/operations/shared-dev.cjs
```

The process-local database, authentication and storage settings match the existing reviewed local demo runtime. No committed configuration, environment file, database or storage contents were changed. No production build ran during this follow-up. The checkout's Next config, TypeScript config and existing `.next` build/routes manifests retained their pre-launch SHA-256 hashes. A temporary file in the owned maintenance component directory verified create, update and removal propagation; it was removed from both source and runtime. Launcher syntax passed `node --check`. An unauthenticated `/maintenance` request followed the expected sign-in redirect and returned HTTP 200 with the configured Content-Security-Policy.

The first watcher exited on an `EBUSY` file lock during a concurrent edit. The repaired launcher was tested by exclusively locking a temporary runtime file while updating its source: the HTTP server remained available, the copy retried successfully after release, and deletion propagated afterward. Both temporary files were removed. All 343 current source files subsequently matched the runtime copy by SHA-256; a repeated sign-in request returned HTTP 200. The PID values above identify this repaired process, superseding the earlier launcher `34524` and listener `17756`.

The root `3100` server remained PID `33572` and returned HTTP 200. The reported foundation PID `5432` no longer existed, no process listened on `3101`, and the checkout had no `.next/BUILD_ID` before this launch. Thus the prior foundation build `jLhDn7QEs_m9wijKeQoL5` could not be restarted from the observed output. That output was left untouched; restoration of the foundation runtime remains unresolved. The isolated production snapshot for `3112` was also preserved.

At 23:05 PDT, a fresh availability check confirmed `3102` listening under PID `41536` (parent `38376`), returning HTTP 200 through `/sign-in?next=%2Fmaintenance` with CSP present. This is a development runtime from the shared working tree, whose HEAD at that check was `ef042f5dfb5e929c264417eb1b3e0c4a20d95c59`; it has no fixed production build identity. At the same check `3112` had no listener and its HTTP connection failed. Its saved build `CHmup-hsmZ6-gaY2NsWO8` remains on disk, and the saved RequestDetails source matches the checkout. No process was restarted or stopped and no build or shared configuration change was made for this availability check. Later short desktop acquisition attempts again returned `DESKTOP_CONTROL_WAIT_TIMEOUT`; the queue entry was released without driving the desktop.

The follow-up obtained desktop ownership and switched to the existing Personal Edge session with Windows MCP. The desktop then returned to the human's ChatGPT settings while navigation was attempted. Desktop ownership was released immediately. No new `3102` screenshot is claimed, and its authenticated app render has not yet been rechecked. The completed desktop/phone interaction evidence below remains evidence of the unchanged application implementation on `3112`; the [shared runtime verification record](../../tests/workspace/operations/evidence/shared-dev-verification.txt) records the narrower launch and source-sync checks.

## Native Edge results

Windows MCP drove the existing Personal Edge app session, taking and releasing desktop ownership between review sessions. Desktop captures use the maximized 2560 × 1600 display; phone captures use that same tab in Edge device emulation at 390 × 844. No separate browser session substituted for these checks.

| Flow                                   | Observed result                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Portfolio maintenance                  | All four status groups remained visible on desktop; cards and filters stacked within the phone viewport. Expanding Manage request exposed vendor/status controls, photos and comments.                                                                                                                                           |
| Request validation and attachments     | Submitting the empty create form focused the required unit selector with Edge's validation message. Submitting Upload photo without a file returned “Choose a photo before uploading.” inline. Existing missing photo bodies displayed the fallback while retaining links. Neither validation changed a record.                  |
| Property / unit maintenance            | Maple Court listed only its three requests. Selecting Unit 1A with the keyboard produced its empty state; Create your first request opened a dialog limited to Unit 1A. Property rows and expanded controls fit the phone viewport.                                                                                              |
| Dialog keyboard / cancel               | Unit received initial visible focus. Tab reached priority and title; Escape closed the dialog. Entered a temporary title, chose Cancel, and reopened to a blank title with the unit scope retained.                                                                                                                              |
| Documents                              | Upload started collapsed; choosing a destination revealed the existing uploader and its immediate-upload notice. Opened Browse files and cancelled the native file picker. Searching an unmatched string produced one useful empty state and Clear filters. Phone filters, names and file actions wrapped without page overflow. |
| File navigation                        | Move-in inspection.pdf preview opened successfully in Edge's PDF viewer in a new tab, which was then closed. Manage files opened the lease's Documents tab with Overview / Agreement / Documents / Payments / Activity intact.                                                                                                   |
| Property documents compatibility route | `/properties/seed-property-maple/documents?unit=seed-unit-maple-1` redirected to `/properties/seed-property-maple?unit=seed-unit-maple-1`. The native screenshot records the destination URL during loading; the redirect regression also passed.                                                                                |
| Loading / failure recovery             | Observed the existing loading skeleton during phone navigation. Inline action error and missing-photo states were checked natively. Route error Retry behavior was checked with the focused component test; a database outage was not induced in the shared app.                                                                 |

The native review also caught inherited centered labels in the empty-state dialog and a missing visually-hidden style on repeated request titles. Both were corrected locally without changing accessible names or shared styles. Final captures below supersede the earlier maintenance/dialog layout captures where those small details differ.

## Changed-file summary

- Maintenance routes/actions and area components now share scoped action handling, inline feedback, all-photo loading, accessible request details and resilient photo rendering. Local route error boundaries add retry destinations.
- Property maintenance list/dialog and scoped styles add management controls, unit-bound creation, compact desktop hierarchy and labelled phone rows.
- Documents page, uploader controls, filters and scoped styles prioritize browsing and explicit destinations. The existing property documents redirect and shared file uploader remain unchanged.
- Focused action/feedback/document controls tests cover scope rejection, failed-input preservation, partial photo failure and destination/filter behavior. Existing browser scripts were adjusted to the changed accessible controls. The local runtime launcher and ignore rules make the reviewed snapshot reproducible.

## Limitations

- Live create, vendor/status/comment updates and uploads were not submitted to the shared database. Their new server-action behavior was verified with isolated mocks. No financial or destructive actions were submitted; existing lease/property rename, sharing and deletion confirmations remain owned by those areas.
- Several existing maintenance photo records have missing file bodies. The fallback is verified; this task does not repair storage data. Download links remain available, but a native download was not saved during review.
- The route error boundary was not exercised through an induced runtime outage. File upload success/retry and archive-only-unit scenarios have source/component coverage rather than native fixture coverage.
- The retained source checkout includes concurrent work by other areas. The submitted commit contains only this task's paths; it is a candidate, not a claim of integration into main or Preview publication.

## Evidence

Windows MCP baseline:

- [Maintenance desktop](../../tests/workspace/operations/evidence/before-maintenance-desktop.png) and [phone](../../tests/workspace/operations/evidence/before-maintenance-phone.png)
- [Documents desktop](../../tests/workspace/operations/evidence/before-documents-desktop.png) and [phone](../../tests/workspace/operations/evidence/before-documents-phone.png)
- [Property maintenance desktop](../../tests/workspace/operations/evidence/before-property-maintenance-desktop.png)

Windows MCP final refinements (rechecked after the last production build):

- [Compact request controls on desktop](../../tests/workspace/operations/evidence/final-maintenance-desktop.png) and [phone](../../tests/workspace/operations/evidence/final-maintenance-phone.png): accessible request names remain in the UI tree while the repeated visible title is hidden.
- [Phone dialog alignment and Tab focus](../../tests/workspace/operations/evidence/final-unit-dialog-phone.png) and [focus returned after Escape](../../tests/workspace/operations/evidence/final-dialog-focus-return.png). The scoped Unit 1A dialog has left-aligned labels, and Escape returns visible focus to Create your first request.

Windows MCP after, including interaction checks before the two final visual refinements:

- [Maintenance desktop](../../tests/workspace/operations/evidence/after-maintenance-desktop.png), [phone filters](../../tests/workspace/operations/evidence/after-maintenance-phone.png), [phone board](../../tests/workspace/operations/evidence/after-maintenance-board-phone.png), and [loading](../../tests/workspace/operations/evidence/after-maintenance-loading-phone.png)
- [Request details](../../tests/workspace/operations/evidence/after-maintenance-detail-desktop.png), [missing-photo validation](../../tests/workspace/operations/evidence/after-maintenance-photo-validation.png), [dialog](../../tests/workspace/operations/evidence/after-maintenance-dialog-desktop.png), and [required-unit validation](../../tests/workspace/operations/evidence/after-maintenance-required.png)
- [Property list desktop](../../tests/workspace/operations/evidence/after-property-maintenance-desktop.png), [phone](../../tests/workspace/operations/evidence/after-property-maintenance-phone.png), and [phone details](../../tests/workspace/operations/evidence/after-property-detail-phone.png)
- [Unit empty desktop](../../tests/workspace/operations/evidence/after-unit-maintenance-empty.png), [phone](../../tests/workspace/operations/evidence/after-unit-maintenance-empty-phone.png), [scoped dialog](../../tests/workspace/operations/evidence/after-unit-dialog-phone.png), and [cancel/reset](../../tests/workspace/operations/evidence/after-unit-dialog-reset-phone.png)
- [Documents desktop](../../tests/workspace/operations/evidence/after-documents-desktop.png), [upload controls](../../tests/workspace/operations/evidence/after-documents-upload-desktop.png), [explicit destination](../../tests/workspace/operations/evidence/after-documents-destination.png), and [no results](../../tests/workspace/operations/evidence/after-documents-empty.png)
- [Documents phone](../../tests/workspace/operations/evidence/after-documents-phone.png), [file actions](../../tests/workspace/operations/evidence/after-documents-files-phone.png), [PDF preview](../../tests/workspace/operations/evidence/after-document-preview.png), [lease Documents destination](../../tests/workspace/operations/evidence/after-manage-lease-documents-phone.png), and [property redirect](../../tests/workspace/operations/evidence/after-property-documents-redirect-phone.png)

Inspected Orchestra renders, separate from Windows evidence:

- [Maintenance](../../tests/workspace/operations/evidence/design-maintenance-r303.png)
- [Maintenance empty](../../tests/workspace/operations/evidence/design-maintenance-empty-r303.png)
- [Documents](../../tests/workspace/operations/evidence/design-documents-r303.png)

Screenshots are submitted evidence files rather than committed image assets. The isolated runtime/cache is ignored. The implementation changes only the declared operations routes/components/tests and this report.
