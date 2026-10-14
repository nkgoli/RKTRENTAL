# Manager help

Sign in at `/sign-in` with your manager account (in the demo seed:
`jordan.mills@rocketrental.example`). Managers land on `/dashboard`, which
summarises occupancy, rent due and open work across the portfolio.

## Day to day

- **Properties** (`/properties`) — add properties and units, set listed and
  market rent, archive units you no longer manage. Each property page shows
  its units, documents and maintenance history.
- **Tenants** (`/tenants`) — keep tenant contact and emergency-contact
  details, notes, and move-in/move-out status in one place.
- **Leases** (`/leases`) — create a lease with the wizard (unit, tenants,
  dates, rent, deposit, clauses), send it for e-signature, and follow signing
  events on the lease page. Tenants sign through the mock e-sign flow in
  sandbox mode.
- **Applications** (`/applications`) — review applications, confirm the
  applicant's screening consent, then run screening. A current FCRA consent
  is required before the screening provider can be contacted.
- **Payments** (`/payments`) — review charges and payments, refunds and
  payouts. Charges, late fees and balances live on the lease ledger; provider
  webhooks update payment status automatically (see the deployment guide).
- **Maintenance** (`/maintenance`) — triage requests by priority, assign a
  vendor, move them New -> Assigned -> In progress -> Done, and attach
  photos. Tenants see status updates on their repairs page.
- **Documents** (`/documents`) — upload lease documents, notices, inspection
  reports and photos (PDF/JPG/PNG/HEIC/DOC/DOCX, up to 25 MB) against a
  lease, property or unit.
- **Expenses and returns** (`/returns`) — record expenses per property and
  review NOI, cash flow, cap rate, cash-on-cash return, ROI and yield.
- **Rent comps** (`/rent-comps`) — compare a unit's rent with nearby comps
  before setting market rent.
- **Integrations** (`/integrations`) — connect or disconnect payment,
  screening and comps providers, check their health, and review webhook
  failures. Until you connect live credentials, everything runs in sandbox
  mode and no real money or applicant data moves.

## Tips

- Use the dashboard's expiring-lease and arrears lists as your morning queue.
- Keep provider errors from Integrations visible: a failed webhook means a
  payment or screening result is still pending, not lost — providers retry.
- Archive rather than delete: archived units keep their lease and document
  history for reporting.
