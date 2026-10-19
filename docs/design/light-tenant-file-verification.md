# Tenant lease download and repair photo verification

The isolated integrated runtime is ready for manager-coordinated native existing-Edge checks. Neither native file outcome is verified yet. No desktop grant or file approval was acquired by this Task.

## Source, build and fixture

- Assigned checkout: `C:/Users/nkgol/RocketRental/.orchestra/workspaces/@3qbergpj46rp2ei95p0/repository`; branch `orchestra/work-2gcjdifqik3o7helc0b-3iq9qcx1nlxkpksf9kx`.
- Integrated source: `a7cfc0fd93e31caa7f6ede67179282d3a6ea5bbd`. Exact ancestor checks for Home/Lease `881bc83b4458aa87879eb3c4cb576fe46d8fd886`, Repairs `c3a8312b0a5c7be527224c4b93fd1ff32ffdbfd6`, and Payment `bc43d02bcade163b3f04f3b06131b64e108a2c5c` all exited 0. Initial working tree was clean.
- `git archive HEAD` reconstructed that source under `tests/tenant-file-verification/.review-app`. Dependencies, generated Prisma client, build, database and storage are all local to that ignored snapshot. No other checkout or retained fixture was accessed or modified.
- Production build: `-ATEDz0E63DKdXPbtl4rx`; `next build` passed, including its lint/type checks and 24 generated static pages. This build was necessary because this assigned checkout had neither dependencies nor a build. No prior regression suite was rerun.
- URL: `http://127.0.0.1:3238/sign-in`; pages `/lease` and `/repairs`. App binds loopback only. PostgreSQL uses unused port 55438. Both were free before preparation. Hidden PowerShell launches use `runtime.ps1`.
- Fixture root relative to this checkout: `tests/tenant-file-verification/.review-app/.file-review/`. Fresh standard synthetic seed: 19 migrations, 4 properties, 45 units, 41 occupied leases. No existing database was reseeded.
- Native chooser input: `tests/tenant-file-verification/.review-app/.file-review/harmless-photo.png` (1812 bytes, PNG signature checked), SHA-256 `541DA3F37782728F70757596784A59EA0A3FAE9A72992C25663FFC4501BC3D91`.
- Expected lease bytes: `tests/tenant-file-verification/.review-app/.file-review/synthetic-lease.pdf` (1061 bytes), SHA-256 `79651ED35BEE69D467A986FABBB45C60FC3A6EE1277AFEB3F105FAA0DCDAA52D`. Source storage object: `.file-review/storage/seed/seed-doc-alex-lease`; document ID `seed-doc-alex-lease`, visible title Signed lease agreement.pdf. The copy is a comparison fixture, not a native download result.
- Seeded tenant: Alex Rivera. Use the existing authorized fixture sign-in process. Credentials and the runtime auth secret are omitted from the handoff.

Read the earlier Home/Lease and Repairs handoffs and revision 27 Lease/Lease desktop and Repairs/Repairs desktop design markup. Existing successful checks remain attributed to those handoffs; endpoint/Chromium results do not prove native file outcomes.

## Readiness and manager checklist

Observed `/sign-in` HTTP 200. App PID 51836 and PostgreSQL PID 34196 were matched to this exact snapshot/database through current command lines. A second app launch was rejected by the occupied-port guard before creating a duplicate. PIDs are observations only and must be revalidated before release.

The manager must coordinate fresh access to existing Edge and fresh download/upload approvals before file operations. At desktop and again at 390px:

1. Sign in and open Lease. Activate the signed lease Download action with approval. Record browser completion/cancellation, actual destination/name/size and, if available, hash matching the expected synthetic PDF. A successful endpoint alone is insufficient.
2. Open Repairs, enter a unique synthetic request description, select the absolute harmless-photo.png path through the native chooser with approval. Record selected count (expected 1 of 5), filename and preview or explicit fallback/ready feedback before submitting.
3. Submit once. Record URL/notice, request identity, upload success/partial/error feedback and visible photo after reload. Capture desktop/390px references and distinguish UI observations from any database confirmation. Preserve the resulting request/photo data.
4. Treat cancelled/denied operations as unverified; report the exact limitation. Restore viewport and release desktop access through the manager's normal workflow.

## Guarded operation and release

From this checkout, launch hidden with `Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','tests/tenant-file-verification/runtime.ps1','app'`. Use `db` only if its port is free. Never use `prepare` to restart: it refuses an already prepared fixture. The app guard requires its recorded build and a live fixture database. Build mode requires the app port free. No watchdog is installed; readiness does not guarantee host retention.

After the manager releases review, run `runtime.ps1 stop` with process-inspection permission if needed. It discovers listeners afresh, checks command lines against this exact snapshot/database, stops only the matching app and gracefully shuts PostgreSQL down, then requires both ports free. It never relies on saved PIDs. Preserve all fixture/storage/build files. Wrapper/helper release must likewise verify current command line/parentage before stopping any remaining owned helper.

## Native evidence and remaining limitation

Pending manager observations and capture references. Previous cancelled download and upload approvals remain explicitly unverified. This Task has performed no native chooser selection, upload or download, acquired no desktop, and requested no human approval directly. Runtime release is pending review; it is not claimed complete. No push, merge, publication or deployment.

Setup observations: initial sandboxed Prisma engine download failed; approved engine generation succeeded. PostgreSQL initially logged a restricted-token warning but initialized successfully and seeded normally. Next reported its existing multiple-lockfile workspace-root warning. Read-only process inspection required elevation because sandbox CIM access was denied.
