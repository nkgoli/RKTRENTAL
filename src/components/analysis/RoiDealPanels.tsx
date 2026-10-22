'use client';
import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import type { AnalysisPayload } from '@/lib/analysis/contract';
import { projectionRows, type ProjectionResult } from '@/lib/analysis/projections';
import { firstPositiveAfterNegative, wholeDollars } from '@/lib/analysis/chart-data';
import { riskFactors, riskLevel, riskScore, sortFactors } from '@/lib/analysis/deal-insights';
import { DeltaNote } from './RoiWhatIf';
import d from './deal-panels.module.css';
const pct = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? 'Unavailable' : `${(v * 100).toFixed(2)}%`;
const ratio = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? 'Unavailable' : `${v.toFixed(2)}×`;
/** KPI tile that opens its breakdown on click, tap or Enter; Escape or outside click closes. */
function Popover({
  trigger,
  title,
  children,
  variant,
}: {
  trigger: ReactNode;
  title: string;
  children: ReactNode;
  /** `lead`: the band's headline figure; `stat`: a quiet inset stat card. */
  variant: 'lead' | 'stat';
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  return (
    <div
      className={`${d.pop} ${variant === 'lead' ? d.leadPop : d.statPop}`}
      ref={box}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          setOpen(false);
          box.current?.querySelector('button')?.focus();
        }
      }}
    >
      <button
        type="button"
        className={variant === 'lead' ? d.lead : `summary-stat ${d.stat}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={d.tileInfo} aria-hidden="true">
          ⓘ
        </span>
        {trigger}
      </button>
      {open && (
        <div className={d.popPanel} id={id} role="dialog" aria-label={title}>
          <p className={d.popTitle}>{title}</p>
          {children}
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: string;
  total?: boolean;
  tone?: string;
}) {
  return (
    <div className={d.popRow} data-total={total || undefined}>
      <span>{label}</span>
      <b data-tone={tone}>{value}</b>
    </div>
  );
}

/**
 * Year-1 summary band (Designs/redisgn): the projected monthly or annual cash flow leads, with
 * cash-on-cash, cap rate and debt coverage as quiet insets. Every figure opens its exact
 * breakdown; the risk meter appears only when a score exists and its factors open on demand.
 */
export function DealSnapshot({
  result,
  payload,
  onCompare,
  howHref,
  onHow,
  baseline,
}: {
  result: ProjectionResult;
  payload: AnalysisPayload;
  /** While a what-if is active: the baseline, so each figure shows its signed change. */
  baseline?: ProjectionResult | null;
  /** Opens the actual-versus-projected comparison. */
  onCompare?: () => void;
  /** Where "How returns are calculated" points (an in-page method note). */
  howHref?: string;
  onHow?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const [annual, setAnnual] = useState(false);
  const m = result.summaryMetrics;
  const b = baseline?.summaryMetrics;
  const factors = sortFactors(riskFactors(result, payload.input.financing?.interestRate));
  const score = riskScore(factors);
  const level = score == null ? null : riskLevel(score);
  const rows = projectionRows(result);
  const lead = annual ? m.annualCashFlow : m.monthlyCashFlow;
  const turn = firstPositiveAfterNegative(rows.map((row) => row.cashFlow));
  const outlook =
    rows.length === 0
      ? null
      : rows[0].cashFlow >= 0
        ? 'positive from Year 1'
        : turn != null
          ? `turns positive in Year ${rows[turn].year}`
          : `stays below $0 through Year ${rows.length}`;
  const debt =
    m.loanAmount > 0
      ? `Projected cash flow after ${wholeDollars(m.annualDebtService)} debt service`
      : 'Projected cash flow with no debt service';
  return (
    <section className={`summary-band ${d.band}`} aria-label="Deal Snapshot">
      <div className="summary-band-main">
        <div className={d.bandHead}>
          <p className="eyebrow">Year 1 · Projected estimate · before tax · USD</p>
          <div className={d.darkToggle} role="group" aria-label="Snapshot timeframe">
            {['Monthly', 'Annual'].map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={(t === 'Annual') === annual}
                onClick={() => setAnnual(t === 'Annual')}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <Popover
          variant="lead"
          title="Cash flow breakdown"
          trigger={
            <>
              <span className={d.srOnly}>Cash flow </span>
              <span className={`summary-band-value${lead < 0 ? ' danger' : ''}`}>
                <strong>{wholeDollars(lead)}</strong>
                <span className={d.per}> / {annual ? 'year' : 'month'}</span>
              </span>
            </>
          }
        >
          <Row label="Annual NOI" value={wholeDollars(m.noi)} />
          <Row label="Capital reserves" value={wholeDollars(result.expenseBreakdown.capex)} />
          <Row label="Debt service" value={wholeDollars(m.annualDebtService)} />
          <Row label="Annual cash flow" value={wholeDollars(m.annualCashFlow)} total />
        </Popover>
        {b && (
          <DeltaNote
            kind="money"
            baseline={annual ? b.annualCashFlow : b.monthlyCashFlow}
            simulated={lead}
          />
        )}
        <p className="summary-band-detail">
          {debt} · {wholeDollars(m.annualCashFlow)} for Year 1{outlook ? ` · ${outlook}` : ''}
        </p>
        {score != null && level && (
          <div className={d.meter}>
            <span>
              Risk score {Math.round(score)} of 100 · {level.level}
            </span>
            <span
              className={d.meterBar}
              role="meter"
              aria-label="Risk score"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(score)}
              aria-valuetext={`${Math.round(score)} of 100, ${level.level}`}
            >
              <span style={{ width: `${Math.round(score)}%`, background: level.color }} />
            </span>
          </div>
        )}
        <div className="summary-band-foot">
          {onCompare && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onCompare}>
              Compare with actuals →
            </button>
          )}
          {howHref && (
            <a className={d.how} href={howHref} onClick={onHow}>
              How returns are calculated →
            </a>
          )}
        </div>
        <details className={d.riskDisclosure}>
          <summary>
            What drives the risk score
            {score == null ? ' · unavailable' : ''}
          </summary>
          <p className={d.muted}>
            Weighted heuristic, not advice. Higher means riskier; missing inputs are excluded.
          </p>
          {factors.map((f) => (
            <div key={f.name} className={d.factor}>
              <span>{f.name}</span>
              <progress max={100} value={f.score ?? 0} aria-label={`${f.name} risk`} />
              <b>{f.description}</b>
            </div>
          ))}
        </details>
      </div>
      <div className="summary-band-stats stack-details">
        <Popover
          variant="stat"
          title="Cash-on-cash return"
          trigger={
            <>
              <span className="summary-stat-label">Cash-on-cash · Year 1</span>
              <strong data-tone={(m.cashOnCash ?? 0) < 0 ? 'red' : undefined}>
                {pct(m.cashOnCash)}
              </strong>
              <small>Projected cash flow ÷ cash invested</small>
              {b && <DeltaNote kind="percent" baseline={b.cashOnCash} simulated={m.cashOnCash} />}
            </>
          }
        >
          <Row label="Annual cash flow" value={wholeDollars(m.annualCashFlow)} />
          <Row label="Total cash invested" value={wholeDollars(m.totalCashRequired)} />
          <Row label="Cash-on-cash return" value={pct(m.cashOnCash)} total />
        </Popover>
        <Popover
          variant="stat"
          title="Capitalization rate"
          trigger={
            <>
              <span className="summary-stat-label">Cap rate · Year 1</span>
              <strong>{pct(m.capRate)}</strong>
              <small>Projected NOI {wholeDollars(m.noi)} ÷ purchase price</small>
              {b && <DeltaNote kind="percent" baseline={b.capRate} simulated={m.capRate} />}
            </>
          }
        >
          <Row label="Annual NOI" value={wholeDollars(m.noi)} />
          <Row label="Purchase price" value={wholeDollars(m.purchasePrice)} />
          <Row label="Cap rate" value={pct(m.capRate)} total />
        </Popover>
        <Popover
          variant="stat"
          title="Debt service coverage"
          trigger={
            <>
              <span className="summary-stat-label">Debt service coverage</span>
              <strong>{m.loanAmount > 0 ? ratio(m.dscr) : 'No debt'}</strong>
              <small>
                {m.loanAmount > 0
                  ? 'Year 1 NOI ÷ debt service · lenders look for 1.20×+'
                  : 'No loan in these assumptions'}
              </small>
              {b && m.loanAmount > 0 && b.loanAmount > 0 && (
                <DeltaNote kind="ratio" baseline={b.dscr} simulated={m.dscr} />
              )}
            </>
          }
        >
          <Row label="Net operating income" value={wholeDollars(m.noi)} />
          <Row label="Annual debt service" value={wholeDollars(m.annualDebtService)} />
          <Row label="DSCR" value={m.loanAmount > 0 ? ratio(m.dscr) : 'No debt'} total />
        </Popover>
      </div>
    </section>
  );
}
