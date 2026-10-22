// Layout itself is checked in a real browser by measure.mjs --check (heights, following-panel
// position, gaps, clipping, text and target sizes, Screening report) and focus-check.mjs. These
// unit tests guard the wiring those checks depend on.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SummaryBand } from '@/components/ui/SummaryBand';

const root = path.resolve(import.meta.dirname, '../..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');
const css = read('src/styles/hero-density.css');
const budgets = JSON.parse(read('tests/hero-density/budgets.json'));

/** Every selector in a stylesheet, with comments and at-rule preludes removed. */
const selectors = (source: string) =>
  [...source.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}@;]+)\{/g)]
    .flatMap((m) => m[1].split(','))
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('(') && !/^(from|to|\d)/.test(s));

describe('hero density', () => {
  it('loads after the Redisgn stylesheet so its compact sizes win', () => {
    const layout = read('src/app/layout.tsx');
    const redisgn = layout.indexOf("'@/styles/redisgn.css'");
    const hero = layout.indexOf("'@/styles/hero-density.css'");
    expect(redisgn).toBeGreaterThan(-1);
    expect(hero).toBeGreaterThan(redisgn);
  });

  it('scopes stat density rules to hero stat lists, never to every .summary-stat', () => {
    const statRules = selectors(css).filter((s) => s.includes('summary-stat'));
    expect(statRules.length).toBeGreaterThan(0);
    for (const selector of statRules) expect(selector).toMatch(/\.summary-band-stats\b/);
  });

  it('renders stats inside the hero list, with stacked details only when asked', () => {
    const stats = [{ label: 'Active leases', value: '41', detail: 'Current leases' }];
    const plain = renderToStaticMarkup(
      createElement(SummaryBand, { eyebrow: 'Lease portfolio', value: '41 active', stats }),
    );
    const stacked = renderToStaticMarkup(
      createElement(SummaryBand, {
        eyebrow: 'Suggested rent',
        value: '$1,840',
        stats,
        stackDetails: true,
      }),
    );
    expect(plain).toContain('class="summary-band-stats"><div class="summary-stat">');
    expect(stacked).toContain('class="summary-band-stats stack-details"');
    expect(stacked).toContain('Current leases');
  });

  it('gives the Leases summary and Lease portfolio the hero gap', () => {
    expect(read('src/app/(manager)/leases/page.tsx')).toContain(
      'className={`hero-flow ${styles.page}`}',
    );
  });

  it('budgets every requested hero below its original height at all three widths', () => {
    const required = [
      '/dashboard',
      '/leases',
      '/tenants',
      '/roi-analysis',
      '/rent-analysis',
      '/home',
      '/pay',
    ];
    for (const route of required)
      for (const vp of ['desktop', 'tablet', 'mobile']) {
        const budget = budgets.heroes[`${route} @${vp}`];
        expect(budget, `${route} @${vp}`).toBeDefined();
        expect(budget.height).toBeLessThanOrEqual(budgets.original[`${route} @${vp}`]);
      }
    for (const vp of ['desktop', 'tablet', 'mobile'])
      expect(budgets.report[`screening report @${vp}`]).toHaveLength(3);
  });
});
