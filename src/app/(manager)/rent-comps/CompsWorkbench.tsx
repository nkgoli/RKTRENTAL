'use client';

import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { useActionState, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Alert, Badge, Card, CardHeader } from '@/components/ui';
import { EmptyState } from '@/components/RouteStates';
import { MAP, dollars, mapPins, suggestRent, summarize, type CompRow } from '@/lib/comps/core';
import { applyRentAction, type ApplyState } from './actions';
import { uncertainApply } from './apply-state';
import styles from './comps.module.css';

const usd = (value: number) => `$${value.toLocaleString('en-US')}`;
const shortDate = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    : '—';
const SOURCE_LABELS: Record<string, string> = {
  mock: 'Sandbox',
  rentrange: 'RentRange',
  rentometer: 'Rentometer',
};
const sourceLabel = (source?: string) =>
  source ? (SOURCE_LABELS[source.toLowerCase()] ?? source) : '—';

export type WorkbenchProps = {
  unitId: string;
  unitLabel: string;
  rows: CompRow[];
  radiusMiles: number;
  subjectSqft: number | null;
  listedRent: number | null;
  marketRent: number | null;
  currentLeaseRent?: number | null;
  propertyId?: string;
  providerName: string;
  syncedAt: string;
  cached: boolean;
  appliedNote: string | null;
  /** Reset-filters destination; defaults to the legacy `/rent-comps` href. */
  resetHref?: string;
  propertyLevel?: boolean;
  occupied?: boolean;
};

const initialApply: ApplyState = {};

async function applyWithRecovery(previous: ApplyState, formData: FormData): Promise<ApplyState> {
  const submittedRent = String(formData.get('rent') ?? '');
  try {
    return { ...(await applyRentAction(previous, formData)), submittedRent };
  } catch (error) {
    unstable_rethrow(error);
    // Network/framework response failures may occur after the server committed.
    return { ...uncertainApply, submittedRent };
  }
}

