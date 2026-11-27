'use client';

import { Fragment, useState, type ReactNode } from 'react';
import { dollars, loanYears, type ProjectionResult } from '@/lib/analysis/projections';
import {
  amortizationTicks,
  loanMilestones,
  loanSummaries,
  wholeDollars,
} from '@/lib/analysis/chart-data';
import {
  ChartCard,
  ComboChart,
  ExactTable,
  Icon,
  InfoTip,
  MoreDetail,
  Segmented,
  Tiles,
  entityColors,
} from './RoiChart';
import styles from './analysis.module.css';
import chartStyles from './projections.module.css';
import d from './detail-charts.module.css';

const share = (v: number | null) =>
  v == null || !Number.isFinite(v) ? 'Unavailable' : `${(v * 100).toFixed(0)}%`;
const loanColors = {
  balance: entityColors.balance,
  principal: entityColors.principal,
  interest: entityColors.interest,
};

/** C11 · Loan paydown: balance still owed and running principal and interest, full term. */
function PrincipalVsInterest({ result }: { result: ProjectionResult }) {
  const rows = loanYears(result);
  const last = result.amortizationSchedule.at(-1);
  // The engine includes the maturity payoff in the actual final payment.
  const balloon = last && last.payment > result.summaryMetrics.monthlyDebtService + 1;
  const years = rows.map((r) => r.year);
  return (
    <ChartCard title="Loan paydown" subtitle={`Full ${rows.length}-year loan term`}>
      <ComboChart
        label="Loan balance and cumulative principal and interest"
        xLabel="Loan year"
        years={years}
        xFormat={(y) => `Year ${y}`}
        xTicks={amortizationTicks(years)}
        series={[
          {
            label: 'Loan balance',
            values: rows.map((r) => r.balance),
            color: loanColors.balance,
          },
          {
            label: 'Principal paid',
            values: rows.map((r) => r.cumulativePrincipal),
            color: loanColors.principal,
          },
          {
            label: 'Interest paid',
            values: rows.map((r) => r.cumulativeInterest),
            color: loanColors.interest,
          },
        ]}
        tooltip={(i) => ({
          title: `Year ${rows[i].year}`,
          rows: [
            {
              label: 'Balance',
              value: rows[i].balance,
              swatch: { color: loanColors.balance, kind: 'line' },
            },
            {
              label: 'Principal paid',
              value: rows[i].cumulativePrincipal,
              swatch: { color: loanColors.principal, kind: 'line' },
            },
            {
              label: 'Interest paid',
              value: rows[i].cumulativeInterest,
              swatch: { color: loanColors.interest, kind: 'line' },
            },
          ],
        })}
      />
      {balloon && (
        <p className={styles.notice}>
          Balloon payment of {dollars(last.payment)} in month {last.month} (year {last.year}
          {last.date ? `, ${last.date.toISOString().slice(0, 10)}` : ''}), included in cash flow
          when the hold reaches it.
        </p>
      )}
    </ChartCard>
  );
}

function InsightCard({
  label,
  about,
  control,
  children,
}: {
  label: string;
  about: string;
  control?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={d.insightCard}>
      <header>
        <span>{label}</span>
        <span>
          <InfoTip label={label}>{about}</InfoTip>
          {control}
        </span>
      </header>
      {children}
    </div>
  );
}

