import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(path.resolve(import.meta.dirname, '../../src/styles/globals.css'), 'utf8');

/** Top-level rule bodies of a block like `@media (min-width: 1024px) { ... }`. */
function mediaBlocks(query: string): string[] {
  const out: string[] = [];
  let from = 0;
  for (;;) {
    const at = css.indexOf(`@media ${query}`, from);
    if (at < 0) return out;
    let depth = 0;
    let i = css.indexOf('{', at);
    const start = i + 1;
    for (; i < css.length; i++) {
      if (css[i] === '{') depth++;
      if (css[i] === '}' && --depth === 0) break;
    }
    out.push(css.slice(start, i));
    from = i;
  }
}

/** Declarations of the first rule whose selector list is exactly `selector`. */
function rule(source: string, selector: string): string {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/,\s*/g, ',\\s*');
  const m = new RegExp(`(?:^|[}\\s])${esc}\\s*\\{([^}]*)\\}`).exec(source);
  if (!m) throw new Error(`rule not found: ${selector}`);
  return m[1];
}

describe('responsive shell CSS (1024px breakpoint)', () => {
  const docked = mediaBlocks('(min-width: 1024px)').join('\n');

  it('hides the sidebar by default and only shows it as a drawer when open', () => {
    expect(rule(css, '.sidebar')).toMatch(/display:\s*none/);
    expect(rule(css, '.app.drawer-open .sidebar')).toMatch(/display:\s*flex/);
    expect(rule(css, '.app.drawer-open .sidebar')).toMatch(/position:\s*fixed/);
  });

  it('shows the hamburger below 1024px', () => {
    expect(rule(css, '.menu-btn')).toMatch(/display:\s*inline-grid/);
  });

  it('docks the sidebar and hides hamburger, close X and scrim at 1024px and up', () => {
    expect(docked).toMatch(/\.sidebar,\s*\.app\.drawer-open \.sidebar\s*\{[^}]*display:\s*flex/);
    expect(docked).toMatch(/position:\s*sticky/);
    expect(docked).toMatch(/grid-template-columns:\s*208px/);
    const hide = rule(
      docked,
      '.menu-btn,\n  .drawer-close,\n  .app.drawer-open .drawer-close,\n  .app.drawer-open .scrim',
    );
    expect(hide).toMatch(/display:\s*none/);
  });

  it('places the docked overrides after the drawer rules so they win', () => {
    const media = css.indexOf('@media (min-width: 1024px)');
    for (const sel of [
      '.menu-btn {',
      '.scrim {',
      '.app.drawer-open .sidebar {',
      '.app.drawer-open .scrim {',
    ]) {
      expect(css.indexOf(sel)).toBeGreaterThan(-1);
      expect(css.indexOf(sel)).toBeLessThan(media);
    }
  });

  it('keeps the scrim under the drawer and closed state hidden', () => {
    const z = (s: string) => Number(/z-index:\s*(\d+)/.exec(rule(css, s))![1]);
    expect(z('.app.drawer-open .sidebar')).toBeGreaterThan(z('.app.drawer-open .scrim'));
    expect(rule(css, '.scrim')).toMatch(/display:\s*none/);
    expect(rule(css, '.drawer-close')).toMatch(/display:\s*none/);
  });

  it('has balanced braces (no truncated rules)', () => {
    expect(css.split('{').length).toBe(css.split('}').length);
  });
});
