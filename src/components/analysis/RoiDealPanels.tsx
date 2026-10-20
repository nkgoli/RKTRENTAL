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
import { wealthAt, wholeDollars } from '@/lib/analysis/chart-data';
import {
  applyLevers,
  improvements,
  levers as leverRows,
  riskFactors,
  riskLevel,
  riskScore,
  runInput,
  segmentColor,
  sortFactors,
  targetFixes,
  type LeverKey,
  type RiskFactor,
} from '@/lib/analysis/deal-insights';
import { ChartCard, Icon } from './RoiChart';
import d from './deal-panels.module.css';

const pct = (v: number | null | undefined, digits = 2) =>
  v == null || !Number.isFinite(v) ? 'Unavailable' : `${(v * 100).toFixed(digits)}%`;
const ratio = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? 'Unavailable' : `${v.toFixed(2)}x`;
const k = (v: number) => `$${Math.round(v / 1000).toLocaleString('en-US')}`;

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

/** Five-segment red → emerald track with a pill at `position` (0 worst … 100 best). */
function SegmentBar({ position, size = 12 }: { position: number; size?: number }) {
  const p = Math.max(0, Math.min(100, position));
  return (
    <span className={d.segments} aria-hidden="true">
      <span className={d.track}>
        <i style={{ background: '#f87171' }} />
        <i style={{ background: '#fb923c' }} />
        <i style={{ background: '#facc15' }} />
        <i style={{ background: '#a3e635' }} />
        <i style={{ background: '#10b981' }} />
      </span>
      <span
        className={d.pill}
        style={{
          left: `calc(${p}% - ${size / 2}px)`,
          width: size,
          height: size,
          background: segmentColor(p),
        }}
      />
    </span>
  );
}

/** Reference "What to change" lead for the worst factor (RiskMeter narrative). */
const hint: Record<string, string> = {
  DSCR: 'Increase rent to boost NOI',
  'Cash-on-Cash': 'Increase monthly rent',
  'Break-even': 'Increase rent to lower the ratio',
  'Cap Spread': 'Negotiate a lower purchase price (raises cap rate)',
  LTV: 'Increase your down payment',
  OER: 'Reduce property management fee',
};

const statusLabel = { good: 'Good', warning: 'Watch', danger: 'Risk', unavailable: 'N/A' } as const;

function FactorRow({ f, dark }: { f: RiskFactor; dark?: boolean }) {
  return (
    <div className={d.factor} data-dark={dark || undefined}>
      <span className={d.factorName}>{f.name}</span>
      {f.score == null ? (
        <span className={d.unavailable}>Input missing — not scored</span>
      ) : (
        <SegmentBar position={100 - f.score} />
      )}
      <b data-status={f.status}>{f.description}</b>
    </div>
  );
}

function Gauge({ score, color }: { score: number; color: string }) {
  const cx = 90;
  const cy = 75;
  const r = 60;
  const arc = (a0: number, a1: number) => {
    const p = (a: number) =>
      `${cx + r * Math.cos((a * Math.PI) / 180)} ${cy + r * Math.sin((a * Math.PI) / 180)}`;
    return `M ${p(a0)} A ${r} ${r} 0 0 1 ${p(a1)}`;
  };
  const needle = ((-180 + (score / 100) * 180) * Math.PI) / 180;
  return (
    <svg width="160" height="72" viewBox="0 0 180 80" aria-hidden="true">
      <path
        d={arc(-180, 0)}
        fill="none"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <path
        d={arc(-180, -144)}
        fill="none"
        stroke="#14b8a6"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <path d={arc(-144, -108)} fill="none" stroke="#65a30d" strokeWidth="10" />
      <path d={arc(-108, -72)} fill="none" stroke="#eab308" strokeWidth="10" />
      <path d={arc(-72, -36)} fill="none" stroke="#f97316" strokeWidth="10" />
      <path d={arc(-36, 0)} fill="none" stroke="#ef4444" strokeWidth="10" strokeLinecap="round" />
      <line
        x1={cx}
        y1={cy}
        x2={cx + 45 * Math.cos(needle)}
        y2={cy + 45 * Math.sin(needle)}
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r="6" fill={color} />
      <circle cx={cx} cy={cy} r="3" fill="white" />
    </svg>
  );
}

