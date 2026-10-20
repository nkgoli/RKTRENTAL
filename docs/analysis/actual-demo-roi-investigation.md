# Actual demo ROI investigation — blocked browser custody

Observed 2026-10-20. The requested population and complete property-to-ROI verification remain unfinished. No database or application source changes were made.

## Identified environment

Read-only browser inventory found the user's RocketRental tab at http://localhost:3100/dashboard (other historical RocketRental tabs were also present). Configured Orchestra Playwright successfully navigated to that origin's ROI URL with property=seed-property-maple, then redirected to sign-in in its separate profile. Screenshot: actual-demo-sign-in.png (workspace root; tool returned that actual location).

Windows process inspection identified Next PID 60368, parent 42892, running the root project's node_modules/next/dist/bin/next start -p 3100. Parent launch was scripts/start.ps1 -Port 3100 -DbPort 5433; its database launcher was PID 26996. A TCP listener on 3100 belonged to 60368. No process was stopped or restarted. Managed Preview inspection returned absent, generation 0.

Root Git HEAD and task HEAD were both 2baf757b56fd8d74b355d5db06ca1d283b804614. Root BUILD_ID was xGPw1-iniRu859GLdczxJ, timestamp 2026-10-20T15:42:50Z. Built ROI route exists. This identifies the observed build artifact and checkout; it does not prove that every built byte matches HEAD. Root had unrelated modifications to prisma/package-lock.json and untracked start-rocketrental.ps1; both were preserved. Required predecessor commits f67ec4934b53b6c19f116fe21f5deebed826df35 and 47eb2d16354f94d11a7967db076743dec1f46b5e passed ancestry checks in the task checkout.

## Stored records and cause findings

Read-only Prisma queries used the bundled local PostgreSQL target on localhost:5433, database rocketrental, public schema. Credentials were not recorded. Queries selected property identifiers, organization, name, street, purchasePrice, loanAmount, roiInputs and updatedAt, and all RoiAnalysisState propertyId/revision/status rows.

| Property ID | Organization | Price | Loan | ROI inputs |
| --- | --- | ---: | ---: | --- |
| seed-property-maple | seed-rocket-rental | 2830000 | 1980000 | null |
| seed-property-harbor | seed-rocket-rental | 4790000 | 3350000 | null |
| seed-property-cedar | seed-rocket-rental | 1470000 | 1030000 | null |
| seed-property-elm | seed-rocket-rental | 413000 | 289000 | null |
| maintenance-pages-property | maintenance-pages-synthetic-20261019 | null | null | null |

The four seed records had updatedAt 2026-10-16T19:09:11.587Z. Maple name/address match the admitted screenshot (Maple Court, 214 Maple Ave). Its ID, seed organization, name/address and price/debt align with prisma/seed.ts. RoiAnalysisState query returned an empty array across the database. No existing saved override explains these missing values. Account identity in the separate Playwright session remains unverified because sign-in was not completed.

Source findings: src/lib/analysis/service.ts reads optional property roiInputs, overlays supplied sections/options, preserves canonical price/debt and explicit clears, and does not invent financial assumptions. RoiWorkspace.tsx:180 prefers saved.data.payload over a new property draft. prisma/load-roi-examples.ts calls loadRoiExamples under sandbox guards. prisma/roi-examples.ts creates only demo-roi-v1-financed/cash/tight and saves complete READY analyses for those new examples; it never populates the four seed properties or their roiInputs and preserves existing saved analyses. None of those three example records exists in this live database. docs/analysis/fictional-roi-examples.md explicitly documents the previous task's separate fictional_roi_demo database on 55579 and app on 3179, not this environment. This explains why prior isolated demonstration did not fill the user's Maple record. No mapping defect is established by these findings; live authenticated UI reproduction remains required.

## Unresolved browser access

After successful navigation/snapshot/screenshot, browser_fill_form and browser_click returned HTTP 503 ACP_RUNTIME_MCP_CONTROLLER_UNAVAILABLE with delivery notDispatched. A follow-up browser_snapshot returned MCP_SESSION_NOT_FOUND. Thus no sign-in, editing, creation, calculation, reload or property switching was performed. No fictional values were written without completing live environment verification. The supplied input screenshot was inspected directly; its 19 missing assumptions and unavailable outputs were confirmed visually, but not reproduced in an authenticated current session.

Restore the configured Orchestra Playwright session/controller, then authenticate the demo account, reproduce Maple, verify exact build/runtime identity as far as available, apply explicitly labeled additive assumptions only to confirmed demo records while preserving edits/clears and unrelated rows, and run the requested complete/partial/no-data customer-entry and demo selection/reload/switch flows. Do not reseed the database or substitute another fixture. No new app/database/review process was created. Desktop inventory ownership was acquired and released; personal tabs were neither attached to nor modified. App listener availability was observed before the browser bridge failure; end-of-task HTTP availability should be checked separately.

Final availability check: Invoke-WebRequest http://localhost:3100/sign-in returned HTTP 200. The retained screenshot is copied to docs/analysis/actual-demo-sign-in.png.
