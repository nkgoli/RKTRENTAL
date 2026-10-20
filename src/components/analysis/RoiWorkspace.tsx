'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
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
  loadActualReturnsAction,
  loadRoiDraftAction,
  loadSavedRoiAnalysisAction,
  saveRoiAnalysisAction,
} from '@/app/(manager)/roi-analysis/actions';
import {
  actualWindow,
  periodChoiceFrom,
  periodChoiceParams,
  type PeriodChoice,
  type ProjectionYear,
} from '@/lib/analysis/actuals';
import { ActualSnapshot, RoiActuals, actualFailure, type ActualsState } from './RoiActuals';
import {
  customDraft,
  applyCustomBenchmarks,
  type CustomBenchmarkDraft,
} from '@/lib/analysis/benchmarks';
import { RoiBenchmarks } from './RoiBenchmarks';
import type { BenchmarkData } from '@/lib/roi';
import { RoiScenarios } from './RoiScenarios';
import { applyScenarios, scenarioDrafts, type ScenarioDraft } from '@/lib/analysis/scenarios';
import { PropertySelector } from './PropertySelector';
import { AnalysisTabs, RoiProjections } from './RoiProjections';
import {
  allFields,
  applyValues,
  groups,
  fieldLabel,
  friendlyIssues,
  taxFields,
  valuesFrom,
  type FieldSpec,
  type Values,
} from './fields';
import { NetCashFlowCard, OutcomeCard, ProjectionMilestones } from './RoiSummaryCharts';
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
  const searchParams = useSearchParams();
  const urlProperty = searchParams
    ? (searchParams.get('property') ?? '')
    : (initialPropertyId ?? '');
  const [selected, setSelected] = useState('');
  const [payload, setPayload] = useState<AnalysisPayload | null>(null);
  const [values, setValues] = useState<Values>({});
  const [customBenchmark, setCustomBenchmark] = useState<CustomBenchmarkDraft>(customDraft([]));
  const [benchmarks, setBenchmarks] = useState<BenchmarkData[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioDraft[]>([]);
  const [tax, setTax] = useState(false);
  const [revision, setRevision] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [requestErrors, setErrors] = useState<ValidationIssue[]>([]);
  const [calculationVersion, setCalculationVersion] = useState(0);
  const [view, setViewState] = useState(() =>
    searchParams?.get('view') === 'actual' ? 'actual' : 'summary',
  );
  const [period, setPeriodState] = useState<PeriodChoice>(() => periodChoiceFrom(searchParams));
  // Mirrors for URL writes made in the same event as a state change.
  const viewRef = useRef(view);
  const periodRef = useRef(period);
  const [actuals, setActuals] = useState<ActualsState>({ status: 'loading' });
  const actualsToken = useRef(0);
  const [actualsAttempt, setActualsAttempt] = useState(0);
  const [facts, setFacts] = useState<Facts | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<string | null>(null);
  const modal = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [conflict, setConflict] = useState(false);
  const token = useRef(0);
  const properties = selection.ok ? selection.data : [];
  const property = properties.find((p) => p.id === selected);
  // First load and edits use the same synchronous calculation. Saved snapshots
  // take precedence over property defaults in load(); unknowns remain unknown.
  const projection = useMemo<{
    result: Result | null;
    payload: AnalysisPayload | null;
    errors: ValidationIssue[];
  }>(() => {
    if (!payload) return { result: null, payload: null, errors: [] };
    const edited = applyValues(payload, values, tax);
    try {
      const current = PayloadSchema.parse(
        applyScenarios(
          {
            ...edited,
            benchmarks: applyCustomBenchmarks(benchmarks, customBenchmark),
          },
          scenarios,
        ),
      );
      return {
        result: calculatePayload({ ...current, benchmarks: [] }).base,
        payload: current,
        errors: [],
      };
    } catch (error) {
      const missing = missingData(edited);
      return {
        result: null,
        payload: null,
        errors: friendlyIssues(missing.length ? missing : issues(error)),
      };
    }
  }, [payload, values, tax, benchmarks, customBenchmark, scenarios]);
  const errors = requestErrors.length ? requestErrors : projection.errors;
  const result = projection.result;
  const calculatedPayload = projection.payload;
  const stale = !result || !!requestErrors.length;
  const range = useMemo(() => actualWindow(period, new Date()), [period]);
  const projectionYear: ProjectionYear | null = result
    ? {
        effectiveGrossIncome: result.summaryMetrics.effectiveGrossIncome,
        totalOperatingExpenses: result.summaryMetrics.totalOperatingExpenses,
        noi: result.summaryMetrics.noi,
        annualDebtService: result.summaryMetrics.annualDebtService,
        annualCashFlow: result.summaryMetrics.annualCashFlow,
      }
    : null;
  // Recorded actuals load independently of the projection: they need only the property and
  // period, and a failure here never blocks or changes the assumptions.
  const actualsProperty = property ? selected : '';
  useEffect(() => {
    if (!actualsProperty) return;
    const request = ++actualsToken.current;
    setActuals({ status: 'loading' });
    (async () => {
      try {
        const loaded = await loadActualReturnsAction({
          propertyId: actualsProperty,
          from: range.from,
          to: range.to,
        });
        if (request !== actualsToken.current) return;
        setActuals(
          loaded.ok
            ? { status: 'ready', data: loaded.data }
            : { status: 'error', message: actualFailure(loaded.code) },
        );
      } catch {
        if (request === actualsToken.current)
          setActuals({ status: 'error', message: actualFailure('') });
      }
    })();
  }, [actualsProperty, range.from, range.to, actualsAttempt]);

  function install(p: AnalysisPayload, rev: number) {
    setPayload(p);
    setBenchmarks(p.benchmarks);
    setCustomBenchmark(customDraft(p.benchmarks));
    setScenarios(scenarioDrafts(p));
    setValues(valuesFrom(p));
    setTax(!!p.options.tax);
    setRevision(rev);
    setDirty(false);
    setConflict(false);
    setErrors([]);
    setCalculationVersion((v) => v + 1);
  }
  async function load(id: string) {
    const request = ++token.current;
    setLoading(true);
    setPayload(null);
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
          : 'New analysis - saved property details are filled in. Add any missing assumptions below.',
      );
    } catch {
      if (request === token.current)
        setMessage('Could not load analysis. Retry loading this property.');
    } finally {
      if (request === token.current) setLoading(false);
    }
  }
  // Route changes reuse this client component. Keep the guard and request token alive.
  const navigate = useRef<(id: string) => void>(() => {});
  const restore = useRef<(query: URLSearchParams) => void>(() => {});
  // A location whose view and period wait for the unsaved-changes decision.
  const pendingLocation = useRef<URLSearchParams | null>(null);
  useEffect(() => {
    restore.current = (query) => {
      const id = query.get('property') ?? '';
      if (dirty && property && id !== selected) pendingLocation.current = query;
      else adoptLocation(query);
      navigate.current(id);
    };
    navigate.current = (id) => {
      if (id === selected && (!id || property)) return;
      if (dirty && property) {
        window.history.replaceState(null, '', propertyUrl(selected));
        choose(id);
      } else switchProperty(id, false);
    };
  });
  useEffect(() => {
    navigate.current(urlProperty);
  }, [urlProperty, selection]);
  useEffect(() => {
    const counter = token;
    // Back/Forward restore everything the address holds, including absent parameters.
    const onPop = () => restore.current(new URLSearchParams(window.location.search));
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      counter.current++;
    };
  }, []);
  useEffect(() => {
    // The existing shell may render ordinary anchors. Guard ROI links here without
    // changing shared navigation or intercepting other routes and browser gestures.
    const onLink = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.download ||
        (anchor.target && anchor.target !== '_self')
      )
        return;
      const destination = new URL(anchor.href, window.location.href);
      if (
        destination.origin !== window.location.origin ||
        destination.pathname !== '/roi-analysis' ||
        destination.hash
      )
        return;
      event.preventDefault();
      const id = destination.searchParams.get('property') ?? '';
      if (id && id === selected) {
        adoptLocation(destination.searchParams);
        window.history.pushState(null, '', propertyUrl(id));
      } else {
        if (dirty) pendingLocation.current = destination.searchParams;
        else adoptLocation(destination.searchParams);
        choose(id);
      }
    };
    document.addEventListener('click', onLink, true);
    return () => document.removeEventListener('click', onLink, true);
  });
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => {
    if (pending === null) return;
    const contain = () => {
      if (!modal.current?.contains(document.activeElement)) {
        const first = modal.current?.querySelector<HTMLButtonElement>('button:not(:disabled)');
        (first ?? modal.current)?.focus();
      }
    };
    contain();
    document.addEventListener('focusin', contain);
    return () => document.removeEventListener('focusin', contain);
  }, [pending, saving]);

  function propertyUrl(id: string) {
    if (!id) return '/roi-analysis';
    const query = new URLSearchParams({ property: id });
    if (viewRef.current === 'actual') query.set('view', 'actual');
    for (const [name, value] of Object.entries(periodChoiceParams(periodRef.current)))
      query.set(name, value);
    return `/roi-analysis?${query}`;
  }
  function setView(next: string) {
    viewRef.current = next;
    setViewState(next);
  }
  /** Tab or period changes keep the address shareable and reload-safe without a history entry. */
  function changeView(next: string) {
    setView(next);
    if (selected) window.history.replaceState(null, '', propertyUrl(selected));
  }
  function changePeriod(next: PeriodChoice) {
    periodRef.current = next;
    setPeriodState(next);
    if (selected) window.history.replaceState(null, '', propertyUrl(selected));
  }
  /** Adopts view and period from a complete address; absent parameters mean the defaults. */
  function adoptLocation(query: URLSearchParams) {
    setView(query.get('view') === 'actual' ? 'actual' : 'summary');
    const next = periodChoiceFrom(query);
    periodRef.current = next;
    setPeriodState(next);
  }
  function closeGuard() {
    pendingLocation.current = null;
    setPending(null);
    queueMicrotask(() => returnFocus.current?.focus());
  }
  function focusField(path: string) {
    changeView(
      path.startsWith('benchmarks')
        ? 'compare'
        : path.startsWith('scenarios')
          ? 'scenarios'
          : 'summary',
    );
    setTimeout(() => {
      const scenario = path.match(/^scenarios\.\d+/)?.[0];
      const field =
        document.getElementById(path) ??
        document.getElementById(scenario ?? 'input.purchase.purchasePrice') ??
        document.getElementById('roi-section-tab-scenarios');
      let ancestor = field?.parentElement;
      while (ancestor) {
        if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
        ancestor = ancestor.parentElement;
      }
      field?.focus();
    }, 0);
  }
  function switchProperty(id: string, writeHistory = true) {
    const waiting = pendingLocation.current;
    pendingLocation.current = null;
    if (waiting && (waiting.get('property') ?? '') === id) adoptLocation(waiting);
    token.current++;
    setPending(null);
    setRecovery(null);
    setLoading(false);
    setSaving(false);
    setValues({});
    setSelected(id);
    setPayload(null);
    // The actual-versus-projected view and its period are shared context across properties.
    setView(viewRef.current === 'actual' ? 'actual' : 'summary');
    if (writeHistory) window.history.pushState(null, '', propertyUrl(id));
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
    if (dirty) {
      returnFocus.current = document.activeElement as HTMLElement;
      setPending(id);
    } else switchProperty(id);
  }
  function edit(path: string, value: string) {
    setValues((v) => ({ ...v, [path]: value }));
    setDirty(true);
    setErrors([]);
    setCalculationVersion((v) => v + 1);
  }
  function validate(calculate: boolean) {
    if (!payload) return null;
    try {
      const p = PayloadSchema.parse(
        applyScenarios(
          applyValues(
            { ...payload, benchmarks: applyCustomBenchmarks(benchmarks, customBenchmark) },
            values,
            tax,
          ),
          scenarios,
        ),
      );
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
        calculatePayload({ ...p, benchmarks: [] });
        setCalculationVersion((v) => v + 1);
      }
      setErrors([]);
      return p;
    } catch (error) {
      const edited = applyValues(payload, values, tax);
      const missing = calculate ? missingData(edited) : [];
      const found = friendlyIssues(missing.length ? missing : issues(error));
      setErrors(found);
      setMessage('Review the highlighted assumptions. Your entries are kept.');
      if (pending === null) focusField(found[0]?.path);
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
        setErrors(friendlyIssues(saved.issues ?? []));
        setConflict(saved.code === 'CONFLICT');
        setMessage(failure(saved.code));
        if (saved.issues?.length) {
          if (pending === null) focusField(friendlyIssues(saved.issues)[0].path);
        }
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
            aria-label={f.label}
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
            aria-label={f.label}
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
            : evidence?.demo
              ? 'Fictional demo value - not a recorded actual'
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
  // Fields whose latest evidence is a fictional demo value the manager has not replaced.
  const demoFields = payload
    ? allFields.flatMap((f) => {
        const latest = payload.evidence.filter((e) => e.path === f.path).at(-1);
        return latest?.demo && values[f.path] === valuesFrom(payload)[f.path]
          ? [{ path: f.path, demo: latest.demo }]
          : [];
      })
    : [];
  return (
    <div className={styles.workspace}>
      <div inert={pending !== null}>
        {recovery !== null && (
          <p className={styles.notice}>
            Your property change is waiting. Correct the highlighted assumption, then{' '}
            <button onClick={() => choose(recovery)}>Continue property change</button>
            <button onClick={() => setRecovery(null)}>Cancel property change</button>
          </p>
        )}
        <div className={styles.heading}>
          <div>
            <p className={styles.eyebrow}>Returns &amp; ROI</p>
            <h1>{selected ? 'ROI Analysis' : 'Choose a property'}</h1>
            <p>
              Compare recorded rent and expenses with projected returns from assumptions you
              control.
            </p>
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
                Saved property details fill your new ROI analysis automatically. Purchase and loan
                terms, whole-property rent, operating budgets, reserves and growth assumptions
                support the calculation. You can add missing details here or in the property’s ROI
                details.
              </p>
              <p>
                Actual results come from the rent payments and expenses you record. Open a property
                and choose <strong>Actual vs projected</strong> to compare them for any period, or
                see every property in <a href="/returns">Portfolio returns</a>.
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
                    onClick={() => (dirty ? choose(selected) : load(selected))}
                  >
                    Reload saved analysis
                  </button>
                </div>
                <p role="status">
                  {result && !stale
                    ? 'Calculated automatically from your current assumptions.'
                    : 'Add the missing assumptions to calculate automatically. You can save a draft at any time.'}
                </p>
                {!!demoFields.length && (
                  <p className={styles.notice} data-demo-assumptions={demoFields.length}>
                    Sample data: {demoFields.length} assumption
                    {demoFields.length === 1 ? ' is' : 's are'} fictional demo values (
                    {demoFields[0].demo}), not recorded actuals. Replace any value with your own to
                    use it.
                  </p>
                )}
                {!!errors.length && (
                  <details className={styles.notice} open>
                    <summary>
                      Complete your calculation · {errors.length} assumptions to review
                    </summary>
                    <p>
                      Your property is saved. ROI details are optional for property setup. Follow a
                      link to enter or correct an assumption; no missing costs or rates are assumed.
                    </p>
                    <ul>
                      {errors.map((e, i) => (
                        <li key={i}>
                          <a
                            href={`#${e.path}`}
                            onClick={(event) => {
                              event.preventDefault();
                              focusField(e.path);
                            }}
                          >
                            {fieldLabel(e.path)}: {e.message}
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
                <AnalysisTabs
                  id="roi-section"
                  label="ROI sections"
                  choices={[
                    { id: 'summary', label: 'Summary' },
                    { id: 'actual', label: 'Actual vs projected' },
                    { id: 'charts', label: 'Charts' },
                    { id: 'scenarios', label: 'Scenarios' },
                    { id: 'benchmarks', label: 'Benchmarks' },
                    { id: 'compare', label: 'Compare' },
                  ]}
                  value={view}
                  onChange={changeView}
                />
                <div
                  id="roi-section-panel-actual"
                  role="tabpanel"
                  aria-labelledby="roi-section-tab-actual"
                  hidden={view !== 'actual'}
                >
                  <RoiActuals
                    propertyId={selected}
                    propertyName={property?.name ?? 'Property'}
                    choice={period}
                    window={range}
                    state={actuals}
                    projection={projectionYear}
                    stale={stale}
                    missingAssumptions={projection.errors.length}
                    projectionBasis={
                      dirty
                        ? 'Current unsaved assumptions'
                        : revision > 0
                          ? `Saved analysis, revision ${revision}`
                          : 'Saved property details (analysis not yet saved)'
                    }
                    onPeriod={changePeriod}
                    onRetry={() => setActualsAttempt((n) => n + 1)}
                    onReviewAssumptions={() =>
                      focusField(errors[0]?.path ?? 'input.purchase.purchasePrice')
                    }
                  />
                </div>
                {['benchmarks', 'compare'].map((panel) => (
                  <div
                    key={panel}
                    id={`roi-section-panel-${panel}`}
                    role="tabpanel"
                    aria-labelledby={`roi-section-tab-${panel}`}
                    hidden={view !== panel}
                  >
                    <RoiBenchmarks
                      key={`${selected}-${panel}`}
                      selected={benchmarks}
                      custom={customBenchmark}
                      onCustomChange={(d) => {
                        setCustomBenchmark(d);
                        setDirty(true);
                        setErrors([]);
                        setCalculationVersion((v) => v + 1);
                      }}
                      errors={errors}
                      onChange={(b) => {
                        setBenchmarks(b);
                        setDirty(true);
                        setErrors([]);
                        setCalculationVersion((v) => v + 1);
                      }}
                      snapshot={calculatedPayload}
                      stale={stale}
                      saving={saving}
                      compare={panel === 'compare'}
                      propertyName={property?.name ?? 'Property'}
                    />
                  </div>
                ))}
                <div
                  id="roi-section-panel-scenarios"
                  role="tabpanel"
                  aria-labelledby="roi-section-tab-scenarios"
                  hidden={view !== 'scenarios'}
                >
                  <RoiScenarios
                    key={selected}
                    drafts={scenarios}
                    onChange={(d) => {
                      setScenarios(d);
                      setDirty(true);
                      setErrors([]);
                      setCalculationVersion((v) => v + 1);
                    }}
                    snapshot={calculatedPayload}
                    stale={stale}
                    errors={errors}
                    base={applyValues(payload, values, tax)}
                    saving={saving}
                  />
                </div>
                <div
                  id="roi-section-panel-charts"
                  role="tabpanel"
                  aria-labelledby="roi-section-tab-charts"
                  hidden={view !== 'charts'}
                >
                  <RoiProjections
                    key={selected}
                    result={result}
                    calculatedPayload={calculatedPayload}
                    calculationVersion={calculationVersion}
                    stale={stale}
                    saving={saving}
                    onEdit={(path) => focusField(path ?? 'input.purchase.purchasePrice')}
                  />
                </div>
                <div
                  className={styles.layout}
                  id="roi-section-panel-summary"
                  role="tabpanel"
                  aria-labelledby="roi-section-tab-summary"
                  hidden={view !== 'summary'}
                >
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
                        Forecast estimates - {stale ? 'out of date' : 'current assumptions'} -
                        before tax
                      </p>
                    </section>
                    <ActualSnapshot
                      window={range}
                      state={actuals}
                      projection={projectionYear}
                      stale={stale}
                      onOpen={() => changeView('actual')}
                    />
                    {result && <OutcomeCard key={`outcome-${selected}`} result={result} />}
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
                    {result ? (
                      <>
                        <NetCashFlowCard key={`cash-${selected}`} result={result} />
                        <ProjectionMilestones key={`table-${selected}`} result={result} />
                      </>
                    ) : null}
                    <section className={styles.card}>
                      <h2>Exact annual cash flow</h2>
                      <p>Annual operating cash flow, before sale proceeds and tax.</p>
                      {result ? (
                        <>
                          <details>
                            <summary>Show every year</summary>
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
                          Recorded annual debt service: {money(facts.annualDebtService)}. The
                          forecast uses the loan terms you enter.
                        </p>
                        <p>
                          Recorded down payment: {money(facts.downPayment)}. Scheduled monthly lease
                          rent: {money(facts.scheduledMonthlyRent)}.
                        </p>
                        <p>
                          {facts.expenses.length} dated expense observations
                          {facts.expenseHistoryTruncated ? ' (history truncated)' : ''}; these are
                          not annual budgets.
                        </p>
                        <ul>
                          {payload.evidence
                            .filter((e) => e.source !== 'manager')
                            .map((e, i) => (
                              <li key={i}>
                                {fieldLabel(e.path)} - {e.source} - {e.note}
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
                      A fixed cost needs no percentage. A $0 loan needs no loan-only terms. Use the
                      units shown beside each assumption.
                    </p>
                    <fieldset disabled={saving}>
                      <button type="button" onClick={() => edit('input.financing.loanAmount', '0')}>
                        Switch to cash purchase (set loan to $0)
                      </button>
                      <p>
                        A $0 loan means no debt payments or lender costs. Loan-only details are not
                        needed. Other saved loan details stay available if your plans change. To
                        finance the purchase, enter a loan amount or clear it and enter a down
                        payment percentage.
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
                              setErrors([]);
                              setCalculationVersion((v) => v + 1);
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
      </div>
      {pending !== null && (
        <div
          className={styles.confirm}
          ref={modal}
          tabIndex={-1}
          role="alertdialog"
          aria-modal="true"
          aria-label="Unsaved analysis"
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !saving) closeGuard();
            if (e.key === 'Tab') {
              const buttons = Array.from(
                e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
              );
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
            {!!errors.length && (
              <button
                disabled={saving}
                onClick={() => {
                  setRecovery(pending);
                  setPending(null);
                  focusField(errors[0].path);
                }}
              >
                Correct highlighted assumption
              </button>
            )}
            <div className={styles.actions}>
              <button autoFocus disabled={saving} onClick={closeGuard}>
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
