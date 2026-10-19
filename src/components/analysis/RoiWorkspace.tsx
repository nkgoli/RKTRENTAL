'use client';
import { useEffect, useRef, useState } from 'react';
import {
  PayloadSchema,
  calculatePayload,
  issues,
  missingData,
  type AnalysisPayload,
  type PropertySelectionResult,
  type RoiDraftResult,
  type ValidationIssue,
} from '@/lib/analysis';
import {
  loadRoiDraftAction,
  loadSavedRoiAnalysisAction,
  saveRoiAnalysisAction,
} from '@/app/(manager)/roi-analysis/actions';
import { PropertySelector } from './PropertySelector';
import {
  allFields,
  applyValues,
  groups,
  taxFields,
  valuesFrom,
  type FieldSpec,
  type Values,
} from './fields';
import styles from './analysis.module.css';

type Result = ReturnType<typeof calculatePayload>['base'];
type Facts = Extract<RoiDraftResult, { ok: true }>['data']['facts'];
const money = (v: number | null | undefined) =>
  v == null
    ? 'Unavailable'
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(v);
const percent = (v: number | null | undefined) =>
  v == null ? 'Unavailable' : `${(v * 100).toFixed(1)}%`;
const failure = (code: string) =>
  ({
    CONFLICT:
      'A newer revision exists. Your edits are kept. Reload saved analysis to reconcile before saving again.',
    NOT_FOUND: 'This property is unavailable or archived. Choose another property.',
    INVALID: 'Check the highlighted assumptions.',
    MISSING_DATA: 'Complete the missing assumptions before saving ready.',
    FORBIDDEN: 'You do not have access to this analysis.',
    UNSUPPORTED_VERSION: 'This saved analysis uses an unsupported version.',
  })[code] ?? 'Could not complete this request. Your entries are kept. Try again.';