/**
 * C3 Deal Snapshot: dark Year-1 band with KPI popovers and the compact risk
 * meter. The risk score is one number with one meaning (higher = riskier) on
 * both the ring and the gauge, unlike the reference's 27 "Deal Score" vs 73.
 */
export function DealSnapshot({
  result,
  payload,
}: {
  result: ProjectionResult;
  payload: AnalysisPayload;
}) {
  const [annual, setAnnual] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const m = result.summaryMetrics;
  const input = payload.input;
  const rate = input.financing?.interestRate;
  const factors = useMemo(() => riskFactors(result, rate), [result, rate]);
  const sorted = sortFactors(factors);
  const score = riskScore(factors);
  const level = score == null ? null : riskLevel(score);
  const deferred = useDeferredValue(payload);
  const fixes = useMemo(
    () => (expanded ? improvements(deferred, result) : []),
    [expanded, deferred, result],
  );
  const cash = annual ? m.annualCashFlow : m.monthlyCashFlow;
  const financed = m.loanAmount > 0;
  const status =
    financed && m.dscr != null && m.dscr < 1
      ? { label: 'Needs Support', tone: 'red' }
      : financed && m.dscr != null && m.dscr < 1.25
        ? { label: 'Marginal', tone: 'amber' }
        : m.monthlyCashFlow < 0
          ? { label: 'Negative CF', tone: 'amber' }
          : { label: 'Healthy', tone: 'teal' };
  const five = wealthAt(result, Math.min(5, result.annualCashflows.length));
  const rent = input.income?.monthlyRent;
  const vacancy = input.income?.vacancyRate;
  const appreciation = input.appreciationExit?.annualAppreciation;
  const breakdown = [
    ['Down payment', m.purchasePrice - m.loanAmount],
    ['Closing costs', input.purchase?.closingCosts ?? 0],
    ['Rehab/Renovation', input.purchase?.rehabCosts ?? 0],
    ['Furnishing', input.purchase?.furnishingCosts ?? 0],
    ['Loan points', (m.loanAmount * (input.financing?.pointsPaid ?? 0)) / 100],
    ['Lender fees', input.financing?.lenderFees ?? 0],
  ].filter(([, v]) => (v as number) > 0) as [string, number][];
  const dscrTone = (v: number | null) =>
    v == null ? undefined : v >= 1.25 ? 'teal' : v >= 0.9 ? 'amber' : 'red';
  return (
    <section className={d.snapshot} aria-label="Deal Snapshot">
      <div className={d.snapHead}>
        <div className={d.snapTitle}>
          <h2>Deal Snapshot</h2>
          <span className={d.muted}>(Year 1)</span>
          <span className={d.status} data-tone={status.tone}>
            {status.label}
          </span>
        </div>
        <div className={d.snapTitle}>
          <span className={d.assumptions}>
            {rent != null && `${wholeDollars(rent)}/mo`}
            {vacancy != null && ` · ${vacancy}% vac`}
            {rate != null && financed && ` · ${rate}% rate`}
          </span>
          <div className={d.darkToggle} role="group" aria-label="Snapshot timeframe">
            {(['Monthly', 'Annual'] as const).map((t) => (
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
      </div>
      <div className={d.snapBody}>
        <dl className={d.side}>
          <p className={d.sideTitle}>Snapshot</p>
          <div>
            <dt>Year 1 NOI</dt>
            <dd data-tone="teal">
              {k(m.noi)}
              <small>k</small>
            </dd>
          </div>
          <div>
            <dt>Rent</dt>
            <dd>
              {rent == null ? 'Unavailable' : wholeDollars(rent)}
              <small>/mo</small>
            </dd>
          </div>
          <div>
            <dt>Price</dt>
            <dd>
              {k(m.purchasePrice)}
              <small>k</small>
            </dd>
          </div>
          <div>
            <dt>Appreciation</dt>
            <dd data-tone="teal">{appreciation == null ? 'Unavailable' : `${appreciation}%`}</dd>
          </div>
          <div>
            <dt>{five ? `${five.year}-Yr Returns` : '5-Yr Returns'}</dt>
            <dd data-tone={five && five.total < 0 ? 'red' : 'teal'}>
              {five ? wholeDollars(five.total) : 'Unavailable'}
            </dd>
          </div>
        </dl>
        <div className={d.main}>
          <div className={d.kpis}>
            <Popover
              title="Cash flow breakdown"
              trigger={
                <>
                  <small>Cash Flow</small>
                  <strong
                    data-tone={
                      cash >= 0 ? 'teal' : cash >= (annual ? -2400 : -200) ? 'amber' : 'red'
                    }
                  >
                    {wholeDollars(cash)}
                  </strong>
                  <span>Y1 {annual ? 'annual' : 'monthly'}, after debt & reserves</span>
                </>
              }
            >
              <Row label="NOI (monthly)" value={wholeDollars(m.noi / 12)} />
              <Row
                label="− Capital reserves"
                value={wholeDollars(result.expenseBreakdown.capex / 12)}
              />
              <Row label="− Debt service" value={wholeDollars(m.monthlyDebtService)} />
              <Row
                label="Monthly"
                value={wholeDollars(m.monthlyCashFlow)}
                total
                tone={m.monthlyCashFlow >= 0 ? 'teal' : 'red'}
              />
              <Row
                label="Annual"
                value={wholeDollars(m.annualCashFlow)}
                tone={m.annualCashFlow >= 0 ? 'teal' : 'red'}
              />
            </Popover>
            <Popover
              title="Debt service coverage"
              trigger={
                <>
                  <small>DSCR</small>
                  <strong data-tone={financed ? dscrTone(m.dscr) : 'teal'}>
                    {financed ? ratio(m.dscr) : 'No debt'}
                  </strong>
                  <span>Y1, ≥1.25 lender-ready</span>
                </>
              }
            >
              <Row label="Net operating income" value={wholeDollars(m.noi)} />
              <Row label="÷ Annual debt service" value={wholeDollars(m.annualDebtService)} />
              <Row
                label="DSCR"
                value={financed ? ratio(m.dscr) : 'No debt'}
                total
                tone={financed ? dscrTone(m.dscr) : 'teal'}
              />
              <p className={d.popNote}>
                {!financed
                  ? 'No loan is modeled.'
                  : m.dscr != null && m.dscr >= 1.25
                    ? '✓ Lender-ready'
                    : m.dscr != null && m.dscr >= 1
                      ? '⚠ Breakeven'
                      : '✗ Negative coverage'}
              </p>
            </Popover>
            <Popover
              title="Cash-on-cash return"
              trigger={
                <>
                  <small>CoC Return</small>
                  <strong
                    data-tone={
                      m.cashOnCash == null
                        ? undefined
                        : m.cashOnCash >= 0.08
                          ? 'teal'
                          : m.cashOnCash >= 0
                            ? 'amber'
                            : 'red'
                    }
                  >
                    {pct(m.cashOnCash)}
                  </strong>
                  <span>Y1, cash ÷ invested</span>
                </>
              }
            >
              <Row label="Annual cash flow" value={wholeDollars(m.annualCashFlow)} />
              <Row label="÷ Total cash invested" value={wholeDollars(m.totalCashRequired)} />
              <Row label="CoC return" value={pct(m.cashOnCash)} total />
            </Popover>
            <Popover
              title="Capitalization rate"
              trigger={
                <>
                  <small>Cap Rate</small>
                  <strong
                    data-tone={m.capRate >= 0.06 ? 'teal' : m.capRate >= 0.04 ? undefined : 'amber'}
                  >
                    {pct(m.capRate)}
                  </strong>
                  <span>NOI ÷ price, unlevered</span>
                </>
              }
            >
              <Row label="Net operating income" value={wholeDollars(m.noi)} />
              <Row label="÷ Purchase price" value={wholeDollars(m.purchasePrice)} />
              <Row label="Cap rate" value={pct(m.capRate)} total tone="teal" />
            </Popover>
            <Popover
              title="Total cash required"
              trigger={
                <>
                  <small>Total Cash In</small>
                  <strong>{wholeDollars(m.totalCashRequired)}</strong>
                  <span>down + closing + rehab</span>
                </>
              }
            >
              {breakdown.map(([label, v]) => (
                <Row key={label} label={label} value={wholeDollars(v)} />
              ))}
              <Row label="Total cash in" value={wholeDollars(m.totalCashRequired)} total />
            </Popover>
          </div>
          <div className={d.risk}>
            <button
              type="button"
              className={d.riskHead}
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
            >
              <span className={d.ring}>
                <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
                  <circle
                    cx="22"
                    cy="22"
                    r="18"
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="4"
                  />
                  {score != null && (
                    <circle
                      cx="22"
                      cy="22"
                      r="18"
                      fill="none"
                      stroke={level!.color}
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={`${score * 1.13} 113`}
                      transform="rotate(-90 22 22)"
                    />
                  )}
                </svg>
                <b style={{ color: level?.color }}>{score == null ? '—' : Math.round(score)}</b>
                <small>Risk score</small>
              </span>
              <span className={d.riskInfo}>
                <span className={d.riskLine}>
                  <span className={d.kicker}>Risk</span>
                  {level && (
                    <span className={d.level} data-tone={level.tone}>
                      {level.level}
                    </span>
                  )}
                  <span className={d.heuristic}>Heuristic, not advice</span>
                </span>
                <span className={d.pills}>
                  {sorted.slice(0, 3).map((f) => (
                    <span key={f.name} data-status={f.status}>
                      {f.name} <b>{f.description}</b>
                    </span>
                  ))}
                </span>
              </span>
              {!expanded && score != null && score > 30 && hint[sorted[0]?.name] && (
                <span className={d.hint}>
                  <Icon name="sparkles" size={12} /> {hint[sorted[0].name]}
                </span>
              )}
              <span className={d.chev} aria-hidden="true">
                <Icon name={expanded ? 'chevronDown' : 'chevronRight'} size={16} />
              </span>
            </button>
            {!expanded ? (
              <div className={d.factors}>
                {sorted.slice(0, 3).map((f) => (
                  <FactorRow key={f.name} f={f} dark />
                ))}
              </div>
            ) : (
              <div className={d.expanded}>
                <div className={d.gauge}>
                  {score != null && level && (
                    <>
                      <Gauge score={score} color={level.color} />
                      <div className={d.gaugeEnds}>
                        <span>Low</span>
                        <span>High</span>
                      </div>
                      <p>
                        <b style={{ color: level.color }}>{Math.round(score)}</b>{' '}
                        <small>/ 100 risk</small>
                      </p>
                    </>
                  )}
                </div>
                <div className={d.all}>
                  <p className={d.kicker}>All Risk Factors</p>
                  {sorted.map((f) => (
                    <div key={f.name} className={d.allRow}>
                      <div className={d.allHead}>
                        <span>{f.name}</span>
                        <span>
                          <b data-status={f.status}>{f.description}</b>
                          <em data-status={f.status}>{statusLabel[f.status]}</em>
                        </span>
                      </div>
                      {f.score == null ? (
                        <span className={d.unavailable}>Input missing — left out of the score</span>
                      ) : (
                        <SegmentBar position={100 - f.score} size={14} />
                      )}
                    </div>
                  ))}
                  {fixes.length > 0 && (
                    <div className={d.improve}>
                      <p className={d.kicker}>
                        <Icon name="sparkles" size={14} /> How to Improve
                      </p>
                      {fixes.map((fix) => (
                        <p key={fix.action}>
                          <span aria-hidden="true">→</span> {fix.action} <em>{fix.result}</em>
                        </p>
                      ))}
                    </div>
                  )}
                  <p className={d.method}>
                    Weighted heuristic of up to six factors: DSCR 25%, cash-on-cash 20%, break-even
                    20%, cap spread 15%, LTV 10%, OER 10% (RealROI thresholds). Higher = riskier.
                    Missing inputs are left out, never assumed. Figures come from
                    RocketRental&apos;s engine.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

const leverTone = { income: 'teal', expense: 'slate', financing: 'slateDark' } as const;

/**
 * C4 Fix My Deal: six levers, each re-run through the engine. Clicking a lever
 * applies a what-if to this card only; saved assumptions and the other charts
 * never change. Best Fix picks the lever with the largest engine impact.
 */
export function FixMyDeal({
  result,
  payload,
}: {
  result: ProjectionResult;
  payload: AnalysisPayload;
}) {
  const deferred = useDeferredValue(payload);
  const [active, setActive] = useState<LeverKey[]>([]);
  const [target, setTarget] = useState<{ lever: 'Rent' | 'Rate'; index: number }[]>([]);
  const [targetsOpen, setTargetsOpen] = useState(false);
  const [potentialOpen, setPotentialOpen] = useState(false);
  const rows = useMemo(() => leverRows(deferred, result), [deferred, result]);
  const targets = useMemo(() => targetFixes(deferred, result), [deferred, result]);
  const allKeys = rows.filter((r) => r.value != null && r.value > 0).map((r) => r.key);
  const potential = useMemo(
    () => runInput(deferred, applyLevers(deferred.input, allKeys)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deferred, allKeys.join()],
  );
  const whatIfInput = useMemo(() => {
    let input = applyLevers(deferred.input, active);
    for (const t of target) input = targets[t.index]?.apply(input) ?? input;
    return input;
  }, [deferred, active, target, targets]);
  const hasWhatIf = active.length > 0 || target.length > 0;
  const whatIf = useMemo(
    () => (hasWhatIf ? runInput(deferred, whatIfInput) : null),
    [hasWhatIf, deferred, whatIfInput],
  );
  const m = result.summaryMetrics;
  const best = [...rows]
    .filter((r) => r.value != null)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
  const toggle = (key: LeverKey) =>
    setActive((list) => (list.includes(key) ? list.filter((x) => x !== key) : [...list, key]));
  const reset = () => {
    setActive([]);
    setTarget([]);
  };
  const shownAfter = whatIf ?? potential;
  const tone = (v: number | null | undefined, good: number, ok: number) =>
    v == null ? undefined : v >= good ? 'teal' : v >= ok ? 'amber' : 'red';
  const money = (v: number) => wholeDollars(v);
  return (
    <ChartCard
      title="Fix My Deal"
      subtitle="Click levers to see impact · what-if only, never saved"
      controls={
        hasWhatIf ? (
          <div>
            <button type="button" className={d.resetBtn} onClick={reset}>
              <Icon name="reset" size={12} /> Reset
            </button>
          </div>
        ) : best && (best.value ?? 0) > 0 ? (
          <div>
            <button type="button" className={d.bestBtn} onClick={() => setActive([best.key])}>
              <Icon name="zap" size={12} /> Best Fix
            </button>
          </div>
        ) : undefined
      }
    >
      <p role="status" aria-live="polite" className={d.srOnly}>
        {whatIf
          ? `What-if cash flow ${money(whatIf.summaryMetrics.monthlyCashFlow)} per month`
          : ''}
      </p>
      {hasWhatIf && whatIf && (
        <div className={d.applied}>
          <div className={d.appliedHead}>
            <p>Applied adjustments</p>
            <b data-tone={whatIf.summaryMetrics.monthlyCashFlow >= 0 ? 'teal' : 'red'}>
              Cash Flow: {money(whatIf.summaryMetrics.monthlyCashFlow)}/mo
            </b>
          </div>
          {active.map((key) => {
            const r = rows.find((x) => x.key === key);
            if (!r) return null;
            return (
              <div key={key} className={d.appliedRow}>
                <button
                  type="button"
                  aria-label={`Remove ${r.name} adjustment`}
                  onClick={() => toggle(key)}
                >
                  ×
                </button>
                <span>
                  {r.name} {r.change}
                </span>
                <em>{r.value == null ? 'Unavailable' : `+${money(r.value)}/yr`}</em>
              </div>
            );
          })}
          {target.map((t) => {
            const fix = targets[t.index];
            if (!fix) return null;
            const f = (v: number) => (fix.lever === 'Rent' ? wholeDollars(v) : `${v.toFixed(2)}%`);
            return (
              <div key={t.lever} className={d.appliedRow}>
                <button
                  type="button"
                  aria-label={`Remove ${fix.lever} target`}
                  onClick={() => setTarget((list) => list.filter((x) => x.lever !== t.lever))}
                >
                  ×
                </button>
                <span>
                  {fix.lever}: <s>{f(fix.current)}</s> → <b>{f(fix.target)}</b>
                </span>
                <em>{fix.outcome}</em>
              </div>
            );
          })}
        </div>
      )}
      {targets.length > 0 && (
        <div className={d.targets}>
          <div className={d.targetsHead}>
            <button
              type="button"
              aria-expanded={targetsOpen}
              onClick={() => setTargetsOpen((v) => !v)}
            >
              <Icon name={targetsOpen ? 'chevronDown' : 'chevronRight'} size={14} /> Targets to Hit
            </button>
            <span>
              <button
                type="button"
                className={d.applyBtn}
                onClick={() =>
                  setTarget((list) =>
                    list.some((x) => x.index === 0)
                      ? list
                      : [...list, { lever: targets[0].lever, index: 0 }],
                  )
                }
              >
                <Icon name="zap" size={12} /> Apply
              </button>
              {targets.length > 1 && (
                <button
                  type="button"
                  className={d.applyAllBtn}
                  onClick={() => setTarget(targets.map((t, index) => ({ lever: t.lever, index })))}
                >
                  <Icon name="target" size={12} /> Apply All
                </button>
              )}
            </span>
          </div>
          {targetsOpen && (
            <ul>
              {targets.map((t) => {
                const f = (v: number) =>
                  t.lever === 'Rent' ? wholeDollars(v) : `${v.toFixed(2)}%`;
                return (
                  <li key={t.lever}>
                    <span>
                      <b>{t.lever}:</b> {f(t.current)} <span aria-hidden="true">→</span>
                      <span className={d.srOnly}>to</span> <b>{f(t.target)}</b>
                    </span>
                    <em>{t.outcome}</em>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      <div className={d.levers}>
        {rows.map((r) => {
          const on = active.includes(r.key);
          return (
            <button
              key={r.key}
              type="button"
              className={d.lever}
              aria-pressed={on}
              data-tone={leverTone[r.category as keyof typeof leverTone]}
              onClick={() => toggle(r.key)}
            >
              <span className={d.leverHead}>
                <span>
                  {r.name} <em>{r.change}</em>
                </span>
                <b>
                  {r.value == null
                    ? 'Unavailable'
                    : `${r.value >= 0 ? '+' : '−'}${money(Math.abs(r.value))}/yr`}
                </b>
              </span>
              <SegmentBar position={r.share * 100} size={16} />
            </button>
          );
        })}
        {!rows.length && (
          <p className={d.note}>
            No adjustable levers: rent, vacancy, rate and cost inputs are missing.
          </p>
        )}
      </div>
      {potential && allKeys.length > 0 && (
        <div className={d.potential}>
          <div className={d.potentialHead}>
            <button
              type="button"
              aria-expanded={potentialOpen}
              onClick={() => setPotentialOpen((v) => !v)}
            >
              <Icon name={potentialOpen ? 'chevronDown' : 'chevronRight'} size={14} />
              {hasWhatIf ? 'Current improvement:' : 'If you apply all fixes:'}
            </button>
            {hasWhatIf ? (
              <button type="button" className={d.resetSoft} onClick={reset}>
                <Icon name="reset" size={12} /> Reset
              </button>
            ) : (
              <button type="button" className={d.applyAllBtn} onClick={() => setActive(allKeys)}>
                <Icon name="zap" size={12} /> Apply All
              </button>
            )}
          </div>
          {potentialOpen && shownAfter && (
            <dl className={d.grid3}>
              <div>
                <dt>Cash Flow</dt>
                <dd>
                  <span data-tone={m.monthlyCashFlow >= 0 ? undefined : 'red'}>
                    {money(m.monthlyCashFlow)}
                  </span>{' '}
                  →{' '}
                  <b data-tone={shownAfter.summaryMetrics.monthlyCashFlow >= 0 ? 'teal' : 'red'}>
                    {money(shownAfter.summaryMetrics.monthlyCashFlow)}
                  </b>
                </dd>
              </div>
              <div>
                <dt>DSCR</dt>
                <dd>
                  {m.loanAmount > 0 ? (
                    <>
                      <span data-tone={tone(m.dscr, 1.25, 1)}>{m.dscr?.toFixed(2) ?? '—'}</span> →{' '}
                      <b data-tone={tone(shownAfter.summaryMetrics.dscr, 1.25, 1)}>
                        {shownAfter.summaryMetrics.dscr?.toFixed(2) ?? '—'}
                      </b>
                    </>
                  ) : (
                    'No debt'
                  )}
                </dd>
              </div>
              <div>
                <dt>CoC</dt>
                <dd>
                  <span data-tone={tone(m.cashOnCash, 0.08, 0)}>{pct(m.cashOnCash, 1)}</span> →{' '}
                  <b data-tone={tone(shownAfter.summaryMetrics.cashOnCash, 0.08, 0)}>
                    {pct(shownAfter.summaryMetrics.cashOnCash, 1)}
                  </b>
                </dd>
              </div>
            </dl>
          )}
        </div>
      )}
      <p className={d.note}>
        Every figure is a full engine recalculation of Year 1 with the lever applied (fixed annual
        costs are cut by 1% of gross rent). The combined view runs all levers together rather than
        adding them up.
      </p>
    </ChartCard>
  );
}
