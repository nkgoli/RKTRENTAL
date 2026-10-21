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
  Chips,
  ComboChart,
  ExactTable,
  Icon,
  InfoTip,
  MoreDetail,
  Tiles,
  chartColors,
  type IconName,
} from './RoiChart';
import styles from './analysis.module.css';
import chartStyles from './projections.module.css';
import d from './detail-charts.module.css';

const share = (v: number | null) =>
  v == null || !Number.isFinite(v) ? 'Unavailable' : `${(v * 100).toFixed(0)}%`;
const loanColors = {
  balance: chartColors.bad,
  principal: chartColors.accent,
  interest: chartColors.warm,
};

/** C11 · Principal vs Interest Over Time (reference LoanAmortizationChart, annual). */
function PrincipalVsInterest({ result }: { result: ProjectionResult }) {
  const rows = loanYears(result);
  const last = result.amortizationSchedule.at(-1);
  // The engine includes the maturity payoff in the actual final payment.
  const balloon = last && last.payment > result.summaryMetrics.monthlyDebtService + 1;
  const years = rows.map((r) => r.year);
  const zero = rows.map(() => 0);
  return (
    <ChartCard
      title="Principal vs Interest Over Time"
      subtitle="What is still owed, and how much principal and interest you have paid so far."
      basis={['Scheduled loan', 'USD', 'Running totals', `Full ${rows.length}-year term`]}
    >
      <ComboChart
        label="Loan balance and cumulative principal and interest"
        xLabel="Loan year"
        height={300}
        years={years}
        xFormat={(y) => `Year ${y}`}
        xTicks={amortizationTicks(years)}
        series={[
          {
            label: 'Loan Balance',
            values: rows.map((r) => r.balance),
            color: loanColors.balance,
            width: 2.5,
            dot: 0,
          },
          {
            label: 'Principal Paid',
            values: rows.map((r) => r.cumulativePrincipal),
            color: loanColors.principal,
            width: 2.5,
            dot: 0,
          },
          {
            label: 'Interest Paid',
            values: rows.map((r) => r.cumulativeInterest),
            color: loanColors.interest,
            width: 2.5,
            dot: 0,
          },
        ]}
        areas={[
          {
            upper: rows.map((r) => r.balance),
            lower: zero,
            color: loanColors.balance,
            opacity: 0.15,
          },
          {
            upper: rows.map((r) => r.cumulativePrincipal),
            lower: zero,
            color: loanColors.principal,
            opacity: 0.15,
          },
          {
            upper: rows.map((r) => r.cumulativeInterest),
            lower: zero,
            color: loanColors.interest,
            opacity: 0.15,
          },
        ]}
        legend={[
          { label: 'Loan Balance', kind: 'dotLine', color: loanColors.balance },
          { label: 'Principal Paid', kind: 'dotLine', color: loanColors.principal },
          { label: 'Interest Paid', kind: 'dotLine', color: loanColors.interest },
        ]}
        tooltip={(i) => ({
          title: `Year ${rows[i].year}`,
          rows: [
            {
              label: 'Remaining Balance:',
              value: rows[i].balance,
              swatch: { color: loanColors.balance },
            },
            {
              label: 'Principal Paid:',
              value: rows[i].cumulativePrincipal,
              color: chartColors.accentDark,
              swatch: { color: loanColors.principal },
            },
            {
              label: 'Interest Paid:',
              value: rows[i].cumulativeInterest,
              color: chartColors.warn,
              swatch: { color: loanColors.interest },
            },
          ],
        })}
      />
      <p>
        The chart covers the whole loan, including years after the planned sale. Until the principal
        line rises above the interest line, you have paid more in interest than you have repaid.
      </p>
      {balloon && (
        <p className={styles.notice}>
          Balloon maturity · month {last.month}, year {last.year}
          {last.date ? ` · ${last.date.toISOString().slice(0, 10)}` : ''}. Final payment including
          remaining principal: {dollars(last.payment)}. This outflow is included in cash flow when
          the hold reaches maturity.
        </p>
      )}
    </ChartCard>
  );
}

