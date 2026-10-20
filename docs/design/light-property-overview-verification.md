# Light property and unit overview verification

Current result: **25 configured-Playwright MCP captures**, including16 matching
before/after images at1280x1000 and390x844, and the isolated flow observations
below. **Native existing-Edge review was not performed; the question timed out without a
window.** No native grant/control was acquired by this Task. No completion of
all navigation/implicit-delete/document checks is claimed.

## Source, build and fixture identity

| Identity | Observed value |
| --- | --- |
| Overview implementation | 89fce3685016b878b3688a0e3995e733362a8141 |
| Directory handoff | 82c224610bbcf61ceb7d28f5d073b910936d4c55 |
| Integrated merge retained | 8f5f1be8980c0f138d8e922512328437773a4ee6 |
| Baseline source/build | 4adfb9649c4fdf65c1ed07a0152a3038775c581c / GPkMC-fReltH7INFyPztO |
| Candidate source/build | 1f72f27adc9b2708c2c882187304afb87b169d3e / EheygKX6UxTxKO1h1ktwh |
| Before URL | http://localhost:3241/properties/demo-property-maple |
| After URL | http://localhost:3242/properties/demo-property-maple |
| Occupied scopes | ?unit=demo-unit-maple-11 (4B); ?unit=demo-unit-maple-7 (3A) |
| Task-local fixture | tests/workspace/native-review/.runtime/postgres; PG16 on55441; organization seed-rocket-rental; demo seed42 on2026-10-20 |
| Synthetic property | synth-ov-prop-mvfy0u3z; Overview Synthetic mvfy0u3z; 7 Synthetic Way, GeorgetownTX78704 |
| Synthetic units | vacantS1 synth-ov-unit-mvfy0u3z; S2 cmvfycjhc0001b9jwizb1xmie |
| Synthetic URL | http://localhost:3242/properties/synth-ov-prop-mvfy0u3z?unit=synth-ov-unit-mvfy0u3z |

At takeover HEAD396f27995085a059d1910c878c35aa07c7e9d0a4 was clean on the assigned
branch. Both required implementation/directory ancestors returned exit0;
the retained integrated merge ancestry was already verified. The before/after
source delta in the overview implementation files remains77 insertions/24
deletions from89fce36. No application source was edited here.

Both exact handoffs were read from admitted local Git history after linked
Task reads returned RELATED_WORK_NOT_LINKED and the manager supplied their
context. Designs light-portfolio revision24's four overview screens and
light-system revision7 were retrieved. The earlier29 workspace tests,
typecheck/scoped lint/build passes are **inherited**, not rerun or browser
results. Retained production builds were reused without rebuilding.

Source hashes/BUILD_IDs are in [runtime identity](../../tests/workspace/native-review/evidence/runtime-identity.json).
All25 submitted image hashes, sources/builds, dimensions and timestamps are in
[capture manifest](../../tests/workspace/native-review/evidence/capture-manifest.json).
The synthetic fixture state after isolated checks is in
[fixture observation](../../tests/workspace/native-review/evidence/fixture-observed.json).

## Fresh configured Playwright observations

These are this Task's dedicated automation-profile results, **not native Edge**.
Maple images were captured before synthetic mutations, with the same demo data
for baseline/candidate. Both4B and3A are occupied in this fresh fixture; no
vacancy is inferred from the inherited spec's misleading3A constant.

