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
import { RoiActuals, actualFailure, type ActualsState } from './RoiActuals';
import {
  customDraft,
  applyCustomBenchmarks,
  type CustomBenchmarkDraft,
} from '@/lib/analysis/benchmarks';
import { RoiBenchmarks } from './RoiBenchmarks';
import { getAllBenchmarks, type BenchmarkData } from '@/lib/roi';
import { NoticeToast, useToast } from '@/components/ui/Toast';
import { CaseComparison } from './RoiScenarios';
import { applyScenarios, scenarioDrafts, type ScenarioDraft } from '@/lib/analysis/scenarios';
import {
  activeOverrides,
  emptyWhatIf,
  scopedWhatIf,
  simulate,
  whatIfEntryFrom,
  type WhatIfState,
} from '@/lib/analysis/what-if';
import { TRIGGER_ID, WhatIfPanel, WhatIfStatus } from './RoiWhatIf';
import w from './what-if.module.css';
import { PropertySelector } from './PropertySelector';
import { AnalysisTabs, RoiProjections } from './RoiProjections';
import {
  allFields,
  applyValues,
  fieldLabel,
  friendlyIssues,
  taxFields,
  valuesFrom,
  type FieldSpec,
  type Values,
} from './fields';
import {
  NetCashFlowYears,
  OutcomeCard,
  ProjectionMilestones,
  SummaryMilestones,
} from './RoiSummaryCharts';
import {
  ActualVsProjectedSummary,
  ActualsToComplete,
  EstimatesPanel,
  HowCalculated,
  OptionalInputs,
} from './RoiReturnsSummary';
import { buildCompsHref, rentAnalysisContext } from '@/lib/comps/navigation';
import { DealSnapshot } from './RoiDealPanels';
import { MoreDetail } from './RoiChart';
import { AssumptionsSummary, isBaselinePath } from './AssumptionsSummary';
import {
  assumptionsEditPath,
  chartPanelFrom,
  isLegacyScenariosView,
  roiViewFrom,
  setRoiView,
} from '@/lib/analysis/return-path';
import { browser } from './browser';
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

const glyph = (d: string) => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={d} />
  </svg>
);
const SECTIONS = [
  { id: 'summary', label: 'Summary' },
  { id: 'actual', label: 'Actual vs projected' },
  { id: 'charts', label: 'Charts' },
  { id: 'benchmarks', label: 'Benchmarks' },
  { id: 'compare', label: 'Compare' },
] as const;
const SlidersIcon = () =>
  glyph('M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6');
const WhatIfIcon = () => glyph('M3 17l6-6 4 4 8-8M14 7h7v7');
const BookmarkIcon = () => glyph('m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z');