/** C12 / C13 / C17 · Loan schedule: totals, the yearly split and the payoff milestones. */
function Schedule({ result, children }: { result: ProjectionResult; children?: ReactNode }) {
  const loan = result.summaryMetrics.loanAmount;
  const years = loanSummaries(loanYears(result), loan);
  const [mode, setMode] = useState<'summary' | 'detailed'>('summary');
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [period, setPeriod] = useState(5);
  const [at, setAt] = useState(10);
  const marks = loanMilestones(years);
  const final = years.at(-1)!;
  const totalInterest = final.cumulativeInterest;
  const totalPaid = loan + totalInterest;
  const early = years.slice(0, period).reduce((sum, r) => sum + r.interest, 0);
  const balanceAt = years.find((r) => r.year === at);
  const detailed = mode === 'detailed';
  const toggle = (year: number) =>
    setOpen((now) => {
      const next = new Set(now);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  return (
    <ChartCard title="Loan schedule">
      <Tiles
        items={[
          {
            label: 'Loan amount',
            value: wholeDollars(loan),
            note: marks.half ? `50% paid off by Y${marks.half}` : undefined,
          },
          {
            label: 'Monthly payment',
            value: wholeDollars(result.summaryMetrics.monthlyDebtService),
          },
          {
            label: 'Total interest',
            value: wholeDollars(totalInterest),
            note: `${share(loan > 0 ? totalInterest / loan : null)} of principal`,
          },
          { label: 'Total paid', value: wholeDollars(totalPaid), note: `Over ${years.length} years` },
        ]}
      />
      <div className={d.tableBar}>
        <Segmented
          label="Schedule view"
          options={[
            { value: 'summary', label: 'Summary' },
            { value: 'detailed', label: 'Detailed' },
          ]}
          value={mode}
          onChange={setMode}
        />
        {detailed && (
          <div className={d.links}>
            <button type="button" onClick={() => setOpen(new Set(years.map((r) => r.year)))}>
              Expand all
            </button>
            <span aria-hidden="true">|</span>
            <button type="button" onClick={() => setOpen(new Set())}>
              Collapse all
            </button>
          </div>
        )}
      </div>
      <div className={d.schedule} role="region" tabIndex={0} aria-label="Loan schedule by year">
        <table>
          <caption className={d.srOnly}>
            Loan schedule by year · whole dollars · share of the original loan repaid
          </caption>
          <thead>
            <tr>
              <th scope="col">Year</th>
              <th scope="col">Beginning</th>
              <th scope="col">Principal</th>
              <th scope="col">Interest</th>
              <th scope="col">Ending</th>
              <th scope="col">Paid off</th>
            </tr>
          </thead>
          <tbody>
            {years.map((r) => {
              const expanded = detailed && open.has(r.year);
              const months = expanded
                ? result.amortizationSchedule.filter((m) => m.year === r.year)
                : [];
              return (
                <Fragment key={r.year}>
                  <tr
                    data-expanded={expanded || undefined}
                    onClick={detailed ? () => toggle(r.year) : undefined}
                    className={detailed ? d.clickable : undefined}
                  >
                    <th scope="row">
                      {detailed ? (
                        <button
                          type="button"
                          aria-expanded={expanded}
                          aria-label={`Year ${r.year} monthly payments`}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggle(r.year);
                          }}
                        >
                          <Icon name={expanded ? 'chevronDown' : 'chevronRight'} size={16} />
                        </button>
                      ) : null}
                      Y{r.year}
                      {r.year === marks.half && <span className={d.badge}>50%</span>}
                      {r.year === marks.principalBeatsInterest && (
                        <span className={d.badge}>P{'>'} I</span>
                      )}
                    </th>
                    <td>{wholeDollars(r.beginning)}</td>
                    <td>{wholeDollars(r.principal)}</td>
                    <td>{wholeDollars(r.interest)}</td>
                    <td>{wholeDollars(r.balance)}</td>
                    <td>
                      <span className={d.paid}>
                        <span aria-hidden="true">
                          <i
                            style={{ width: `${Math.max(0, Math.min(1, r.paidOff ?? 0)) * 100}%` }}
                          />
                        </span>
                        {share(r.paidOff)}
                      </span>
                    </td>
                  </tr>
                  {months.map((m, k) => (
                    <tr key={`m-${m.month}`} className={d.month}>
                      <th scope="row">Month {m.month}</th>
                      <td>{wholeDollars(k === 0 ? r.beginning : months[k - 1].balance)}</td>
                      <td>{wholeDollars(m.principal)}</td>
                      <td>{wholeDollars(m.interest)}</td>
                      <td>{wholeDollars(m.balance)}</td>
                      <td>
                        {loan > 0
                          ? `${(((loan - m.balance) / loan) * 100).toFixed(1)}%`
                          : 'Unavailable'}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className={d.insightCards}>
        <InsightCard
          label={`Interest, first ${period} years`}
          about="Most interest is front-loaded in the early years. This shows the cost before principal paydown accelerates."
          control={
            <select
              aria-label="Interest period"
              value={period}
              onChange={(e) => setPeriod(Number(e.target.value))}
            >
              {[1, 5, 10].map((y) => (
                <option key={y} value={y}>
                  {y}y
                </option>
              ))}
            </select>
          }
        >
          <strong>{wholeDollars(early)}</strong>
          <small>
            {share(totalInterest > 0 ? early / totalInterest : null)} of total interest
            {period > years.length && ` · the term is ${years.length} years`}
          </small>
        </InsightCard>
        <InsightCard
          label="Principal > interest"
          about="From this year onward, more of each year's payments reduce the loan balance than go to interest."
        >
          {marks.principalBeatsInterest ? (
            <>
              <strong>Y{marks.principalBeatsInterest}</strong>
              {marks.principalBeatsInterest === 1 && <small>From the start</small>}
            </>
          ) : (
            <strong data-size="sm">Not within term</strong>
          )}
        </InsightCard>
        <InsightCard
          label={`Balance at year ${at}`}
          about="If you sell or refinance at this point, this is what's left on the loan. Interest saved is the scheduled interest after that year, avoided if the loan is repaid then."
          control={
            <select
              aria-label="Balance year"
              value={at}
              onChange={(e) => setAt(Number(e.target.value))}
            >
              {[5, 10, 15, 20].map((y) => (
                <option key={y} value={y}>
                  Y{y}
                </option>
              ))}
            </select>
          }
        >
          {balanceAt ? (
            <>
              <strong>{wholeDollars(balanceAt.balance)}</strong>
              <small>
                Interest saved: <b>{wholeDollars(totalInterest - balanceAt.cumulativeInterest)}</b>
              </small>
            </>
          ) : (
            <>
              <strong data-size="sm">
                Term {'<'} {at}y
              </strong>
              <small>Select an earlier year</small>
            </>
          )}
        </InsightCard>
      </div>
      {children}
    </ChartCard>
  );
}

export function Amortization({ result }: { result: ProjectionResult }) {
  const rows = loanYears(result);
  const [year, setYear] = useState(1);
  if (result.summaryMetrics.loanAmount === 0 || !rows.length)
    return (
      <div className={chartStyles.stack}>
        <ChartCard title="Loan paydown">
          <p>All-cash purchase · debt service $0.00.</p>
        </ChartCard>
      </div>
    );
  return (
    <div className={chartStyles.stack}>
      <PrincipalVsInterest result={result} />
      <Schedule result={result}>
        <MoreDetail summary="View annual payments">
          <ExactTable
            caption="Annual loan payments · USD · full loan term"
            headers={['Year', 'Payment', 'Principal', 'Interest', 'Ending balance']}
            rows={rows.map((r) => [
              r.year,
              ...[r.payment, r.principal, r.interest, r.balance].map(dollars),
            ])}
          />
        </MoreDetail>
        <MoreDetail summary="View monthly payments">
          <label className={`${styles.field} ${d.yearPick}`}>
            Loan schedule year
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {rows.map((r) => (
                <option key={r.year} value={r.year}>
                  Year {r.year}
                </option>
              ))}
            </select>
          </label>
          <ExactTable
            caption={`Monthly loan payments · year ${year} · USD`}
            headers={['Month', 'Date (UTC)', 'Payment', 'Principal', 'Interest', 'Balance']}
            rows={result.amortizationSchedule
              .filter((r) => r.year === year)
              .map((r) => [
                r.month,
                r.date?.toISOString().slice(0, 10) ?? 'Unavailable',
                ...[r.payment, r.principal, r.interest, r.balance].map(dollars),
              ])}
          />
        </MoreDetail>
      </Schedule>
    </div>
  );
}
