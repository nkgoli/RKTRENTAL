'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { dollars, projectionRows, type ProjectionResult } from '@/lib/analysis/projections';
import {
  capexCategory,
  expenseYear,
  sortExpenses,
  wholeDollars,
  type ExpenseSort,
} from '@/lib/analysis/chart-data';
import {
  ChartCard,
  ComboChart,
  ExactTable,
  Figure,
  Icon,
  InfoTip,
  MoreDetail,
  Tiles,
  chartColors,
  useHorizon,
} from './RoiChart';
import chartStyles from './projections.module.css';
import d from './detail-charts.module.css';

const sortLabels: Record<ExpenseSort, [string, string]> = {
  amount: ['Amount', 'Amount'],
  percent: ['% Share', '% Share'],
  change: ['Biggest Δ', 'Biggest Δ vs Y1'],
};
const share = (v: number | null, digits = 0) =>
  v == null || !Number.isFinite(v) ? 'Unavailable' : `${(v * 100).toFixed(digits)}%`;
const signed = (v: number) => `${v > 0 ? '+' : ''}${wholeDollars(v)}`;

/** Reference "Sort: Amount ▾" menu: a menu button with radio items. */
function SortMenu({ value, onChange }: { value: ExpenseSort; onChange: (v: ExpenseSort) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    box.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
    const close = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  const modes = Object.keys(sortLabels) as ExpenseSort[];
  return (
    <div className={d.sort} ref={box}>
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        Sort: {sortLabels[value][0]}
        <Icon name="chevronDown" size={12} />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Sort expenses"
          onKeyDown={(event) => {
            const items = [...box.current!.querySelectorAll<HTMLElement>('[role="menuitemradio"]')];
            const at = items.indexOf(document.activeElement as HTMLElement);
            if (event.key === 'Escape') {
              event.preventDefault();
              setOpen(false);
              button.current?.focus();
            } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              const step = event.key === 'ArrowDown' ? 1 : -1;
              items[(at + step + items.length) % items.length]?.focus();
            }
          }}
        >
          {modes.map((mode) => (
            <button
              key={mode}
              type="button"
              role="menuitemradio"
              aria-checked={mode === value}
              tabIndex={mode === value ? 0 : -1}
              onClick={() => {
                onChange(mode);
                setOpen(false);
                button.current?.focus();
              }}
            >
              {sortLabels[mode][1]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({
  name,
  color,
  about,
  value,
  max,
  shareText,
  change,
}: {
  name: string;
  color: string;
  about: string;
  value: number;
  max: number;
  shareText: string;
  change: number | null;
}) {
  const width = max > 0 ? (value / max) * 100 : 0;
  return (
    <li className={d.expense}>
      <div>
        <span className={d.name}>
          <i style={{ background: color }} aria-hidden="true" />
          {name}
          <InfoTip label={name}>{about}</InfoTip>
        </span>
        <span className={d.amount}>
          {change != null && Math.round(change) !== 0 && (
            <small data-tone={change > 0 ? 'red' : 'green'}>
              <Icon name={change > 0 ? 'up' : 'down'} size={12} />
              {signed(change)}
            </small>
          )}
          <b>{wholeDollars(value)}</b>
          <em>({shareText})</em>
        </span>
      </div>
      <span className={d.track} aria-hidden="true">
        <span style={{ width: `${width}%`, background: color }}>
          {width > 40 && wholeDollars(value)}
        </span>
      </span>
    </li>
  );
}

const advice: Record<string, (value: number) => ReactNode> = {
  propertyTax: (v) => (
    <>
      {' '}
      Appealing the assessment could save <Figure>{wholeDollars(v * 0.1)}</Figure>–
      <Figure>{wholeDollars(v * 0.2)}</Figure>/year.
    </>
  ),
  propertyManagement: (v) => (
    <>
      {' '}
      Self-managing saves <Figure>{wholeDollars(v)}/year</Figure>, but requires 5–10 hrs/month.
    </>
  ),
  insurance: (v) => (
    <>
      {' '}
      Shopping around could save <Figure>{wholeDollars(v * 0.15)}</Figure>–
      <Figure>{wholeDollars(v * 0.25)}</Figure>/year.
    </>
  ),
  hoa: () => (
    <> HOA fees are typically non-negotiable. Review the reserve fund health before buying.</>
  ),
  maintenance: () => (
    <> Newer properties (built after 2000) often run 20–30% lower on maintenance.</>
  ),
};

/** C10 · Operating Expenses (reference ExpenseBreakdownPanel). */
function OperatingExpenses({ result }: { result: ProjectionResult }) {
  const rows = projectionRows(result);
  const [year, horizon] = useHorizon(rows.length, 'Operating expenses year', 1);
  const [sort, setSort] = useState<ExpenseSort>('amount');
  const [simulate, setSimulate] = useState(false);
  const data = expenseYear(result.expenseBreakdown, rows, year)!;
  const sorted = sortExpenses(data.categories, sort);
  const byAmount = sortExpenses(data.categories, 'amount');
  const tax = data.categories.find((c) => c.key === 'propertyTax');
  // The what-if is offered when tax is the largest cost, as in the reference.
  const canSimulate = byAmount[0]?.key === 'propertyTax';
  const simulating = simulate && canSimulate;
  const cut = simulating && tax ? tax.value * 0.1 : 0;
  const total = data.total - cut;
  const ratio = data.effectiveIncome > 0 ? total / data.effectiveIncome : null;
  // Top driver after any what-if: tax keeps the title while it is still largest.
  const top = sortExpenses(
    data.categories.map((c) => (c.key === 'propertyTax' ? { ...c, value: c.value - cut } : c)),
    'amount',
  )[0];
  const max = Math.max(data.reserves, ...data.categories.map((c) => c.value), 0);
  const showChange = year > 1 && sort === 'change';
  return (
    <ChartCard
      title="Operating Expenses"
      subtitle={
        <>
          Where the operating budget goes in year {year}, largest cost first.
          {data.growth != null && Math.abs(data.growth) >= 0.005 && (
            <b className={d.growth} data-tone={data.growth > 0 ? 'red' : 'teal'}>
              ({data.growth > 0 ? '+' : ''}
              {(data.growth * 100).toFixed(0)}% vs Y1)
            </b>
          )}
        </>
      }
      basis={['Projected', 'USD per year', `Year ${year}`, 'Before tax']}
      controls={
        horizon && (
          <div>
            <span className={d.controlLabel} aria-hidden="true">
              Year shown
            </span>
            {horizon}
          </div>
        )
      }
    >
      <Tiles
        items={[
          {
            label: 'Operating Expenses',
            value: (
              <span data-simulated={simulating || undefined} className={d.total}>
                {wholeDollars(total)}
              </span>
            ),
            note: `${wholeDollars(total / 12)}/mo`,
            tone: 'muted',
            info: 'Total operating expenses for the selected year (excludes debt service and capital reserves)',
          },
          {
            label: 'OpEx Ratio',
            value: share(ratio, 1),
            valueTone:
              ratio == null ? undefined : ratio > 0.5 ? 'red' : ratio > 0.4 ? 'amber' : 'green',
            note: 'Typical: 35–50%',
            tone: 'blue',
            info: 'Operating Expenses ÷ Effective Gross Income. Lower is better. Reserves are not included.',
          },
          {
            label: 'Top Driver',
            value: <span className={d.driver}>{top?.name ?? 'None'}</span>,
            note: top
              ? `${wholeDollars(top.value)} (${share(total > 0 ? top.value / total : null)})`
              : 'No operating costs',
            tone: 'amber',
            info: 'The largest expense category — your biggest lever for cost reduction',
          },
          {
            label: 'Reserves',
            value: wholeDollars(data.reserves),
            note: `${share(data.total > 0 ? data.reserves / data.total : null)} of OpEx`,
            tone: 'muted',
            info: 'CapEx reserve for major replacements. Deducted below NOI, so not included in operating expenses.',
          },
        ]}
      />
      <section className={d.panel} aria-labelledby="expense-breakdown-title">
        <header>
          <h3 id="expense-breakdown-title">Expense Breakdown</h3>
          <SortMenu value={sort} onChange={setSort} />
        </header>
        {sorted.length || data.reserves > 0 ? (
          <ul className={d.expenses}>
            {sorted.map((c) => (
              <Row
                key={c.key}
                name={c.name}
                color={c.color}
                about={c.about}
                value={c.value}
                max={max}
                shareText={share(c.percent)}
                change={showChange ? c.change : null}
              />
            ))}
            {data.reserves > 0 && (
              <>
                <li className={d.divider} aria-hidden="true">
                  Below NOI
                </li>
                <Row
                  name={capexCategory.name}
                  color={capexCategory.color}
                  about={capexCategory.about}
                  value={data.reserves}
                  max={max}
                  shareText={`${share(data.total > 0 ? data.reserves / data.total : null)} of OpEx`}
                  change={showChange ? data.reserves - data.reservesYear1 : null}
                />
              </>
            )}
          </ul>
        ) : (
          <p className={d.empty}>No operating expenses or reserves are entered for this year.</p>
        )}
      </section>
      <div className={d.insightRow}>
        <p>
          <strong>Insight:</strong>{' '}
          {simulating ? (
            <>
              <b className={d.good}>Simulating 10% tax reduction</b> saves{' '}
              <Figure>{wholeDollars(cut)}/year</Figure> (
              <Figure>{wholeDollars(cut / 12)}/mo</Figure>
              ). What-if only: saved assumptions are unchanged.
            </>
          ) : byAmount[0] ? (
            <>
              <b className={d.driverText}>{byAmount[0].name}</b> is your largest expense at{' '}
              <Figure>{wholeDollars(byAmount[0].value)}/year</Figure>.
              {advice[byAmount[0].key]?.(byAmount[0].value)}
            </>
          ) : (
            <>No operating expenses are entered.</>
          )}
          {!simulating && ratio != null && ratio > 0.5 && (
            <>
              {' '}
              OpEx ratio of <Figure tone="red">{share(ratio)}</Figure> is high. Every 5% reduction
              adds <Figure>{wholeDollars(data.effectiveIncome * 0.05)}</Figure> to NOI.
            </>
          )}
        </p>
        {canSimulate && (
          <button
            type="button"
            className={d.cta}
            aria-pressed={simulating}
            data-active={simulating || undefined}
            onClick={() => setSimulate(!simulate)}
          >
            <Icon name="sparkles" size={12} />
            {simulating ? 'Reset' : 'Simulate −10% Tax'}
          </button>
        )}
      </div>
      <p className={d.note}>
        <Icon name="pie" size={12} />
        <span>
          <b>Maintenance</b> = small/medium repairs. <b>CapEx</b> = major replacements (roof, HVAC).
          Both are budgeted; CapEx is a reserve deducted below NOI.
        </span>
      </p>
      <MoreDetail summary={`Exact amounts by category, year ${year}`}>
        <ExactTable
          caption={`Expense categories · year ${year} · USD per year`}
          headers={['Category', 'Amount', 'Share of operating expenses', 'Change vs year 1']}
          rows={[
            ...byAmount.map((c) => [
              c.name,
              dollars(c.value),
              share(c.percent, 1),
              dollars(c.change),
            ]),
            [
              'Operating expenses',
              dollars(data.total),
              share(data.total > 0 ? 1 : null, 1),
              dollars(data.total - data.year1Total),
            ],
            [
              'CapEx reserve (below NOI)',
              dollars(data.reserves),
              'Not operating',
              dollars(data.reserves - data.reservesYear1),
            ],
          ]}
        />
      </MoreDetail>
    </ChartCard>
  );
}

export function Expenses({ result, onEdit }: { result: ProjectionResult; onEdit: () => void }) {
  const rows = projectionRows(result);
  const [shown, horizon] = useHorizon(rows.length, 'Expense growth horizon');
  const visible = rows.slice(0, shown);
  return (
    <div className={chartStyles.stack}>
      <OperatingExpenses result={result} />
      <ChartCard
        title="Expense growth"
        subtitle="Operating expenses (solid) and the capital reserve set aside below NOI (dashed), each year."
        basis={['Projected', 'USD per year', 'Before tax']}
        controls={horizon}
      >
        <ComboChart
          label="Operating expenses and capital reserves"
          years={visible.map((r) => r.year)}
          series={[
            {
              label: 'Operating expenses',
              values: visible.map((r) => r.operatingExpenses),
              color: chartColors.primaryDark,
            },
            {
              label: 'Capital reserves',
              values: visible.map((r) => r.reserves),
              color: chartColors.warn,
              dashed: true,
            },
          ]}
        />
        <MoreDetail summary="How expenses grow">
          <p className={d.detailText}>
            A fixed dollar input replaces its percentage. Year-one percentage-based dollar costs
            grow at the expense-growth assumption; they are not recalculated from later rent.
          </p>
          <p className={d.detailText}>
            NOI excludes capital reserves. Reserves reduce spendable cash after debt service.
          </p>
        </MoreDetail>
        <MoreDetail summary={`Exact expense projections, all ${rows.length} years`}>
          <ExactTable
            caption="Expense projections · USD per year"
            headers={['Year', 'Effective income', 'Operating expenses', 'Capital reserves']}
            rows={rows.map((r) => [
              r.year,
              ...[r.effectiveGrossIncome, r.operatingExpenses, r.reserves].map(dollars),
            ])}
          />
        </MoreDetail>
        <div>
          <button onClick={onEdit}>Edit expense assumptions</button>
        </div>
      </ChartCard>
    </div>
  );
}