export function RoiWorkspace({
  selection,
  initialPropertyId,
}: {
  selection: PropertySelectionResult;
  initialPropertyId?: string;
}) {
  const toast = useToast();
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
  // Load confirmations are announced only; the header retains the revision state.
  const [announcement, setAnnouncement] = useState('');
  const [savedStatus, setSavedStatus] = useState<'DRAFT' | 'READY' | null>(null);
  const [requestErrors, setErrors] = useState<ValidationIssue[]>([]);
  const [calculationVersion, setCalculationVersion] = useState(0);
  const [view, setViewState] = useState(() => roiViewFrom(searchParams));
  const [chart, setChartState] = useState(() => chartPanelFrom(searchParams));
  const [period, setPeriodState] = useState<PeriodChoice>(() => periodChoiceFrom(searchParams));
  // Mirrors for URL writes made in the same event as a state change.
  const viewRef = useRef(view);
  const chartRef = useRef(chart);
  const periodRef = useRef(period);
  const [actuals, setActuals] = useState<ActualsState>({ status: 'loading' });
  const actualsToken = useRef(0);
  const [actualsAttempt, setActualsAttempt] = useState(0);
  const [facts, setFacts] = useState<Facts | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<string | null>(null);
  const modal = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [conflict, setConflict] = useState(false);
  // The one temporary What if. It belongs to a property; a state read for any other property
  // is dropped (scopedWhatIf), and choosing another property clears it.
  const [whatIfState, setWhatIf] = useState<WhatIfState | null>(null);
  const [whatIfOpen, setWhatIfOpen] = useState(false);
  // Below 1100px the panel is a modal sheet; wider screens keep the analysis beside it.
  const [narrow, setNarrow] = useState(false);
  // A Rent analysis entry (unit and its suggested rent change) waits for the analysis to load.
  const [initialEntry] = useState(() => {
    const found = whatIfEntryFrom(searchParams);
    return found && urlProperty ? { property: urlProperty, ...found } : null;
  });
  const entry = useRef(initialEntry);
  // A retired Scenarios address lands on Compare's saved cases once the analysis loads.
  const legacyScenarios = useRef(isLegacyScenariosView(searchParams));
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
  // Baseline gaps are completed in Edit Property; scenario, comparison and tax issues stay here.
  const baselineErrors = errors.filter((e) => isBaselinePath(e.path));
  const localErrors = errors.filter((e) => !isBaselinePath(e.path));
  const result = projection.result;
  const calculatedPayload = projection.payload;
  const stale = !result || !!requestErrors.length;
  // What if: the active case runs over the calculated baseline with the same engine merge as
  // saved cases. Baseline state (payload, values, scenarios) is never written by it.
  const whatIf = scopedWhatIf(whatIfState, selected);
  const savedCase =
    whatIf?.source.kind === 'saved'
      ? (scenarios.find((d) => d.id === (whatIf.source as { id: string }).id) ?? null)
      : null;
  const caseValues = savedCase ? savedCase.values : whatIf?.values;
  const simulating =
    !!whatIf && (!!savedCase || Object.keys(activeOverrides(whatIf.values)).length > 0);
  const simulation = useMemo(
    () =>
      simulating && calculatedPayload && caseValues
        ? simulate(calculatedPayload, caseValues, savedCase?.options)
        : null,
    [simulating, calculatedPayload, caseValues, savedCase?.options],
  );
  const simulated = simulation?.ok ? simulation : null;
  // Every view shows the simulated projection while a what-if runs; recorded data never changes.
  const shownResult = simulated?.result ?? result;
  const shownPayload = simulated?.payload ?? calculatedPayload;
  const caseName = savedCase ? savedCase.name || 'Unnamed case' : (whatIf?.name ?? 'What if');
  const changedCount = caseValues ? Object.keys(activeOverrides(caseValues)).length : 0;
  const range = useMemo(() => actualWindow(period, new Date()), [period]);
  const projectionYear: ProjectionYear | null = shownResult
    ? {
        effectiveGrossIncome: shownResult.summaryMetrics.effectiveGrossIncome,
        totalOperatingExpenses: shownResult.summaryMetrics.totalOperatingExpenses,
        noi: shownResult.summaryMetrics.noi,
        annualDebtService: shownResult.summaryMetrics.annualDebtService,
        annualCashFlow: shownResult.summaryMetrics.annualCashFlow,
      }
    : null;
  useEffect(() => {
    const query = window.matchMedia?.('(max-width: 1099px)');
    if (!query) return;
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);
  // Once this property's analysis has loaded: open a Rent analysis entry as a unit-labelled
  // temporary what-if, and move a retired Scenarios address to Compare's saved cases.
  useEffect(() => {
    if (!payload || loading || !selected) return;
    const waiting = entry.current;
    if (waiting?.property === selected) {
      entry.current = null;
      // Only a unit of this property can supply a rent change. A missing, malformed, deleted or
      // other-property unit opens an empty what-if over the unchanged baseline, and says so.
      const unit = waiting.unitId
        ? property?.units.find((u) => u.id === waiting.unitId)
        : undefined;
      const unitName = unit ? `Unit ${unit.number}` : null;
      const rent = (calculatedPayload ?? payload).input.income?.monthlyRent;
      const change = unit ? waiting.rentChange : null;
      const signed =
        change == null ? '' : ` ${change < 0 ? '−' : '+'}${money(Math.abs(change))}/mo`;
      const rejected = waiting.kind === 'rent' && !unit;
      setWhatIf({
        ...emptyWhatIf(selected),
        values:
          change != null && rent != null ? { 'income.monthlyRent': String(rent + change) } : {},
        name: unitName && change != null ? `${unitName} at suggested rent` : 'What if',
        context: rejected
          ? 'From Rent analysis · unit not found in this property, no rent change applied'
          : `From Rent analysis${unitName ? ` · ${unitName}${signed}` : ''}`,
      });
      if (rejected)
        setMessage(
          `The Rent analysis unit is not part of ${property?.name ?? 'this property'}, so no rent change was applied. The baseline is unchanged.`,
        );
      setWhatIfOpen(true);
      window.history.replaceState(null, '', propertyUrl(selected));
    }
    if (legacyScenarios.current) {
      legacyScenarios.current = false;
      window.history.replaceState(null, '', propertyUrl(selected));
      setTimeout(
        () => document.getElementById('roi-saved-cases')?.scrollIntoView?.({ block: 'start' }),
        0,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload, loading, selected]);
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
    setBenchmarks(
      p.benchmarks.length || rev > 0
        ? p.benchmarks
        : [getAllBenchmarks().find((b) => b.type === 'sp500')!],
    );
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
    setAnnouncement('');
    setDirty(false);
    setConflict(false);
    if (!properties.some((p) => p.id === id)) {
      setMessage(failure('NOT_FOUND'));
      setLoading(false);
      return;
    }
    try {
      // Let the loading state paint before the requests start; Next runs server actions in a
      // transition that would otherwise hold this render until the analysis arrives.
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (request !== token.current) return;
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
      setSavedStatus(saved.data?.status ?? null);
      setAnnouncement(
        saved.data
          ? `Loaded ${saved.data.status.toLowerCase()} - revision ${saved.data.revision}`
          : 'New analysis - filled in from saved property details.',
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
      } else switchProperty(id, false, true);
    };
  });
  // False only until the address has been followed once (server render and hydration).
  const [started, setStarted] = useState(false);
  useEffect(() => {
    navigate.current(urlProperty);
    setStarted(true);
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
        // Adopted once the property actually changes, after any unsaved-changes decision.
        pendingLocation.current = destination.searchParams;
        choose(id);
      }
    };
    document.addEventListener('click', onLink, true);
    return () => document.removeEventListener('click', onLink, true);
  });
  // Set once the manager has decided to leave for the assumptions editor.
  const leaving = useRef(false);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      if (!leaving.current) e.preventDefault();
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
    setRoiView(query, viewRef.current, chartRef.current);
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
  function setChart(next: string) {
    chartRef.current = next;
    setChartState(next);
  }
  function changeChart(next: string) {
    setChart(next);
    if (selected) window.history.replaceState(null, '', propertyUrl(selected));
  }
  function changePeriod(next: PeriodChoice) {
    periodRef.current = next;
    setPeriodState(next);
    if (selected) window.history.replaceState(null, '', propertyUrl(selected));
  }
  /** Adopts view, chart and period from a complete address; absent parameters mean the defaults. */
  function adoptLocation(query: URLSearchParams) {
    setView(roiViewFrom(query));
    setChart(chartPanelFrom(query));
    const next = periodChoiceFrom(query);
    periodRef.current = next;
    setPeriodState(next);
  }
  /** Closes the More actions menu, returning focus to its toggle, before the action runs. */
  function menuAction(action: () => void) {
    return () => {
      if (menu.current) {
        menu.current.open = false;
        menu.current.querySelector('summary')?.focus();
      }
      action();
    };
  }
  function closeGuard() {
    pendingLocation.current = null;
    setPending(null);
    queueMicrotask(() => returnFocus.current?.focus());
  }
  /** Baseline assumptions are edited on the property; Save and Cancel come back here. */
  function editHref(path?: string) {
    return assumptionsEditPath(selected, propertyUrl(selected), path);
  }
  function editAssumptions(path?: string) {
    leave(editHref(path));
  }
  /** Leaves the workspace for another page, after the unsaved-changes decision when needed. */
  function leave(href: string) {
    if (dirty) {
      returnFocus.current = document.activeElement as HTMLElement;
      setPending(href);
    } else continueTo(href);
  }
  /** A pending destination is either a property ID or an Edit Property address. */
  function continueTo(next: string) {
    if (next.startsWith('/')) {
      leaving.current = true;
      setPending(null);
      browser.assign(next);
    } else switchProperty(next);
  }
  /** After a failed validation: local editors take focus; baseline gaps point to the editor link. */
  function reviewIssue(path: string | undefined) {
    if (path && isBaselinePath(path))
      setTimeout(() => document.getElementById('roi-complete-assumptions')?.focus(), 0);
    else focusField(path ?? '');
  }
  function openWhatIf() {
    setWhatIf((current) => scopedWhatIf(current, selected) ?? emptyWhatIf(selected));
    setWhatIfOpen(true);
  }
  /** Closes the panel; an active what-if keeps running until it is reset or exited. */
  function closeWhatIf() {
    setWhatIfOpen(false);
    setTimeout(() => document.getElementById(TRIGGER_ID)?.focus(), 0);
  }
  function exitWhatIf() {
    setWhatIf(null);
    closeWhatIf();
  }
  function focusField(path: string) {
    if (!path || isBaselinePath(path)) {
      editAssumptions(path || undefined);
      return;
    }
    // Saved-case entries are corrected in What if with that case shown; benchmarks on
    // Compare; the optional tax estimate on Summary.
    const caseIndex = path.match(/^scenarios\.(\d+)/)?.[1];
    const target = caseIndex == null ? undefined : scenarios[Number(caseIndex)];
    if (target) {
      setWhatIf((current) => ({
        ...(scopedWhatIf(current, selected) ?? emptyWhatIf(selected)),
        source: { kind: 'saved', id: target.id },
      }));
      setWhatIfOpen(true);
    } else changeView(path.startsWith('benchmarks') ? 'compare' : 'summary');
    setTimeout(() => {
      const scenario = path.match(/^scenarios\.\d+/)?.[0];
      const field =
        document.getElementById(path) ??
        document.getElementById(scenario ?? 'input.purchase.purchasePrice') ??
        document.getElementById(TRIGGER_ID);
      let ancestor = field?.parentElement;
      while (ancestor) {
        if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
        ancestor = ancestor.parentElement;
      }
      field?.focus();
    }, 0);
  }
  /** `fromAddress`: the view, chart and period already come from the address being opened. */
  function switchProperty(id: string, writeHistory = true, fromAddress = false) {
    const waiting = pendingLocation.current;
    pendingLocation.current = null;
    const adopt = !!waiting && (waiting.get('property') ?? '') === id;
    if (adopt) adoptLocation(waiting);
    token.current++;
    setPending(null);
    setRecovery(null);
    setLoading(false);
    setSaving(false);
    setValues({});
    // A what-if never follows the manager to another property.
    setWhatIf(null);
    setWhatIfOpen(false);
    if (entry.current && entry.current.property !== id) entry.current = null;
    setSelected(id);
    setPayload(null);
    // An address names its own section. Choosing another property keeps only the
    // actual-versus-projected view and its period, which are shared across properties.
    if (!adopt && !fromAddress && selected && viewRef.current !== 'actual') {
      setView('summary');
      setChart('equity');
    }
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
    } else continueTo(id);
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
      if (pending === null) reviewIssue(found[0]?.path);
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
          if (pending === null) reviewIssue(friendlyIssues(saved.issues)[0].path);
        }
        return;
      }
      install(saved.data.payload, saved.data.revision);
      setSavedStatus(status);
      setMessage(`Saved ${status.toLowerCase()} - revision ${saved.data.revision}`);
      toast.success(`Analysis saved as ${status.toLowerCase()}.`);
      if (next !== undefined) continueTo(next);
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
  const metrics = shownResult?.summaryMetrics;
  // Fields whose latest evidence is a fictional demo value the manager has not replaced.
  const demoFields = payload
    ? allFields.flatMap((f) => {
        const latest = payload.evidence.filter((e) => e.path === f.path).at(-1);
        return latest?.demo && values[f.path] === valuesFrom(payload)[f.path]
          ? [{ path: f.path, demo: latest.demo }]
          : [];
      })
    : [];
  // A property address is open before its first load starts (server render, hydration):
  // show it loading rather than the chooser.
  const opening = !started && !selected && !!urlProperty && selection.ok;
  const projectionBasis = simulated
    ? `What if · ${caseName} (simulated${savedCase ? '' : ', not saved'})`
    : dirty
      ? 'Current unsaved assumptions'
      : revision > 0
        ? `Saved analysis, revision ${revision}`
        : 'Saved property details (analysis not yet saved)';
  const vacantUnit = property?.units.find((unit) => unit.status === 'VACANT');
  const shown = opening ? urlProperty : selected;
  const shownProperty = properties.find((p) => p.id === shown);
  return (
    <div className={styles.workspace}>
      {searchParams?.get('notice') === 'property-saved' && (
        <NoticeToast message="Property saved." />
      )}
      <div inert={pending !== null}>
        {recovery !== null && (
          <p className={styles.notice}>
            Your {recovery.startsWith('/') ? 'assumptions edit' : 'property change'} is waiting.
            Correct the highlighted assumption, then{' '}
            <button onClick={() => choose(recovery)}>Continue property change</button>
            <button onClick={() => setRecovery(null)}>Cancel property change</button>
          </p>
        )}
        {shown && (
          <nav className={`breadcrumbs ${styles.crumbs}`} aria-label="Breadcrumb">
            <ol>
              <li>
                {/* A full page load keeps the unsaved-changes (beforeunload) guard in place. */}
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a href="/properties">Properties</a>
              </li>
              <li>
                <a href={`/properties/${shown}`}>{shownProperty?.name ?? 'Property'}</a>
              </li>
              <li aria-current="page">Returns &amp; ROI</li>
            </ol>
          </nav>
        )}
        <div className={`${styles.heading} ${shown ? styles.headingCompact : ''}`}>
          <div className={styles.titleBlock}>
            <p className={`eyebrow ${styles.eyebrow}`}>Returns &amp; ROI</p>
            <div className={styles.titleRow}>
              <h1>
                {shown ? (shownProperty?.name ?? 'Unavailable property') : 'Choose a property'}
              </h1>
              {shown && payload && !loading && (
                <span className={`badge ${dirty ? 'warning' : revision > 0 ? 'success' : ''}`}>
                  {dirty
                    ? 'Unsaved changes'
                    : revision > 0
                      ? `Saved · ${savedStatus === 'READY' ? 'ready' : savedStatus === 'DRAFT' ? 'draft' : 'analysis'}`
                      : 'Draft · not saved'}
                </span>
              )}
            </div>
            {shown ? (
              payload && !loading ? (
                <AssumptionsSummary
                  payload={calculatedPayload ?? applyValues(payload, values, tax)}
                  result={result}
                  stale={stale}
                  missing={baselineErrors}
                  incomplete={missingData(applyValues(payload, values, tax)).some((e) =>
                    isBaselinePath(e.path),
                  )}
                  demoCount={demoFields.length}
                  demoLabel={demoFields[0]?.demo}
                  source={
                    revision > 0
                      ? `Saved ${savedStatus === 'READY' ? 'ready' : savedStatus === 'DRAFT' ? 'draft' : 'analysis'} · revision ${revision}`
                      : 'From property details · not saved yet'
                  }
                  editHref={editHref()}
                  completeHref={editHref(baselineErrors[0]?.path)}
                  onEdit={(event, path) => {
                    if (!dirty) return;
                    event.preventDefault();
                    editAssumptions(path);
                  }}
                  meta={
                    <>
                      {shownProperty && (
                        <span>
                          {shownProperty.units.length}{' '}
                          {shownProperty.units.length === 1 ? 'unit' : 'units'}
                        </span>
                      )}
                      <span>
                        {revision > 0
                          ? `Saved ${savedStatus?.toLowerCase() ?? 'analysis'} · revision ${revision}`
                          : `Revision ${revision}`}
                      </span>
                    </>
                  }
                />
              ) : (
                <p className={styles.context}>
                  <span>Whole property</span>
                </p>
              )
            ) : (
              <p>
                Compare recorded rent and expenses with projected returns from assumptions you
                control.
              </p>
            )}
          </div>
          {shown && (
            <div className={styles.actions}>
              {payload && !loading && (
                <>
                  <button
                    type="button"
                    id={TRIGGER_ID}
                    className={`btn btn-secondary ${w.trigger}`}
                    aria-haspopup="dialog"
                    aria-expanded={whatIfOpen}
                    data-active={simulating || undefined}
                    onClick={() => (whatIfOpen ? closeWhatIf() : openWhatIf())}
                  >
                    <WhatIfIcon />
                    What if
                    {simulating && (
                      <small>
                        · {changedCount} {changedCount === 1 ? 'change' : 'changes'}
                      </small>
                    )}
                  </button>
                  <a
                    className="btn btn-secondary"
                    href={editHref()}
                    onClick={(event) => {
                      if (!dirty) return;
                      event.preventDefault();
                      editAssumptions();
                    }}
                  >
                    <SlidersIcon />
                    Edit assumptions
                  </a>
                  <details className={`${styles.menu} ${styles.saveMenu}`}>
                    <summary aria-label="Save analysis">
                      <BookmarkIcon />
                      {saving ? 'Saving...' : 'Save analysis'}
                    </summary>
                    <div role="group" aria-label="Save analysis options">
                      <button disabled={saving || conflict} onClick={() => save('DRAFT')}>
                        Save draft
                      </button>
                      <button disabled={saving || conflict} onClick={() => save('READY')}>
                        Save ready
                      </button>
                    </div>
                  </details>
                </>
              )}
              <details
                className={styles.menu}
                ref={menu}
                onKeyDown={(event) => {
                  if (event.key !== 'Escape' || !menu.current?.open) return;
                  menu.current.open = false;
                  menu.current.querySelector('summary')?.focus();
                }}
              >
                <summary aria-label="More actions">More</summary>
                <div role="group" aria-label="More actions">
                  {payload && !loading && (
                    <>
                      <button disabled={saving} onClick={menuAction(() => validate(true))}>
                        Recalculate
                      </button>
                      <button
                        disabled={saving}
                        onClick={menuAction(() => (dirty ? choose(selected) : load(selected)))}
                      >
                        Reload saved analysis
                      </button>
                    </>
                  )}
                  <button disabled={saving} onClick={menuAction(() => choose(''))}>
                    Change property
                  </button>
                </div>
              </details>
            </div>
          )}
        </div>
        {!selection.ok && <p role="alert">{failure(selection.code)}</p>}
        {!shown ? (
          <>
            <PropertySelector properties={properties} onSelect={choose} />
            <section className={styles.card}>
              <h2>What you’ll need</h2>
              <p>
                Saved property details fill your new ROI analysis automatically. Purchase and loan
                terms, whole-property rent, operating budgets, reserves and growth assumptions
                support the calculation. Add or change them in the property’s ROI assumptions;
                Returns &amp; ROI links straight there.
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
            <p className={styles.srOnly} role="status">
              {announcement}
            </p>
            {loading || opening ? (
              <section className={`${styles.card} ${styles.loadingCard}`} role="status">
                <h2>Loading analysis…</h2>
                <p>Saved assumptions, projections and recorded actuals for this property.</p>
                <div className={styles.skeleton} aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              </section>
            ) : !payload ? (
              <section className={`${styles.card} ${styles.empty}`} role="alert">
                <h2>This analysis did not load</h2>
                <p>
                  {message || 'Could not load analysis. Retry loading this property.'} Nothing was
                  changed.
                </p>
                <div className={styles.actions}>
                  {/* An unknown or archived property cannot load on retry. */}
                  {property && (
                    <button className={styles.primary} onClick={() => load(selected)}>
                      Retry loading
                    </button>
                  )}
                  <button onClick={() => choose('')}>Change property</button>
                </div>
              </section>
            ) : (
              <>
                <p className={styles.status} role="status" aria-live="polite">
                  {message}
                </p>
                {!!localErrors.length && (
                  <details className={styles.notice} open>
                    <summary>
                      {localErrors.length} {localErrors.length === 1 ? 'entry' : 'entries'} to
                      review
                    </summary>
                    <ul>
                      {localErrors.map((e, i) => (
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
                <div className={styles.viewRow}>
                  <div className={styles.viewTabs}>
                    <AnalysisTabs
                      id="roi-section"
                      label="ROI sections"
                      choices={SECTIONS}
                      value={view}
                      onChange={changeView}
                    />
                  </div>
                  <div className={styles.viewSelects}>
                    <label className={`field ${styles.viewSelect}`}>
                      Scope
                      <select
                        value=""
                        onChange={(event) => {
                          const unit = event.target.value;
                          if (unit)
                            leave(
                              `/properties/${encodeURIComponent(selected)}/returns?${new URLSearchParams({ unit })}`,
                            );
                        }}
                        aria-describedby="roi-scope-note"
                      >
                        <option value="">Whole property</option>
                        {(property?.units ?? []).map((unit) => (
                          <option key={unit.id} value={unit.id}>
                            Unit {unit.number} · {unit.status.toLowerCase()}
                          </option>
                        ))}
                      </select>
                      <span id="roi-scope-note" className={styles.srOnly}>
                        Projections cover the whole property. Choosing a unit opens its recorded
                        returns.
                      </span>
                    </label>
                    <label className={`field ${styles.viewSelect} ${styles.phoneOnly}`}>
                      View
                      <select value={view} onChange={(event) => changeView(event.target.value)}>
                        {SECTIONS.map((section) => (
                          <option key={section.id} value={section.id}>
                            {section.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
                {simulating && simulation && result && (
                  <WhatIfStatus
                    name={caseName}
                    saved={!!savedCase}
                    changes={changedCount}
                    simulation={simulation}
                    onEdit={openWhatIf}
                    onReset={() => setWhatIf(emptyWhatIf(selected))}
                  />
                )}
                <div className={whatIfOpen && !narrow ? w.split : undefined}>
                  <div className={w.main}>
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
                        projectionBasis={projectionBasis}
                        onPeriod={changePeriod}
                        onRetry={() => setActualsAttempt((n) => n + 1)}
                        onReviewAssumptions={() => focusField(errors[0]?.path ?? '')}
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
                          snapshot={shownPayload}
                          stale={stale}
                          saving={saving}
                          compare={panel === 'compare'}
                          propertyName={property?.name ?? 'Property'}
                        />
                        {panel === 'compare' && (
                          <CaseComparison
                            key={selected}
                            drafts={scenarios}
                            snapshot={calculatedPayload}
                            stale={stale}
                            errors={errors}
                            base={applyValues(payload, values, tax)}
                            temporary={
                              simulating && !savedCase && whatIf
                                ? {
                                    id: 'what-if',
                                    name: `${whatIf.name === 'What if' ? 'What if' : whatIf.name} (not saved)`,
                                    values: whatIf.values,
                                  }
                                : null
                            }
                            onOpenWhatIf={openWhatIf}
                          />
                        )}
                      </div>
                    ))}
                    <div
                      id="roi-section-panel-charts"
                      role="tabpanel"
                      aria-labelledby="roi-section-tab-charts"
                      hidden={view !== 'charts'}
                    >
                      <RoiProjections
                        key={selected}
                        result={shownResult}
                        calculatedPayload={shownPayload}
                        calculationVersion={calculationVersion}
                        stale={stale}
                        saving={saving}
                        onEdit={(path) => focusField(path ?? errors[0]?.path ?? '')}
                        panel={chart}
                        onPanel={changeChart}
                      />
                      {chart === 'equity' && shownResult && (
                        <div className={styles.stack}>
                          <OutcomeCard result={shownResult} />
                          <ProjectionMilestones result={shownResult} />
                        </div>
                      )}
                    </div>
                    <div
                      className={styles.layout}
                      id="roi-section-panel-summary"
                      role="tabpanel"
                      aria-labelledby="roi-section-tab-summary"
                      hidden={view !== 'summary'}
                    >
                      <div className={styles.stack}>
                        {!result && (
                          <section className={`${styles.card} ${styles.empty}`}>
                            <h2>No projection yet</h2>
                            <p>
                              {baselineErrors.length
                                ? 'Complete the assumptions listed above to see projected returns. Nothing is estimated for missing inputs.'
                                : 'Review the highlighted entries to calculate projected returns.'}{' '}
                              Recorded actuals below are unaffected.
                            </p>
                          </section>
                        )}
                        {shownResult && shownPayload && (
                          <DealSnapshot
                            key={`snapshot-${selected}`}
                            result={shownResult}
                            payload={shownPayload}
                            baseline={simulated ? result : null}
                            onCompare={() => changeView('actual')}
                            howHref="#roi-how"
                            onHow={(event) => {
                              event.preventDefault();
                              const how = document.getElementById('roi-how');
                              if (how instanceof HTMLDetailsElement) {
                                how.open = true;
                                how.scrollIntoView?.({ block: 'start' });
                                how.querySelector('summary')?.focus();
                              }
                            }}
                          />
                        )}
                        <div className={styles.twoOne}>
                          {shownResult ? (
                            <NetCashFlowYears key={`cash-${selected}`} result={shownResult} />
                          ) : null}
                          <ActualsToComplete propertyId={selected} state={actuals} />
                        </div>
                        <ActualVsProjectedSummary
                          state={actuals}
                          projection={projectionYear}
                          stale={stale}
                          window={range}
                          choice={period}
                          projectionBasis={projectionBasis}
                          onPeriod={changePeriod}
                          onOpen={() => changeView('actual')}
                        />
                        <div className={styles.pairGrid}>
                          <EstimatesPanel state={actuals} />
                          {shownResult ? <SummaryMilestones result={shownResult} /> : null}
                        </div>
                        <OptionalInputs
                          values={values}
                          demoPaths={demoFields.map((f) => f.path)}
                          editHref={editHref()}
                          onEdit={(event) => {
                            if (!dirty) return;
                            event.preventDefault();
                            editAssumptions();
                          }}
                          onTax={() => {
                            changeView('summary');
                            setTimeout(() => {
                              const tax = Array.from(
                                document.querySelectorAll<HTMLElement>(
                                  '#roi-section-panel-summary summary',
                                ),
                              ).find((s) => /^Optional tax estimate/.test(s.textContent ?? ''));
                              if (tax?.parentElement instanceof HTMLDetailsElement)
                                tax.parentElement.open = true;
                              tax?.focus();
                            }, 0);
                          }}
                        />
                        <HowCalculated id="roi-how" />
                        <section className={`${styles.card} ${styles.details}`}>
                          <h2>Analysis details</h2>
                          {shownResult && (
                            <MoreDetail
                              summary={`Advanced metrics & warnings${simulated ? ' · what if' : ''}`}
                            >
                              <dl className={styles.statement}>
                                <div>
                                  <dt>
                                    NPV - discount {percent(shownResult.assumptions.discountRate)}
                                  </dt>
                                  <dd>{money(metrics?.npv)}</dd>
                                </div>
                                <div>
                                  <dt>Debt coverage (DSCR)</dt>
                                  <dd>{metrics?.dscr?.toFixed(2) ?? 'Unavailable'}</dd>
                                </div>
                                <div>
                                  <dt>After-tax IRR - simplified estimate</dt>
                                  <dd>{percent(metrics?.afterTaxIrr)}</dd>
                                </div>
                              </dl>
                              {shownResult.warnings.map((warning, i) => (
                                <p key={i}>{warning.message}</p>
                              ))}
                            </MoreDetail>
                          )}
                          <MoreDetail summary={`Optional tax estimate${tax ? ' · on' : ''}`}>
                            <p>
                              Tax assumptions belong to this analysis and are saved with it. Leave
                              them off for before-tax results.
                            </p>
                            <fieldset disabled={saving}>
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
                              {tax && (
                                <div className={styles.fields}>{taxFields.map(renderField)}</div>
                              )}
                            </fieldset>
                          </MoreDetail>
                          {facts && (
                            <MoreDetail summary="Recorded source facts">
                              <dl className={styles.statement}>
                                <div>
                                  <dt>Recorded annual debt service</dt>
                                  <dd>{money(facts.annualDebtService)}</dd>
                                </div>
                                <div>
                                  <dt>Recorded down payment</dt>
                                  <dd>{money(facts.downPayment)}</dd>
                                </div>
                                <div>
                                  <dt>Scheduled monthly lease rent</dt>
                                  <dd>{money(facts.scheduledMonthlyRent)}</dd>
                                </div>
                                <div>
                                  <dt>Dated expense observations</dt>
                                  <dd>
                                    {facts.expenses.length}
                                    {facts.expenseHistoryTruncated ? ' (history truncated)' : ''}
                                  </dd>
                                </div>
                              </dl>
                              <p>
                                The forecast uses the loan terms you enter, and dated expenses are
                                not annual budgets.
                              </p>
                              <ul className={styles.sources}>
                                {payload.evidence
                                  .filter((e) => e.source !== 'manager')
                                  .map((e, i) => (
                                    <li key={i}>
                                      <strong>{fieldLabel(e.path)}</strong> - {e.source} - {e.note}
                                    </li>
                                  ))}
                              </ul>
                            </MoreDetail>
                          )}
                        </section>
                        {vacantUnit && (
                          <a
                            className={styles.vacantLink}
                            href={buildCompsHref(rentAnalysisContext(selected, vacantUnit.id))}
                          >
                            Unit {vacantUnit.number} is vacant · check its rent in Rent analysis →
                          </a>
                        )}
                        <nav className={styles.deeper} aria-label="Explore analysis">
                          <button onClick={() => changeView('actual')}>
                            Actual vs projected →
                          </button>
                          <button
                            onClick={() => {
                              changeView('compare');
                              setTimeout(
                                () =>
                                  document
                                    .getElementById('roi-saved-cases')
                                    ?.scrollIntoView?.({ block: 'start' }),
                                0,
                              );
                            }}
                          >
                            Compare saved cases →
                          </button>
                          <button
                            onClick={() => {
                              changeView('charts');
                              changeChart('exit');
                            }}
                          >
                            Exit analysis →
                          </button>
                        </nav>
                      </div>
                    </div>
                  </div>
                  {whatIf && payload && (
                    <WhatIfPanel
                      open={whatIfOpen}
                      modal={narrow}
                      onClose={closeWhatIf}
                      scopeLabel={`${property?.name ?? 'Property'} · whole property`}
                      state={whatIf}
                      onState={setWhatIf}
                      base={calculatedPayload ?? applyValues(payload, values, tax)}
                      baselinePayload={calculatedPayload}
                      baselineResult={result}
                      simulation={simulation}
                      drafts={scenarios}
                      onDrafts={(d) => {
                        // An in-flight save installs its reply; an edit now would be dropped.
                        if (saving) return;
                        setScenarios(d);
                        setDirty(true);
                        setErrors([]);
                        setCalculationVersion((v) => v + 1);
                      }}
                      errors={errors}
                      saving={saving || conflict}
                      busy={saving}
                      dirty={dirty}
                      saveLabel={savedStatus === 'READY' ? 'Save ready' : 'Save draft'}
                      onSave={() => save(savedStatus === 'READY' ? 'READY' : 'DRAFT')}
                      onExit={exitWhatIf}
                    />
                  )}
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
            {!!localErrors.length && (
              <button
                disabled={saving}
                onClick={() => {
                  setRecovery(pending);
                  setPending(null);
                  focusField(localErrors[0].path);
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
              <button disabled={saving} onClick={() => continueTo(pending)}>
                Discard and continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
