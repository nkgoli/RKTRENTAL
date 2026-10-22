# Redisgn operations — Maintenance and Documents handoff

Design: `Designs/redisgn` (block design). This section owns four screens, built on the foundation in
`redisgn-foundation.md`. The shared tokens and components were not changed.

| Screen | Device | Final verified revision |
| --- | --- | --- |
| `maintenance` | desktop 1280 px | 23 |
| `maintenance-mobile` | phone 390 px | 26 |
| `documents` | desktop 1280 px | 39 |
| `documents-mobile` | phone 390 px | 44 |

Each screen was last written at the revision listed. Later revisions only contain other Tasks' screens.

## 1. What the live app shows (Edge, 2026-10-21)

The review used the human's Edge tab at `http://localhost:3100`, signed in as Jordan Mills, and was read-only. It
visited `/maintenance`, one request's edit page and `/documents`. Nothing was typed, saved, uploaded or sent. The tab
was returned to `/dashboard`.

- **`/maintenance`.** Three stats: Open requests 4 (across 3 properties), Urgent attention 1 (Kitchen sink leak ·
  Maple Court) and Completed this week 1. Filters for status ("Open + recent") and Created from/to. A kanban with
  New 1, Assigned 1, In progress 2 and Done 2. Each card shows the property · unit, a priority dot, the date, the vendor
  (or "Unassigned · Assign") and "1 photo attached". The footer reads "Showing open requests and requests completed in
  the last 90 days. 1–6 of 6" and has a "Show all history" link. "New request" is the primary action.
- **`/maintenance/seed-request-maple-4b/edit`.** A dedicated edit page with a breadcrumb back to Repair requests,
  New / Urgent priority badges, Cancel and Save request buttons, and request details (title, empty description, an
  access-instructions hint). It has a Manage request panel (Priority Urgent, Status New, Assigned vendor Unassigned,
  "Location stays with this request"), Photos 1 (seed-request-maple-4b.png), comments, and a Request record (opened
  Oct 20, 2026, 6:57 PM UTC; saved status New; saved vendor Unassigned).
- **`/documents`.** "Documents and photos" with Upload files, "12 files · 17 KB stored", type chips (All files /
  Leases / Notices / Inspections / IDs / Photos), search, Property and Unit selects, and Newest first. Lease documents
  are grouped by lease, with one group: "Lease: Maple Court · Unit 4B — Alex Rivera" and Manage files. It holds three
  PDFs: Move-in inspection, Signed lease agreement, and Photo ID (restricted access). The view and download icons have
  no visible labels. Property files shows the empty state "Nothing uploaded for properties yet" with View properties.
  Photos has six property and unit photos.

## 2. Changed visual hierarchy

- **Maintenance.** A gradient band leads with "4 open" and a vendor-coverage bar ("3 of 4 open requests have a
  vendor · 75%"). White Stat cards beside it show Urgent attention and Completed this week. An ink "Needs a decision"
  panel lists three items:
  - the urgent unassigned leak, with "Assign a vendor →"
  - the high-priority AC job, now 11 days in progress
  - the Done request with no vendor recorded

  Beside the panel, a Request detail card shows the selected request: status Steps, vendor, location, saved status,
  photo, a warning that there is no description, and Edit request / View photo / Add a comment. The four-column board
  is kept below with its status, date filters and counts. On phone, the board becomes one grouped list (New, Assigned,
  In progress, Done) under a Filter by status select, and the ink card shows the urgent request.
- **Documents.** A gradient band shows "12 files" and the storage figures. Stat cards beside it show the signed lease
  agreements and restricted-access files. Filters sit in one bordered panel. Lease documents stay grouped by lease, with
  explicit eyebrow sections:
  - **Signed agreement:** the PDF with a Signed badge.
  - **Addendums:** a visible "No separate addendum uploaded for this lease" slot, so addendums are never buried.
  - **Inspections & IDs.**

  Every file row has a PDF type badge and labelled Preview and Download buttons. A Preview card shows the selected PDF
  with its lease and tenant links, "Review signatures" and Download PDF. On phone, the type chips become a File type
  select because six chips clipped at 390 px.

## 3. Representative states

- **Maintenance:**
  - Populated board, with all six live requests.
  - Detail state for the selected request.
  - Warning state for a missing description.
  - Unassigned state, with an Assign vendor button on the card.
  - Done request with no vendor recorded.
- **Documents:**
  - Populated lease group.
  - Empty addendum slot.
  - Restricted-access file, shown with a lock icon.
  - Property files empty state, with its live copy.
  - Preview state.

## 4. Workflow preservation

- **Maintenance editing.** Create and edit stay on their dedicated pages (`/maintenance/new` and
  `/maintenance/[id]/edit`). The board and detail card only link to them, so unsaved edits never sit on the board.
  The design has no separate edit screen, so New request, Edit request and the Assign links have no destination or
  point back to `maintenance`.
- **Status, filters and history.** The status vocabulary (New / Assigned / In progress / Done), the priority labels,
  the status and date filters, and Show all history are unchanged.
- **Lease documents.** Lease grouping, Manage files, and rename/share/delete from the lease or property are kept.
  Review agreement & signatures and the signed PDF link to `lease` / `lease-mobile`. The tenant links to `people`, and
  View properties links to `properties`.
- **Data.** Only live data is used. No addendum, vendor or file was invented.

## 5. Verification (`design_screenshot`)

- **`maintenance`, revision 19.** The detail card had empty space, the "Unassigned · Assign →" link was tight and the
  board caption was awkward. All three were fixed at revision 23: a photo and alert row, an Assign vendor button and a
  shorter caption. Revision 23 has no clipping at 1280 px.
- **`maintenance-mobile`, revision 26.**
  - App bar, gradient band and stat carousel (clipped at the edge on purpose).
  - Ink urgent card and filter.
  - Grouped list and pinned tab bar.

  There is no horizontal overflow.
- **`documents`, revisions 31 and 36.**
  - At revision 31, the file rows wrapped (names, the Restricted badge and "756 B") and the 3:4 preview was too tall.
  - At revision 36, the file rows were restructured, but the depth limit forced a flatter row.
  - At revision 39, the Photo ID row was fixed with a lock icon and "· restricted access" in the name, and there is
    no wrapping at 1280 px.
- **`documents-mobile`, revision 42.** The type tabs clipped ("Photo…") and a caption wrapped. Both were fixed at
  revision 44 with three labelled selects and shorter captions.

Accessibility:

- Every icon action has a visible text label (Preview, Download, View, Assign vendor).
- Status always has a text label as well as colour.
- Text on ink and gradient uses the renderer's light ink.
- Badges sit on white.

## 6. Requests for shared adjustments (not applied)

- The `mobile-navigation` component has no Maintenance or Documents tab. Phone screens reach these sections from
  Home's repair stat and "Back to Home". A "More" tab, or the foundation's icon-button proposal with an Operations
  entry, would make them reachable directly. This needs manager authority.
- The `desktop-navigation` component still has no active state. The foundation proposal in section 3 would let these
  screens mark Maintenance or Documents.
