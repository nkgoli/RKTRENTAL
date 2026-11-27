'use client';

import { useEffect, useRef, useState } from 'react';
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
  Insight,
  MoreDetail,
  Tiles,
  entityColors,
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
          {name}
          <InfoTip label={name}>{about}</InfoTip>
        </span>
        <span className={d.amount}>
          {change != null && Math.round(change) !== 0 && (
            <small data-tone={change > 0 ? 'red' : undefined}>{signed(change)}</small>
          )}
          <b>{wholeDollars(value)}</b>
          <em>{shareText}</em>
        </span>
      </div>
      <span className={d.track} aria-hidden="true">
        <span style={{ width: `${width}%`, background: color }} />
      </span>
    </li>
  );
}

/** C10 · Operating expenses by category, largest first. */
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
      title="Operating expenses"
      subtitle={
        data.growth != null && Math.abs(data.growth) >= 0.005 ? (
          <b className={d.growth}>
            ({data.growth > 0 ? '+' : ''}
            {(data.growth * 100).toFixed(0)}% vs Y1)
          </b>
        ) : undefined
      }
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
            label: 'Total',
            value: (
              <span data-simulated={simulating || undefined} className={d.total}>
                {wholeDollars(total)}
              </span>
            ),
            note: `${wholeDollars(total / 12)}/mo`,
            info: 'Total operating expenses for the selected year (excludes debt service and capital reserves)',
          },
          {
            label: 'OpEx ratio',
            value: share(ratio, 1),
            negative: ratio != null && ratio > 0.5,
            note: 'Typical: 35–50%',
            info: 'Operating Expenses ÷ Effective Gross Income. Lower is better. Reserves are not included.',
          },
          {
            label: 'Top driver',
            value: <span className={d.driver}>{top?.name ?? 'None'}</span>,
            note: top
              ? `${wholeDollars(top.value)} (${share(total > 0 ? top.value / total : null)})`
              : 'No operating costs',
            info: 'The largest expense category — your biggest lever for cost reduction',
          },
          {
            label: 'Reserves',
            value: wholeDollars(data.reserves),
            note: `${share(data.total > 0 ? data.reserves / data.total : null)} of OpEx`,
            info: 'CapEx reserve for major replacements. Deducted below NOI, so not included in operating expenses.',
          },
        ]}
      />
      <section className={d.panel} aria-labelledby="expense-breakdown-title">
        <header>
          <h3 id="expense-breakdown-title">By category</h3>
          <SortMenu value={sort} onChange={setSort} />
        </header>
        {sorted.length || data.reserves > 0 ? (
          <ul className={d.expenses}>
            {sorted.map((c) => (
              <Row
                key={c.key}
                name={c.name}
                color={entityColors.expenses}
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
                  color={entityColors.reserves}
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
          <p className={d.empty}>No operating expenses or reserves for this year.</p>
        )}
      </section>
      <div className={d.insightRow}>
        <Insight>
          {simulating ? (
            <>
              Simulating 10% tax reduction: saves <Figure>{wholeDollars(cut)}/year</Figure> (
              {wholeDollars(cut / 12)}/mo); saved assumptions are unchanged.
            </>
          ) : byAmount[0] ? (
            <>
              {byAmount[0].name} is the largest cost at{' '}
              <Figure>{wholeDollars(byAmount[0].value)}/year</Figure>.
            </>
          ) : (
            <>No operating expenses are entered.</>
          )}
        </Insight>
        {canSimulate && (
          <button
            type="button"
            className={d.cta}
            aria-pressed={simulating}
            data-active={simulating || undefined}
            onClick={() => setSimulate(!simulate)}
          >
            {simulating ? 'Reset' : 'Simulate −10% tax'}
          </button>
        )}
      </div>
      <MoreDetail summary="View exact amounts">
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
      <ChartCard title="Expense growth" controls={horizon}>
        <ComboChart
          label="Operating expenses and capital reserves"
          years={visible.map((r) => r.year)}
          series={[
            {
              label: 'Operating expenses',
              values: visible.map((r) => r.operatingExpenses),
              color: entityColors.expenses,
            },
            {
              label: 'Capital reserves',
              values: visible.map((r) => r.reserves),
              color: entityColors.reserves,
            },
          ]}
        />
        <MoreDetail summary="View exact amounts">
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