function InsightCard({
  icon,
  tone,
  label,
  about,
  control,
  children,
}: {
  icon: IconName;
  tone: 'slate' | 'teal' | 'amber';
  label: string;
  about: string;
  control?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={d.insightCard}>
      <header>
        <span>
          <span className={d.chip} data-tone={tone} aria-hidden="true">
            <Icon name={icon} size={12} />
          </span>
          {label}
        </span>
        <span>
          <InfoTip label={label}>{about}</InfoTip>
          {control}
        </span>
      </header>
      {children}
    </div>
  );
}

/** C12 / C13 / C17 · Loan Amortization Schedule (reference AmortizationTable). */
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
  const principalShare = totalPaid > 0 ? loan / totalPaid : null;
  const interestShare = totalPaid > 0 ? totalInterest / totalPaid : null;
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
    <ChartCard
      title="Loan Amortization Schedule"
      subtitle="How each year's payments split between principal and interest; choose Detailed to see every month."
      basis={['Scheduled loan', 'USD, whole dollars', `${years.length}-year term`]}
      controls={
        <div className={d.dotKey} aria-hidden="true">
          <span>
            <i style={{ background: chartColors.primary }} />
            Principal
          </span>
          <span>
            <i style={{ background: chartColors.warm }} />
            Interest
          </span>
        </div>
      }
    >
      <Tiles
        items={[
          {
            label: 'Loan Amount',
            value: wholeDollars(loan),
            tone: 'card',
            icon: { name: 'dollar' },
          },
          {
            label: 'Monthly Payment',
            value: wholeDollars(result.summaryMetrics.monthlyDebtService),
            valueTone: 'teal',
            note: 'Scheduled; final payment may differ',
            tone: 'card',
            icon: { name: 'calendar', tone: 'teal' },
          },
          {
            label: 'Total Interest',
            value: wholeDollars(totalInterest),
            valueTone: 'amber',
            note: `${share(loan > 0 ? totalInterest / loan : null)} of principal`,
            tone: 'card',
            icon: { name: 'percent', tone: 'amber' },
          },
          {
            label: 'Total Paid',
            value: wholeDollars(totalPaid),
            note: `Over ${years.length} years`,
            tone: 'card',
            icon: { name: 'down' },
          },
        ]}
      />
      <section className={d.payoff} aria-labelledby="payoff-title">
        <header>
          <h3 id="payoff-title">Loan Payoff Breakdown</h3>
          <span>Principal vs Interest over loan term</span>
        </header>
        <div
          className={d.payoffBar}
          role="img"
          aria-label={`Principal ${share(principalShare)}, interest ${share(interestShare)} of total paid`}
        >
          <i
            style={{ width: `${(principalShare ?? 0) * 100}%`, background: chartColors.primary }}
          />
          <i
            style={{
              left: `${(principalShare ?? 0) * 100}%`,
              width: `${(interestShare ?? 0) * 100}%`,
              background: chartColors.warm,
            }}
          />
          <span aria-hidden="true">
            Principal: {share(principalShare)} | Interest: {share(interestShare)}
          </span>
        </div>
        <div className={d.payoffKey}>
          <span>
            <i style={{ background: chartColors.primary }} />
            Principal ({wholeDollars(loan)})
          </span>
          <span>
            <i style={{ background: chartColors.warm }} />
            Interest ({wholeDollars(totalInterest)})
          </span>
        </div>
      </section>
      <Chips
        size="sm"
        label="Payoff milestones"
        items={[
          ...(marks.quarter
            ? [{ icon: 'target' as const, text: `25% paid off by Y${marks.quarter}` }]
            : []),
          ...(marks.half
            ? [
                {
                  icon: 'target' as const,
                  tone: 'tealSoft' as const,
                  text: `50% paid off by Y${marks.half}`,
                },
              ]
            : []),
          ...(marks.threeQuarter
            ? [{ icon: 'target' as const, text: `75% paid off by Y${marks.threeQuarter}` }]
            : []),
          ...(marks.principalBeatsInterest
            ? [
                {
                  icon: 'zap' as const,
                  tone: 'amber' as const,
                  text: `Principal > Interest from Y${marks.principalBeatsInterest}`,
                },
              ]
            : []),
        ]}
      />
      <div className={d.tableBar}>
        <div className={d.toggle} role="group" aria-label="Schedule view">
          {(['summary', 'detailed'] as const).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>
              {m === 'summary' ? 'Summary' : 'Detailed'}
            </button>
          ))}
        </div>
        {detailed && (
          <div className={d.links}>
            <button type="button" onClick={() => setOpen(new Set(years.map((r) => r.year)))}>
              Expand All
            </button>
            <span aria-hidden="true">|</span>
            <button type="button" onClick={() => setOpen(new Set())}>
              Collapse All
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
              <th scope="col">Paid Off</th>
            </tr>
          </thead>
          <tbody>
            {years.map((r) => {
              const expanded = detailed && open.has(r.year);
              const milestone = r.year === marks.half || r.year === marks.principalBeatsInterest;
              const months = expanded
                ? result.amortizationSchedule.filter((m) => m.year === r.year)
                : [];
              return (
                <Fragment key={r.year}>
                  <tr
                    data-milestone={milestone || undefined}
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
                        <span className={d.badge} data-tone="amber">
                          P{'>'} I
                        </span>
                      )}
                    </th>
                    <td>{wholeDollars(r.beginning)}</td>
                    <td data-tone="teal">{wholeDollars(r.principal)}</td>
                    <td data-tone="amber">{wholeDollars(r.interest)}</td>
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
                      <td data-tone="teal">{wholeDollars(m.principal)}</td>
                      <td data-tone="amber">{wholeDollars(m.interest)}</td>
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
          icon="clock"
          tone="amber"
          label={`Interest (First ${period}y)`}
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
          <strong data-tone="amber">{wholeDollars(early)}</strong>
          <small>
            {share(totalInterest > 0 ? early / totalInterest : null)} of total interest
            {period > years.length && ` · the term is ${years.length} years`}
          </small>
        </InsightCard>
        <InsightCard
          icon="zap"
          tone="teal"
          label="Principal > Interest"
          about="From this year onward, more of each year's payments reduce the loan balance than go to interest."
        >
          {marks.principalBeatsInterest ? (
            <>
              <strong data-tone="teal">Y{marks.principalBeatsInterest}</strong>
              <small>
                {marks.principalBeatsInterest === 1
                  ? 'Principal exceeds interest from the start'
                  : 'More payment goes to principal from here'}
              </small>
            </>
          ) : (
            <>
              <strong data-tone="slate">Not within term</strong>
              <small>Interest exceeds principal in every year of the schedule</small>
            </>
          )}
        </InsightCard>
        <InsightCard
          icon="piggy"
          tone="slate"
          label={`Balance at Y${at}`}
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
                Interest saved:{' '}
                <b data-tone="teal">{wholeDollars(totalInterest - balanceAt.cumulativeInterest)}</b>
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
        <ChartCard
          title="Principal vs Interest Over Time"
          subtitle="There is no loan to repay, so there is no schedule to chart."
          basis={['All-cash purchase', 'USD']}
        >
          <p>
            All-cash purchase · debt service $0.00. Debt coverage is not applicable; no loan
            schedule is needed.
          </p>
        </ChartCard>
      </div>
    );
  return (
    <div className={chartStyles.stack}>
      <PrincipalVsInterest result={result} />
      <Schedule result={result}>
        <MoreDetail summary={`Exact annual payments, all ${rows.length} years`}>
          <ExactTable
            caption="Annual loan payments · USD · full loan term"
            headers={['Year', 'Payment', 'Principal', 'Interest', 'Ending balance']}
            rows={rows.map((r) => [
              r.year,
              ...[r.payment, r.principal, r.interest, r.balance].map(dollars),
            ])}
          />
        </MoreDetail>
        <MoreDetail summary="Exact monthly payments, by year">
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