| Flow | Observed result / practical limit |
| --- | --- |
| Property + occupied4B/3A desktop/390 | Twelve before/after captures; Lease timeline loaded, document scrollWidth equalled viewport width. Candidate phone property cards and desktop4B facts/next-step columns inspected visually. |
| True vacantS1 desktop/390 | Four matching before/after captures after S1bedrooms3/two-unit fixture was stable; Create lease visible, switcher focused, scrollWidth equalled viewport width. Earlier candidate vacancy capture1265/1280 and375/390 also had no overflow; it was superseded by this matching set. |
| Keyboard switcher | At390, focusedS1 then ArrowDown/Enter opened canonical ?unit=cmvfycjhc0001b9jwizb1xmie (S2). Focus screenshots below. |
| Canonical links/scoped tabs | 3A's selected switcher ID and all seven tab hrefs retained its unit query. Leases clicks reached /leases?unit=demo-unit-maple-11 in initial attempts; return/all-units transitions did not complete reliably. Final narrow Open4B probe failed on both baseline/candidate; see finding below. |
| Property inline facts | Cancel changed city back to Austin when reopened; empty Name produced required error/aria-invalid; CityGeorgetown saved and survived reload. DB inspection confirmed Georgetown. |
| Unit inline facts | Cancel, required-number error and bedrooms3 save were executed; validation screenshot and DBbedrooms3 confirm validation/save. The initial run reached a confirm dialog before returning its cancel variable; a later bounded cancellation-only check independently confirmed before=S1, after=S1 after typing CANCEL-ONLY-99 and cancelling. Manager's older native unit-number cancel remains separate evidence. |
| Add unit | Empty submit showed Unit number is required. S2 was created with listedRent1600; direct DB inspection confirmed oneS2. Initial visible-link wait selected hidden phone markup; a subsequent visible-only link check found it. Label-based fill failed, so source-confirmed name selectors were used; associated-label behavior is not a pass. |
| Delete dismissal | Fresh automation confirmation said Delete this empty unit? This cannot be undone. browser_handle_dialog(accept=false) succeeded in the same tool sequence; S1 remained and after-delete-dismissed.png was captured. An earlier separate dismissal call lost session; that attempt is not a pass. No accept/deletion occurred. |
| Linked-record guard | Occupied4B Delete was disabled; occupied Status select also disabled. |
| Implicit single-family guard | NOT verified: expected Delete control was absent on the Elm route, and the probe timed out. Do not substitute source/component tests for a browser pass. |
| Archive/restore | Synthetic archive persisted and returned to directory (the initial wait wrongly expected Restore on that route). Reopening showed Restore and no Add-unit link; restore succeeded and survived reload. Fixture archivedAt is now null. |
| Photo upload | After waiting for hydrated input handling, three synthetic PNGs uploaded. DB showed PHOTO a/b/c,68bytes,image/png and task-local storage keys. Earlier pre-hydration attempt made no network request/no document. |
| Cover/order | C became cover, visible as Current cover after reload; B-up reorder returned200, reload orderC/B/A. Refresh-only cover waits timed out, so immediate refresh behavior remains inconclusive. |
| Preview failure/recovery | Intercepted only C preview with synthetic404; accessible Preview unavailable for synth-c.png appeared. Removed interception/reloaded; original image complete=true,naturalWidth=1. No stored/review binary was altered. |
| Photo removal | Real UI DELETE calls returned204 forA/B/C; reload after each; gallery returned No photos yet. DB observation contains no synthetic documents. |
| Document upload | NOT RUN; synthetic text note exists but uploader accepts different formats. Native photo/file window remains manager-coordinated. |

Representative captures (all25 listed by manifest):

- Property: [before desktop](../../tests/workspace/native-review/evidence/before-1280-property.png), [after desktop](../../tests/workspace/native-review/evidence/after-1280-property.png), [before phone](../../tests/workspace/native-review/evidence/before-390-property.png), [after phone](../../tests/workspace/native-review/evidence/after-390-property.png).
- Occupied4B: [before desktop](../../tests/workspace/native-review/evidence/before-1280-unit-occupied.png), [after desktop](../../tests/workspace/native-review/evidence/after-1280-unit-occupied.png), [before phone](../../tests/workspace/native-review/evidence/before-390-unit-occupied.png), [after phone](../../tests/workspace/native-review/evidence/after-390-unit-occupied.png).
- VacantS1: [before desktop](../../tests/workspace/native-review/evidence/before-1280-synthetic-vacant.png), [after desktop](../../tests/workspace/native-review/evidence/after-1280-synthetic-vacant.png), [before phone](../../tests/workspace/native-review/evidence/before-390-synthetic-vacant.png), [after phone](../../tests/workspace/native-review/evidence/after-390-synthetic-vacant.png).
- Interaction states: [property validation](../../tests/workspace/native-review/evidence/after-property-validation.png), [unit validation](../../tests/workspace/native-review/evidence/after-unit-validation.png), [add validation](../../tests/workspace/native-review/evidence/after-add-unit-validation.png), [dismissed delete](../../tests/workspace/native-review/evidence/after-delete-dismissed.png), [archived](../../tests/workspace/native-review/evidence/after-archived-property.png), [cover/order](../../tests/workspace/native-review/evidence/after-media-cover-order.png), [preview missing](../../tests/workspace/native-review/evidence/after-preview-unavailable.png), [preview recovered](../../tests/workspace/native-review/evidence/after-preview-restored.png), [removed photos](../../tests/workspace/native-review/evidence/after-media-removed.png).

## Navigation finding and explicit unchecked behavior