export function CompsWorkbench(props: WorkbenchProps) {
  const { rows, radiusMiles, subjectSqft, listedRent } = props;
  const baseline = props.currentLeaseRent ?? listedRent;
  const baselineLabel = props.currentLeaseRent != null ? 'current lease' : 'listed rent';
  const subjectKind = props.propertyLevel ? 'home' : 'unit';
  const [excluded, setExcluded] = useState<Set<string>>(
    () => new Set(rows.filter((row) => row.caveat).map((row) => row.id)),
  );
  const included = useMemo(() => rows.filter((row) => !excluded.has(row.id)), [rows, excluded]);
  const summary = useMemo(() => summarize(included), [included]);
  const suggestion = useMemo(
    () => suggestRent(included, subjectSqft, summary),
    [included, subjectSqft, summary],
  );
  const pins = useMemo(() => mapPins(rows, excluded, radiusMiles), [rows, excluded, radiusMiles]);
  const nearest = [...included].sort((a, b) => a.distanceMiles - b.distanceMiles).slice(0, 4);
  const [state, apply, pending] = useActionState(applyWithRecovery, initialApply);
  const [rentDraft, setRentDraft] = useState<string | null>(null);
  const rentValue = rentDraft ?? String(suggestion?.rent ?? '');
  const rentInput = useRef<HTMLInputElement>(null);
  const rentMessageId = useId();
  const showMessage =
    !pending && (state.submittedRent === rentValue || state.outcome === 'unknown');
  const savedRent = state.ok && state.rent !== undefined ? state.rent : props.marketRent;
  useEffect(() => {
    if (!pending && state.ok === false) rentInput.current?.focus();
  }, [pending, state]);

  const toggle = (id: string) =>
    setExcluded((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const spread = summary ? Math.max(summary.highRent - summary.lowRent, 1) : 1;
  const place = (value: number) => (summary ? ((value - summary.lowRent) / spread) * 300 : 0);
  const listPct =
    listedRent !== null && summary ? Math.min(300, Math.max(0, place(listedRent))) : null;

  return (
    <>
      <div className={styles.comparison}>
        <Card flush>
          <CardHeader
            title="Comparable rentals map"
            action={<Badge tone="info">{`Within ${radiusMiles} mi`}</Badge>}
          />
          <svg
            viewBox={`0 0 ${MAP.width} ${MAP.height}`}
            width="100%"
            style={{ display: 'block' }}
            role="img"
            aria-label={`Map of ${pins.length} comparable rentals within ${radiusMiles} miles of ${props.unitLabel}`}
            data-testid="comps-map"
          >
            <rect width={MAP.width} height={MAP.height} fill="var(--rr-subtle)" />
            <path
              d="M0 210 C150 170 300 250 640 190"
              stroke="#cbd5e1"
              strokeWidth="22"
              fill="none"
            />
            <path
              d="M0 80H640M0 160H640M120 0V300M300 0V300M470 0V300"
              stroke="#fff"
              strokeWidth="6"
            />
            <circle
              cx={MAP.cx}
              cy={MAP.cy}
              r={MAP.ringRadius}
              fill="var(--design-primary)"
              fillOpacity=".07"
              stroke="var(--design-primary)"
              strokeDasharray="6 6"
            />
            {pins.map((pin) => (
              <g key={pin.id} data-testid="comp-pin" data-included={pin.included}>
                <circle
                  cx={pin.x}
                  cy={pin.y}
                  r="9"
                  fill={pin.included ? 'var(--design-primary)' : 'var(--design-muted)'}
                  stroke="#fff"
                  strokeWidth="2"
                />
                <text
                  x={pin.x + 12}
                  y={pin.y - 10}
                  fontSize="11"
                  fontWeight="700"
                  fill="var(--design-text)"
                >
                  {pin.label}
                </text>
              </g>
            ))}
            <circle
              cx={MAP.cx}
              cy={MAP.cy}
              r="14"
              fill="var(--design-text)"
              stroke="#fff"
              strokeWidth="3"
            />
            <text
              x={MAP.cx + 22}
              y={MAP.cy - 4}
              fontSize="13"
              fontWeight="700"
              fill="var(--design-text)"
            >
              Subject {subjectKind}
            </text>
          </svg>
          <div className={styles.legend}>
            <span>
              <span style={{ color: 'var(--design-text)' }}>●</span> Subject {subjectKind}
            </span>
            <span>
              <span style={{ color: 'var(--design-primary)' }}>●</span> Included comp
            </span>
            <span>
              <span style={{ color: 'var(--design-muted)' }}>●</span> Excluded comp
            </span>
            <p>Schematic map: distance and direction from the {subjectKind}.</p>
          </div>
          <div className={styles.nearest}>
            <div className="row between" style={{ marginBottom: 6 }}>
              <strong style={{ fontSize: 14 }}>Nearest comps</strong>
              <span className="muted" style={{ fontSize: 12 }}>
                Closest included rentals
              </span>
            </div>
            {nearest.length === 0 && <p className="muted">No included comps.</p>}
            {nearest.map((row) => (
              <div key={row.id} className={styles.nearestRow}>
                <span>{row.address}</span>
                <span className="muted">{row.distanceMiles} mi</span>
                <strong>{usd(dollars(row.monthlyRentCents))}</strong>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Market summary"
            action={
              <Badge tone={summary ? 'success' : 'warning'}>
                {summary ? `${summary.count} comps` : 'No comps'}
              </Badge>
            }
          />
          {!summary || !suggestion ? (
            <p className="muted">
              Widen the radius, time frame or square footage, or include at least one comp to see a
              suggested rent.
            </p>
          ) : (
            <div className="stack">
              <div>
                <div className="row between muted" style={{ fontSize: 12 }}>
                  <span>Low {usd(summary.lowRent)}</span>
                  <span>Median {usd(summary.medianRent)}</span>
                  <span>High {usd(summary.highRent)}</span>
                </div>
                <svg viewBox="0 0 300 40" width="100%" aria-hidden="true">
                  <rect x="0" y="16" width="300" height="8" rx="4" fill="#cbd5e1" />
                  <rect
                    x={Math.max(0, Math.min(296, place(summary.medianRent) - 2))}
                    y="12"
                    width="4"
                    height="16"
                    fill="var(--design-primary)"
                  />
                  {listPct !== null && (
                    <circle
                      cx={listPct}
                      cy="20"
                      r="7"
                      fill="var(--design-text)"
                      stroke="#fff"
                      strokeWidth="2"
                    />
                  )}
                </svg>
                {listedRent !== null && (
                  <p className="muted" style={{ fontSize: 12 }}>
                    Dark marker: current list price {usd(listedRent)}
                  </p>
                )}
              </div>
              <dl className="kv" style={{ gridTemplateColumns: '130px 1fr' }}>
                <dt>Median $/sqft</dt>
                <dd>{summary.medianPerSqft ? `$${summary.medianPerSqft.toFixed(2)}` : '—'}</dd>
                <dt>Comp age</dt>
                <dd>
                  {summary.medianAgeDays !== null
                    ? `${Math.round(summary.medianAgeDays)} days (median)`
                    : 'Not set'}
                </dd>
                {props.currentLeaseRent !== undefined && (
                  <>
                    <dt>Current lease</dt>
                    <dd>
                      {props.currentLeaseRent === null ? 'Not set' : usd(props.currentLeaseRent)}
                    </dd>
                  </>
                )}
                <dt>Listed rent</dt>
                <dd>
                  {listedRent !== null
                    ? `${usd(listedRent)}${subjectSqft ? ` · $${(listedRent / subjectSqft).toFixed(2)}/sqft` : ''}`
                    : 'Not set'}
                </dd>
                <dt>Market rent</dt>
                <dd data-testid="current-market-rent">
                  {savedRent !== null ? usd(savedRent) : 'Not set'}
                </dd>
              </dl>
              {!subjectSqft && (
                <p className="muted">Not adjusted for size. Suggestion uses median rent.</p>
              )}
              <div className={styles.suggestion}>
                <p className="eyebrow">Suggested rent</p>
                <div className={styles.suggestionValue} data-testid="suggested-rent">
                  {usd(suggestion.rent)}
                </div>
                {baseline !== null && suggestion.rent !== baseline && (
                  <span className={`delta ${suggestion.rent > baseline! ? 'up' : 'down'}`}>
                    {suggestion.rent > baseline! ? '↑' : '↓'}{' '}
                    {usd(Math.abs(suggestion.rent - baseline!))}{' '}
                    {suggestion.rent > baseline! ? 'over' : 'under'} {baselineLabel}
                  </span>
                )}
                <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>
                  Range {usd(suggestion.rangeLow)} – {usd(suggestion.rangeHigh)}. Confidence:{' '}
                  {suggestion.confidence} ({summary.count} comps within {radiusMiles} mi,{' '}
                  {summary.withinOneMile} within 1 mi).
                </p>
              </div>
              <form
                action={apply}
                aria-label="Apply market rent"
                aria-busy={pending}
                className="stack"
                style={{ gap: 8 }}
              >
                <input type="hidden" name="unitId" value={props.unitId} />
                <label className="field">
                  Market rent to apply ($ / month)
                  <input
                    ref={rentInput}
                    name="rent"
                    inputMode="decimal"
                    value={rentValue}
                    onChange={(event) => setRentDraft(event.target.value)}
                    readOnly={pending}
                    aria-invalid={showMessage && !!state.inputError}
                    aria-describedby={showMessage && state.message ? rentMessageId : undefined}
                    required
                  />
                </label>
                <button className="btn btn-primary btn-block" disabled={pending}>
                  {pending ? 'Applying…' : `Apply to ${props.unitLabel}`}
                </button>
                <p className={styles.scopeNote}>
                  Updates the saved market rent for this {subjectKind}. Existing lease and listed
                  rent stay unchanged.
                </p>
                {pending && <p role="status">Applying market rent…</p>}
                {showMessage && state.message && (
                  <p
                    id={rentMessageId}
                    role={state.ok ? 'status' : 'alert'}
                    className={state.ok ? 'delta up' : 'delta down'}
                  >
                    {state.ok
                      ? `${state.message} Now ${usd(state.rent ?? 0)} / month.`
                      : state.message}
                  </p>
                )}
              </form>
              {props.appliedNote && (
                <p className="muted" style={{ fontSize: 12 }} data-testid="applied-note">
                  {props.appliedNote}
                </p>
              )}
              <Link
                className="btn btn-secondary btn-block"
                href={`/leases/new?unit=${encodeURIComponent(props.unitId)}${props.propertyId ? `&property=${encodeURIComponent(props.propertyId)}` : ''}`}
              >
                {props.occupied ? 'Use for renewal' : 'Create lease'}
              </Link>
            </div>
          )}
        </Card>
      </div>

      <Card flush>
        <CardHeader
          title="Comparable rentals"
          action={
            <span className="muted">
              {rows.length} comps found · {included.length} included · Uncheck a comp to exclude it
              from the summary
            </span>
          }
        />
        <div
          className={styles.tableWrap}
          role="region"
          aria-label="Comparable rentals table"
          tabIndex={0}
        >
          <table className="table" aria-label="Comparable rentals">
            <thead>
              <tr>
                <th scope="col" aria-label="Include" />
                <th scope="col">Address</th>
                <th scope="col" className="num">
                  Dist.
                </th>
                <th scope="col">Bd/Ba</th>
                <th scope="col" className="num">
                  Sqft
                </th>
                <th scope="col" className="num">
                  Rent
                </th>
                <th scope="col" className="num">
                  $/sqft
                </th>
                <th scope="col">Status</th>
                <th scope="col">Date</th>
                <th scope="col">Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10}>
                    <EmptyState
                      title="No comparable rentals match"
                      description="Widen the search filters to see more nearby rentals."
                      action="Reset filters"
                      href={props.resetHref ?? `/rent-comps?unit=${props.unitId}`}
                    />
                  </td>
                </tr>
              )}
              {rows.map((row) => {
                const off = excluded.has(row.id);
                return (
                  <tr key={row.id} className={off ? styles.excluded : undefined}>
                    <td>
                      <input
                        type="checkbox"
                        checked={!off}
                        onChange={() => toggle(row.id)}
                        aria-label={`Include ${row.address}`}
                      />
                    </td>
                    <td>
                      <strong>{row.address}</strong>
                      {row.caveat && (
                        <>
                          <br />
                          <small className="muted">
                            {off ? 'Excluded' : 'Note'}: {row.caveat}
                          </small>
                        </>
                      )}
                    </td>
                    <td className="num">{row.distanceMiles} mi</td>
                    <td>
                      {row.bedrooms}/{row.bathrooms ?? '—'}
                    </td>
                    <td className="num">{row.squareFeet}</td>
                    <td className="num">{usd(dollars(row.monthlyRentCents))}</td>
                    <td className="num">
                      ${(row.monthlyRentCents / 100 / row.squareFeet).toFixed(2)}
                    </td>
                    <td>
                      {row.status && (
                        <Badge tone={row.status === 'leased' ? 'success' : 'info'}>
                          {row.status === 'leased' ? 'Leased' : 'Listed'}
                        </Badge>
                      )}
                    </td>
                    <td>{shortDate(row.observedAt)}</td>
                    <td>{sourceLabel(row.source)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className={styles.sources}>
        <Alert>
          <div>
            <strong>Data source: {sourceLabel(props.providerName)}</strong>
            <br />
            Demo comps · not live market data. Sandbox responses from this build.{' '}
            <Link href="/integrations">Manage in Integrations</Link>. Last synced {props.syncedAt}
            {props.cached ? ' (cached for this unit)' : ''}.
          </div>
        </Alert>
        <Alert tone="warning">
          <div>
            <strong>Fair housing</strong>
            <br />
            Rent suggestions use property features only (location, size, beds, baths, amenities,
            condition), never tenant characteristics.
          </div>
        </Alert>
      </div>
    </>
  );
}
