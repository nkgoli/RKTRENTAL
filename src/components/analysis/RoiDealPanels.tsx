'use client';
import {
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AnalysisPayload } from '@/lib/analysis/contract';
import type { ProjectionResult } from '@/lib/analysis/projections';
import { wholeDollars } from '@/lib/analysis/chart-data';
import {
  applyLevers,
  levers as leverRows,
  riskFactors,
  riskLevel,
  riskScore,
  runInput,
  sortFactors,
  targetFixes,
  type LeverKey,
} from '@/lib/analysis/deal-insights';
import { ChartCard } from './RoiChart';
import d from './deal-panels.module.css';
const pct = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? 'Unavailable' : `${(v * 100).toFixed(2)}%`;
const ratio = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? 'Unavailable' : `${v.toFixed(2)}x`;
/** KPI tile that opens its breakdown on click, tap or Enter; Escape or outside click closes. */
function Popover({
  trigger,
  title,
  children,
}: {
  trigger: ReactNode;
  title: string;
  children: ReactNode;
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
      className={d.pop}
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
        className={d.tile}
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

/** The four decision metrics lead; exact breakdowns and risk factors open on demand. */
export function DealSnapshot({
  result,
  payload,
}: {
  result: ProjectionResult;
  payload: AnalysisPayload;
}) {
  const [annual, setAnnual] = useState(false);
  const m = result.summaryMetrics;
  const factors = sortFactors(riskFactors(result, payload.input.financing?.interestRate));
  const score = riskScore(factors);
  const level = score == null ? null : riskLevel(score);
  return (
    <section className={d.snapshot} aria-label="Deal Snapshot">
      <div className={d.snapHead}>
        <div className={d.snapTitle}>
          <h2>Year 1 at a glance</h2>
          <span className={d.muted}>Projected, before tax</span>
        </div>
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
      <div className={d.kpis}>
        <Popover
          title="Cash flow breakdown"
          trigger={
            <>
              <small>Cash flow</small>
              <strong data-tone={m.annualCashFlow < 0 ? 'red' : undefined}>
                {wholeDollars(annual ? m.annualCashFlow : m.monthlyCashFlow)}
              </strong>
              <span>Year 1, {annual ? 'annual' : 'monthly'}</span>
            </>
          }
        >
          <Row label="Annual NOI" value={wholeDollars(m.noi)} />
          <Row label="Capital reserves" value={wholeDollars(result.expenseBreakdown.capex)} />
          <Row label="Debt service" value={wholeDollars(m.annualDebtService)} />
          <Row label="Annual cash flow" value={wholeDollars(m.annualCashFlow)} total />
        </Popover>
        <Popover
          title="Cash-on-cash return"
          trigger={
            <>
              <small>Cash-on-cash</small>
              <strong>{pct(m.cashOnCash)}</strong>
              <span>Year 1, cash / invested</span>
            </>
          }
        >
          <Row label="Annual cash flow" value={wholeDollars(m.annualCashFlow)} />
          <Row label="Total cash invested" value={wholeDollars(m.totalCashRequired)} />
          <Row label="Cash-on-cash return" value={pct(m.cashOnCash)} total />
        </Popover>
        <Popover
          title="Capitalization rate"
          trigger={
            <>
              <small>Cap rate</small>
              <strong>{pct(m.capRate)}</strong>
              <span>NOI / purchase price</span>
            </>
          }
        >
          <Row label="Annual NOI" value={wholeDollars(m.noi)} />
          <Row label="Purchase price" value={wholeDollars(m.purchasePrice)} />
          <Row label="Cap rate" value={pct(m.capRate)} total />
        </Popover>
        <Popover
          title="Debt service coverage"
          trigger={
            <>
              <small>DSCR</small>
              <strong>{m.loanAmount > 0 ? ratio(m.dscr) : 'No debt'}</strong>
              <span>Year 1, NOI / debt service</span>
            </>
          }
        >
          <Row label="Net operating income" value={wholeDollars(m.noi)} />
          <Row label="Annual debt service" value={wholeDollars(m.annualDebtService)} />
          <Row label="DSCR" value={m.loanAmount > 0 ? ratio(m.dscr) : 'No debt'} total />
        </Popover>
      </div>
      <details className={d.riskDisclosure}>
        <summary>
          Risk {score == null ? 'unavailable' : Math.round(score)}
          {level ? ` - ${level.level}` : ''}
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
    </section>
  );
}

/** Temporary what-if calculations stay separate from saved property assumptions. */
export function FixMyDeal({
  result,
  payload,
}: {
  result: ProjectionResult;
  payload: AnalysisPayload;
}) {
  const deferred = useDeferredValue(payload);
  const [selected, setSelected] = useState<LeverKey[]>([]);
  const [active, setActive] = useState<LeverKey[]>([]);
  const rows = useMemo(() => leverRows(deferred, result), [deferred, result]);
  const targets = useMemo(() => targetFixes(deferred, result), [deferred, result]);
  const [selectedTargets, setSelectedTargets] = useState<number[]>([]);
  const [activeTargets, setActiveTargets] = useState<number[]>([]);
  const whatIf = useMemo(() => {
    if (!active.length && !activeTargets.length) return null;
    let input = applyLevers(deferred.input, active);
    for (const index of activeTargets) input = targets[index]?.apply(input) ?? input;
    return runInput(deferred, input);
  }, [deferred, active, activeTargets, targets]);
  return (
    <ChartCard
      title="Suggested changes"
      subtitle="Explore a temporary what-if. Saved property assumptions stay unchanged."
    >
      <p role="status" aria-live="polite" className={d.cashHeadline}>
        Year 1 cash flow: {wholeDollars(result.summaryMetrics.annualCashFlow)}
        {whatIf ? ` to ${wholeDollars(whatIf.summaryMetrics.annualCashFlow)}` : ''}
      </p>
      <div className={d.suggestions}>
        {rows.map((row) => (
          <label key={row.key} className={d.suggestion}>
            <input
              type="checkbox"
              checked={selected.includes(row.key)}
              disabled={row.value == null}
              onChange={() =>
                setSelected((list) =>
                  list.includes(row.key)
                    ? list.filter((key) => key !== row.key)
                    : [...list, row.key],
                )
              }
            />
            <span>
              {row.name} <small>{row.change}</small>
            </span>
            <span>
              {row.value == null
                ? 'Unavailable'
                : `${row.value >= 0 ? '+' : ''}${wholeDollars(row.value)}/yr`}
            </span>
          </label>
        ))}
      </div>
      {!!targets.length && (
        <details className={d.riskDisclosure}>
          <summary>Target thresholds</summary>
          {targets.map((target, index) => (
            <label className={d.suggestion} key={target.lever}>
              <input
                type="checkbox"
                checked={selectedTargets.includes(index)}
                onChange={() =>
                  setSelectedTargets((list) =>
                    list.includes(index)
                      ? list.filter((value) => value !== index)
                      : [...list, index],
                  )
                }
              />
              <span>
                {target.lever}:{' '}
                {target.lever === 'Rent'
                  ? wholeDollars(target.target)
                  : `${target.target.toFixed(2)}%`}
                <small>{target.outcome}</small>
              </span>
            </label>
          ))}
        </details>
      )}
      <div className={d.suggestionActions}>
        <button
          type="button"
          disabled={!selected.length && !selectedTargets.length}
          onClick={() => {
            setActive(selected);
            setActiveTargets(selectedTargets);
          }}
        >
          Apply selected
        </button>
        <button
          type="button"
          onClick={() => {
            setActive([]);
            setSelected([]);
            setActiveTargets([]);
            setSelectedTargets([]);
          }}
        >
          Reset
        </button>
      </div>
    </ChartCard>
  );
}