Final narrow reproduction at00:46:40–00:47 UTC: sign in, directly open
/properties/demo-property-maple, wait network-idle, click the visible Open unit4B
link, whose href is exactly /properties/demo-property-maple?unit=demo-unit-maple-11.
After6seconds, both candidate3242 and unchanged baseline3241 remained on the
property URL with Maple Court heading (opened=false). Direct occupied URLs
load. This **does not establish an introduced regression**. Source locations:
canonical Next Link in src/components/workspace/WorkspaceOverview.tsx;
soft-switch router.push in src/components/workspace/UnitSwitcher.tsx. Earlier
broad query-only URL waits also matched the Leases route prematurely; those
attempts are inconclusive and are not evidence of a distinct application bug.
Manager was asked to corroborate natively/decide any bounded source correction;
this evidence Task did not modify app code outside its owned paths.

Synthetic one-unit property also showed header Single-family while its facts
said Multi-unit. WorkspaceHeader.tsx's propertyTypeLabel treats activeUnitCount1
as Single-family and hides the switcher, even for MULTI_UNIT. AddingS2 made the
multi-unit switcher available. This discrepancy is recorded, not corrected.

## Earlier manager native evidence (attributed, not repeated)

Directory review is completed manager evidence from grant
156d150cb6fb4699836070e9101b0b1dcf280f86509fb02ba9429b95393a98ab,
2026-10-19 23:26:39–23:30:54UTC, released. Candidate007dc7d/build
koxUetsbfNhQp2sImbbDn on3232; baseline4adfb964/buildTl00hLRKUfTaiZwTV4H97 on3231;
DB55431. Desktop1699x888/phone390x844. Directory grid/list/search/filter,
modal focus/wrap/Escape/reset, required/state/ZIP errors, pending save and ONE
actual multi-property creation passed. Native screenshots are manager transcript
images only; no disk paths exist. Those checks were not repeated here.

Only partial overview native results: created propertycmvfvy7iu0009b9gc5ov7oigi
showed0/2 occupied/two vacant cards; Unit1 route?unit=cmvfvy7ix000ab9gcreta4am2,
Create lease/scoped tabs; edit99 then Cancel retainedUnit1; visible blue Status
focus. Delete confirmation opened but no accept was issued. Inspection/dismissal
timed out; deletion/dismissal outcome UNVERIFIED. Fallback app switch was
user-cancelled. Desktop release was confirmed; candidate viewport/tab cleanup
remained unverified. No occupied/desktop overview, edit-save, archive or media/
file native pass is claimed. Directory services3231/3232/55431 were stopped;
this Task never restarted or altered that runtime/fixture.

## Runtime, recovery and release status

All new runtime data is under tests/workspace/native-review/.runtime. Retained
build directories share only this checkout's dependency junction; no sibling
client/build/storage/DB was written. The previously empty local PG fixture was
migrated(all19) and seeded once. Do not reseed it. The seed required a local CJS
os.userInfo fallback before tsx preflight (ordinary --import preload was too
late for ENOMEM). Its identity/routes differ from the inherited draft spec.

The harness root was corrected to../../.., CIM access-denied launch replaced
with hidden Start-Process (child ExecutionPolicy included), and local storage
aligned to storage-candidate. Start/Status/Stop were observed. Earlier loopback
EACCES no longer reproduces. Configured MCP_SESSION_NOT_FOUND recurred, but
fresh sequences recovered sufficiently for the results above; this historical
transport failure does not invalidate the saved captures/results.

**Final state: stopped.** Guarded Stop/Status at00:57:17.6493799UTC verified
release; the latest manager-directed guarded Stop/Status at
2026-10-20T01:00:41.2219409Z reconfirmed baselineRunning=false,
candidateRunning=false and postgresRunning=false. Both sign-in HTTP connections
were refused and postmaster.pid was absent. The repeated Stop was an idempotent
no-op because the recorded services were already stopped. No restart/polling/
interaction test was performed. Recorded identities remain baseline43608,
candidate61628 and PG48680 from00:32:55, for audit only. They are not running.
The native question timed out; no window is scheduled and no grant exists.
Builds, fixture data, files and25 committed captures remain preserved. The TCP
inventory limitation described in earlier evidence does not replace these
stopped-process/HTTP/PID checks. Native/file acceptance and both-build Open4B/
all-units limits remain unchanged, with no app correction authorized.
See [runtime commands](../../tests/workspace/native-review/README.md) for hidden
Start/Status/Stop and exact generated-file paths. fixture-review.cjs prepare
refuses to replace existing identity; inspect targets only PG55441. Syntax
check(node --check) passed. The inherited CLI spec was NOT executed and is not
reported ready/passing; its fixture/schema/selectors need correction, listed
in README. Only scoped new checks were run, with prior implementation checks
reused. No desktop acquisition, cancelled-approval bypass, financial/provider
action, push, deployment, Preview publication or independent integration.

