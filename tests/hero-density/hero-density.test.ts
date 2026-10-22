import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');
const css = read('src/styles/hero-density.css');

describe('hero density', () => {
  it('loads after the Redisgn stylesheet so its compact sizes win', () => {
    const layout = read('src/app/layout.tsx');
    const redisgn = layout.indexOf("'@/styles/redisgn.css'");
    const hero = layout.indexOf("'@/styles/hero-density.css'");
    expect(redisgn).toBeGreaterThan(-1);
    expect(hero).toBeGreaterThan(redisgn);
  });

  it('keeps summary stats on screen instead of in a side-scrolling strip', () => {
    expect(css).toMatch(/\.summary-band-stats \{[^}]*overflow-x: visible/);
    expect(css).toMatch(/\.summary-band-stats \{[^}]*grid-auto-flow: row/);
  });

  it('separates every band from the content after it with one shared gap', () => {
    expect(css).toMatch(/--hero-gap: 24px/);
    expect(css).toMatch(/main :has\(> \.summary-band\)[^{]*\{\s*row-gap: var\(--hero-gap\)/);
    expect(css).toMatch(/\.hero-flow \{[^}]*gap: var\(--hero-gap\)/);
  });

  it('gives the Leases summary and Lease portfolio the hero gap', () => {
    expect(read('src/app/(manager)/leases/page.tsx')).toContain(
      'className={`hero-flow ${styles.page}`}',
    );
  });
});