export function RoiWorkspace({
  selection,
  initialPropertyId,
}: {
  selection: PropertySelectionResult;
  initialPropertyId?: string;
}) {
  const [selected, setSelected] = useState(initialPropertyId ?? '');
  const [payload, setPayload] = useState<AnalysisPayload | null>(null);
  const [values, setValues] = useState<Values>({});
  const [tax, setTax] = useState(false);
  const [revision, setRevision] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<ValidationIssue[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [stale, setStale] = useState(false);
  const [facts, setFacts] = useState<Facts | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const token = useRef(0);
  const properties = selection.ok ? selection.data : [];
  const property = properties.find((p) => p.id === selected);

  function install(p: AnalysisPayload, rev: number) {
    setPayload(p);
    setValues(valuesFrom(p));
    setTax(!!p.options.tax);
    setRevision(rev);
    setDirty(false);
    setConflict(false);
    try {
      setResult(calculatePayload(p).base);
      setErrors([]);
      setStale(false);
    } catch {
      setResult(null);
      setErrors(missingData(p));
      setStale(true);
    }
  }
  async function load(id: string) {
    const request = ++token.current;
    setLoading(true);
    setPayload(null);
    setResult(null);
    setFacts(null);
    setErrors([]);
    setMessage('');
    setDirty(false);
    setConflict(false);
    if (!properties.some((p) => p.id === id)) {
      setMessage(failure('NOT_FOUND'));
      setLoading(false);
      return;
    }
    try {
      const [saved, draft] = await Promise.all([
        loadSavedRoiAnalysisAction(id),
        loadRoiDraftAction(id),
      ]);
      if (request !== token.current) return;
      if (!saved.ok) {
        setMessage(failure(saved.code));
        return;
      }
      if (!draft.ok) {
        setMessage(failure(draft.code));
        return;
      }
      install(saved.data?.payload ?? draft.data.payload, saved.data?.revision ?? 0);
      setFacts(draft.data.facts);
      setMessage(
        saved.data
          ? `Loaded ${saved.data.status.toLowerCase()} - revision ${saved.data.revision}`
          : 'New analysis - review source facts and enter your assumptions.',
      );
    } catch {
      if (request === token.current)
        setMessage('Could not load analysis. Retry loading this property.');
    } finally {
      if (request === token.current) setLoading(false);
    }
  }
  const initialLoad = useRef(() => {
    if (initialPropertyId) void load(initialPropertyId);
  });
  useEffect(() => {
    const counter = token;
    initialLoad.current();
    return () => {
      counter.current++;
    };
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function switchProperty(id: string) {
    setPending(null);
    setSelected(id);
    setPayload(null);
    setResult(null);
    window.history.replaceState(
      null,
      '',
      id ? `/roi-analysis?property=${encodeURIComponent(id)}` : '/roi-analysis',
    );
    if (id) void load(id);
    else {
      token.current++;
      setDirty(false);
      setMessage('');
      setErrors([]);
      setFacts(null);
    }
  }
  function choose(id: string) {
    if (dirty) setPending(id);
    else switchProperty(id);
  }
  function edit(path: string, value: string) {
    setValues((v) => ({ ...v, [path]: value }));
    setDirty(true);
    setStale(true);
    setErrors((e) => e.filter((i) => i.path !== path));
  }
  function validate(calculate: boolean) {
    if (!payload) return null;
    try {
      const p = PayloadSchema.parse(applyValues(payload, values, tax));
      const changed = allFields.filter((f) => values[f.path] !== valuesFrom(payload)[f.path]);
      p.evidence = [
        ...p.evidence.filter(
          (e) => e.source !== 'manager' || !changed.some((f) => f.path === e.path),
        ),
        ...changed.map((f) => ({
          path: f.path,
          source: 'manager' as const,
          observedAt: new Date().toISOString(),
          note: 'Manager-entered forecast assumption; units shown in the form.',
        })),
      ];
      if (calculate) {
        const calculated = calculatePayload(p).base;
        setResult(calculated);
        setStale(false);
      }
      setErrors([]);
      return p;
    } catch (error) {
      const found = issues(error).map((i) => ({
        ...i,
        path:
          i.path.startsWith('options') || i.path.startsWith('input') ? i.path : `input.${i.path}`,
      }));
      setErrors(found);
      setStale(true);
      setMessage('Check assumptions. Prior results are out of date.');
      queueMicrotask(() => {
        const field = document.getElementById(found[0]?.path);
        let ancestor = field?.parentElement;
        while (ancestor) {
          if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
          ancestor = ancestor.parentElement;
        }
        field?.focus();
      });
      return null;
    }
  }
  async function save(status: 'DRAFT' | 'READY', next?: string) {
    const p = validate(status === 'READY');
    if (!p) return;
    const request = token.current;
    setSaving(true);
    setMessage('Saving...');
    try {
      const saved = await saveRoiAnalysisAction({
        propertyId: selected,
        expectedRevision: revision,
        status,
        payload: p,
      });
      if (request !== token.current) return;
      if (!saved.ok) {
        setErrors(saved.issues ?? []);
        setConflict(saved.code === 'CONFLICT');
        setMessage(failure(saved.code));
        return;
      }
      install(saved.data.payload, saved.data.revision);
      setMessage(`Saved ${status.toLowerCase()} - revision ${saved.data.revision}`);
      if (next !== undefined) switchProperty(next);
    } catch {
      if (request === token.current)
        setMessage('Could not save analysis. Your entries are kept. Try again.');
    } finally {
      if (request === token.current) setSaving(false);
      else setSaving(false);
    }
  }
  function renderField(f: FieldSpec) {
    const error = errors.find((i) => i.path === f.path);
    const evidence = payload?.evidence.filter((e) => e.path === f.path).at(-1);
    return (
      <label key={f.path} className={styles.field}>
        {f.label}
        {f.optional ? ' - optional' : ''}
        {f.kind === 'select' || f.kind === 'boolean' ? (
          <select
            id={f.path}
            value={values[f.path] ?? ''}
            onChange={(e) => edit(f.path, e.target.value)}
            aria-invalid={!!error}
            aria-describedby={error ? `${f.path}-error` : undefined}
          >
            <option value="">Not set</option>
            {(f.choices ?? ['true', 'false']).map((v) => (
              <option key={v} value={v}>
                {v === 'true' ? 'Yes' : v === 'false' ? 'No' : v.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={f.path}
            type={f.kind === 'date' ? 'date' : 'text'}
            inputMode={f.kind === 'date' ? undefined : 'decimal'}
            value={values[f.path] ?? ''}
            onChange={(e) => edit(f.path, e.target.value)}
            aria-invalid={!!error}
            aria-describedby={error ? `${f.path}-error` : undefined}
          />
        )}
        <small>
          {values[f.path] !== valuesFrom(payload!)[f.path]
            ? 'Manager assumption'
            : evidence
              ? `${evidence.source} source - review for forecast`
              : 'Manager assumption'}
        </small>
        {error && (
          <small id={`${f.path}-error`} className={styles.error}>
            {error.message}
          </small>
        )}
      </label>
    );
  }
  const metrics = result?.summaryMetrics;
  return (
    <div className={styles.workspace}>
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Property planning</p>
          <h1>{selected ? 'ROI Analysis' : 'Choose a property'}</h1>
          <p>Explore projected returns with assumptions you control.</p>
        </div>
        {selected && (
          <button disabled={saving} onClick={() => choose('')}>
            Change property
          </button>
        )}
      </div>
      {!selection.ok && <p role="alert">{failure(selection.code)}</p>}
      {!selected ? (
        <>
          <PropertySelector properties={properties} onSelect={choose} />
          <section className={styles.card}>
            <h2>What you’ll need</h2>
            <p>
              Purchase and loan terms, rent, operating budgets, reserve policy and growth
              assumptions. Recorded facts are starting points; missing values stay empty.
            </p>
          </section>
        </>
      ) : (
        <>
          <section className={styles.context}>
            <strong>{property?.name ?? 'Unavailable property'}</strong>
            <span>
              {property ? `${property.street}, ${property.city} - Whole property` : selected}
            </span>
            <span>{dirty ? 'Unsaved changes' : `Revision ${revision}`}</span>
          </section>
          <p role="status" aria-live="polite">
            {message}
          </p>
          {loading ? (
            <p>Loading analysis...</p>
          ) : !payload ? (
            <button onClick={() => load(selected)}>Retry loading</button>
          ) : (
            <>
              <div className={styles.actions}>
                <button disabled={saving} onClick={() => validate(true)}>
                  Recalculate
                </button>
                <button disabled={saving || conflict} onClick={() => save('DRAFT')}>
                  Save draft
                </button>
                <button
                  className={styles.primary}
                  disabled={saving || conflict}
                  onClick={() => save('READY')}
                >
                  Save ready
                </button>
                <button
                  disabled={saving}
                  onClick={() => (dirty ? setPending(selected) : load(selected))}
                >
                  Reload saved analysis
                </button>
              </div>
              {!!errors.length && (
                <details className={styles.notice} open>
                  <summary>Review {errors.length} missing or invalid assumptions</summary>
                  <ul>
                    {errors.map((e, i) => (
                      <li key={i}>
                        <a href={`#${e.path}`}>
                          {e.path}: {e.message}
                        </a>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {stale && (
                <p className={styles.notice} role="status">
                  {result
                    ? 'Out of date - recalculate to update these prior results.'
                    : 'Complete assumptions to calculate. No valid projection is available yet.'}
                </p>
              )}
              <div className={styles.layout}>
                <div className={styles.stack}>
                  <section className={styles.card} aria-label="Year 1 at a glance">
                    <h2>Year 1 at a glance</h2>
                    <div className={styles.metrics}>
                      {[
                        ['Annual cash flow', money(metrics?.annualCashFlow)],
                        ['Cap rate', percent(metrics?.capRate)],
                        ['Cash-on-cash', percent(metrics?.cashOnCash)],
                        ['Hold-period leveraged IRR', percent(metrics?.irrLeveraged)],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <small>{label}</small>
                          <strong>{value}</strong>
                        </div>
                      ))}
                    </div>
                    <p>
                      Forecast estimates - {stale ? 'out of date' : 'current assumptions'} - before
                      tax
                    </p>
                  </section>
                  <section className={styles.card}>
                    <h2>From income to cash flow</h2>
                    <dl className={styles.statement}>
                      {[
                        ['Gross potential income', metrics?.grossPotentialIncome],
                        ['Vacancy loss', result?.incomeBreakdown.vacancyLoss],
                        ['Effective gross income', metrics?.effectiveGrossIncome],
                        ['Operating expenses', metrics?.totalOperatingExpenses],
                        ['Net operating income', metrics?.noi],
                        ['Capital reserves (below NOI)', result?.expenseBreakdown.capex],
                        ['Modeled debt service', metrics?.annualDebtService],
                        ['Annual cash flow', metrics?.annualCashFlow],
                        ['Total cash required', metrics?.totalCashRequired],
                      ].map(([label, value]) => (
                        <div key={String(label)}>
                          <dt>{label}</dt>
                          <dd>{money(value as number | undefined)}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                  <section className={styles.card}>
                    <h2>Cash flow over time</h2>
                    <p>Annual operating cash flow, before sale proceeds and tax.</p>
                    {result ? (
                      <>
                        <div
                          className={styles.chart}
                          role="img"
                          aria-label={`Annual cash flow over ${result.annualCashflows.length} years. Exact values follow.`}
                        >
                          {result.annualCashflows.map((y) => (
                            <div key={y.year} title={`Year ${y.year}: ${money(y.cashFlow)}`}>
                              <i
                                style={{
                                  height: `${Math.max(2, (Math.abs(y.cashFlow) / Math.max(1, ...result.annualCashflows.map((y) => Math.abs(y.cashFlow)))) * 110)}px`,
                                  background: y.cashFlow < 0 ? '#dc2626' : '#1e3a8a',
                                }}
                              />
                              <small>{y.year}</small>
                            </div>
                          ))}
                        </div>
                        <details>
                          <summary>Exact annual cash flow</summary>
                          <div
                            className={styles.table}
                            tabIndex={0}
                            role="region"
                            aria-label="Annual cash flow"
                          >
                            <table>
                              <thead>
                                <tr>
                                  <th>Year</th>
                                  <th>Cash flow</th>
                                  <th>Cumulative</th>
                                </tr>
                              </thead>
                              <tbody>
                                {result.annualCashflows.map((y) => (
                                  <tr key={y.year}>
                                    <th scope="row">{y.year}</th>
                                    <td>{money(y.cashFlow)}</td>
                                    <td>{money(y.cumulativeCashFlow)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </details>
                      </>
                    ) : (
                      <p>Enter complete assumptions to see the cash-flow overview.</p>
                    )}
                  </section>
                  {result && (
                    <details className={styles.card}>
                      <summary>Advanced metrics & warnings</summary>
                      <dl className={styles.statement}>
                        <div>
                          <dt>NPV - discount {percent(result.assumptions.discountRate)}</dt>
                          <dd>{money(metrics?.npv)}</dd>
                        </div>
                        <div>
                          <dt>Debt coverage</dt>
                          <dd>{metrics?.dscr?.toFixed(2) ?? 'Unavailable'}</dd>
                        </div>
                        <div>
                          <dt>After-tax IRR - simplified estimate</dt>
                          <dd>{percent(metrics?.afterTaxIrr)}</dd>
                        </div>
                      </dl>
                      {result.warnings.map((w, i) => (
                        <p key={i}>{w.message}</p>
                      ))}
                    </details>
                  )}
                  {facts && (
                    <details className={styles.card}>
                      <summary>Recorded source facts</summary>
                      <p>
                        Recorded annual debt service: {money(facts.annualDebtService)}. The forecast
                        uses the loan terms you enter.
                      </p>
                      <p>
                        Recorded down payment: {money(facts.downPayment)}. Scheduled monthly lease
                        rent: {money(facts.scheduledMonthlyRent)}.
                      </p>
                      <p>
                        {facts.expenses.length} dated expense observations
                        {facts.expenseHistoryTruncated ? ' (history truncated)' : ''}; these are not
                        annual budgets.
                      </p>
                      <ul>
                        {payload.evidence
                          .filter((e) => e.source !== 'manager')
                          .map((e, i) => (
                            <li key={i}>
                              {e.path} - {e.source} - {e.note}
                            </li>
                          ))}
                      </ul>
                    </details>
                  )}
                </div>
                <section className={`${styles.card} ${styles.assumptions}`}>
                  <h2>Assumptions</h2>
                  <p>
                    Blank means missing. Enter 0 explicitly where applicable. Fixed annual costs
                    override the corresponding percentage; clear fixed amounts to use percentages.
                    Percentage assumptions remain required by the public contract.
                  </p>
                  <fieldset disabled={saving}>
                    <label className={styles.check}>
                      <input
                        type="checkbox"
                        checked={
                          values['input.financing.loanAmount'] === '0' &&
                          values['input.financing.downPaymentPercent'] === '100'
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            edit('input.financing.loanAmount', '0');
                            edit('input.financing.downPaymentPercent', '100');
                          } else {
                            edit('input.financing.loanAmount', '');
                            edit('input.financing.downPaymentPercent', '');
                          }
                        }}
                      />
                      All-cash purchase
                    </label>
                    <p>
                      All-cash sets loan amount to 0 and down payment to 100%. Enter explicit
                      remaining loan assumptions for validation; they do not create debt.
                    </p>
                    {groups.map((g) => (
                      <details key={g.title} open>
                        <summary>{g.title}</summary>
                        <div className={styles.fields}>{g.fields.map(renderField)}</div>
                      </details>
                    ))}
                    <details>
                      <summary>Optional tax estimate</summary>
                      <label className={styles.check}>
                        <input
                          type="checkbox"
                          checked={tax}
                          onChange={(e) => {
                            setTax(e.target.checked);
                            setDirty(true);
                            setStale(true);
                          }}
                        />
                        Include explicit tax assumptions
                      </label>
                      {tax && <div className={styles.fields}>{taxFields.map(renderField)}</div>}
                    </details>
                  </fieldset>
                </section>
              </div>
            </>
          )}
        </>
      )}
      {pending !== null && (
        <div
          className={styles.confirm}
          role="alertdialog"
          aria-modal="true"
          aria-label="Unsaved analysis"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setPending(null);
            if (e.key === 'Tab') {
              const buttons = Array.from(e.currentTarget.querySelectorAll('button'));
              const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
              if (e.shiftKey && i === 0) {
                e.preventDefault();
                buttons.at(-1)?.focus();
              } else if (!e.shiftKey && i === buttons.length - 1) {
                e.preventDefault();
                buttons[0]?.focus();
              }
            }
          }}
        >
          <div className={styles.card}>
            <h2>Keep your changes?</h2>
            <p>Save a draft before leaving, or discard these edits and load the saved workspace.</p>
            <p role="status">{message}</p>
            <div className={styles.actions}>
              <button autoFocus disabled={saving} onClick={() => setPending(null)}>
                Keep editing
              </button>
              <button disabled={saving || conflict} onClick={() => save('DRAFT', pending)}>
                Save draft and continue
              </button>
              <button disabled={saving} onClick={() => switchProperty(pending)}>
                Discard and continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