## Latest manager-directed readiness reconciliation — 00:51UTC

The manager's observed missing34628/50524/51600 PIDs correspond to the instance
explicitly stopped at00:31:01. This checkout's recorded instance had already
been restarted at00:32:55. Fresh guarded Status at00:51:16.7447702UTC confirmed
baseline43608/candidate61628/PG48680 still running with matching recorded
start-time/executable identities, source hashes and both BUILD_IDs; both
/sign-in HTTP probes returned200. postmaster.pid exists. No duplicate Start,
reseed or rebuild was performed over this healthy instance.

Per the latest manager limit, exactly one fresh configured navigation followed
immediately by a short snapshot was attempted. Navigation returned HTTP503
ACP_RUNTIME_MCP_OUTCOME_UNCERTAIN (sent/result lost, non-retryable); the snapshot
succeeded and showed about:blank. No further MCP attempt or uncertain mutation
retry followed. This is transport/session evidence, not an application defect.
Earlier saved capture/flow outcomes remain separately attributed above.

The fresh native question remains pending; no new human question/desktop
acquisition was made. Pending native file scope is **only** the existing
.runtime/synth/synth-a.png and synth-b.png (both68bytes freshly confirmed).
C/text files are excluded from that native authorization. True vacant route:
http://localhost:3242/properties/synth-ov-prop-mvfy0u3z?unit=synth-ov-unit-mvfy0u3z.
Latest DB-confirmed fixture remains Georgetown/S1bedrooms3/S2 and zero documents,
reflecting completed earlier isolated checks; no uncertain mutation was retried
or fixture reverted. Preserve it and await manager start notice/exclusive access.
Runtime remains ready/running; final native results/release are still pending.

## Additional bounded result — unit cancellation

After the latest continuation, configured browser inventory returned one
about:blank tab. Navigation/snapshot then succeeded. Sign-in discarded the unit
query in its next destination, so the first assertion wait stopped before any
edit; no mutation was attempted in that first call. An authenticated direct
navigation to the exact S1 query then succeeded. The cancellation-only check
returned before=S1, after=S1, unchanged=true after filling CANCEL-ONLY-99,
Cancel, Edit, reading the value and Cancel again. No Save or persistent
fixture mutation was issued. This closes the earlier unit-cancel value gap.
No completed implementation/flow check was repeated. Native question and
file scope remain unchanged; runtime was preserved while that window was pending.

## Final delivery and guarded release — 00:57UTC

The manager reported that the existing native-window question timed out with
No answer in10minutes; continue on your own judgement. This supplied **no new
native Edge/file grant**. No new human question, desktop request, watchdog,
native control or file approval bypass was attempted. Native/file gaps above
remain limitations; no old directory/native evidence is relabelled as fresh.

The requested final remaining configured navigation was attempted once and
returned MCP_SESSION_NOT_FOUND. No further retry, uncertain mutation, captured
navigation pass or occupied-scope pass is inferred from that transport error.
Earlier successful occupied-route/guard/attribute observations remain valid;
the exact-source final narrow soft-link findings remain recorded with their
baseline/control and practical limits.

Guarded overview-review.ps1 Stop completed server stopped. Status at
2026-10-20T00:57:17.6493799Z verified baselineRunning=false,
candidateRunning=false, postgresRunning=false, both sign-in HTTP connections
refused, and postmaster.pid absent. PG_VERSION and syntheticA/B68byte files
remain. Existing source/build assertions also passed during Status. Only the
recorded task-owned identities were stopped; directory/sibling services and
fixtures were not touched. Builds, initialized/seeded database, local storage,
synthetic files and captures are retained for later authorized use.

[Structured release evidence](../../tests/workspace/native-review/evidence/runtime-release.json)
records commands/results/ownership. This final stopped state supersedes all
earlier running/readiness statements. No native review is waiting on active
services now; any future authorized review must use guarded Start/Status and
preserve the fixture without reseeding/rebuilding.

Delivered:25 captured files and manifest,16 matched before/after overview
images at desktop/390, actual isolated affected-flow observations, exact source/
build/fixture identities, inherited manager attribution, explicit unchecked/
failed states and verified runtime release. These are the evidence deliverables,
not a claim that every browser/native check passed. No push, deployment,
implementation redo or manual root integration occurred.
