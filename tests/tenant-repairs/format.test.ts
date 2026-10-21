import { describe, expect, it } from 'vitest';
import {
  composeDescription,
  parseDescription,
  titleFrom,
} from '../../src/app/(tenant)/repairs/format';

describe('tenant repair description', () => {
  it('round-trips category, entry permission and text', () => {
    const description = composeDescription('Plumbing', 'home', 'Faucet leaks.\nStarted Monday.');
    expect(parseDescription(description)).toEqual({
      category: 'Plumbing',
      entry: 'I need to be home — call first',
      text: 'Faucet leaks.\nStarted Monday.',
    });
  });

  it('uses General for manager-written descriptions without recorded category', () => {
    expect(parseDescription('Loose latch')).toEqual({
      category: 'General',
      entry: null,
      text: 'Loose latch',
    });
    expect(parseDescription(null).text).toBe('');
    expect(parseDescription('Category: \n\nLoose latch')).toEqual({
      category: 'General',
      entry: null,
      text: 'Loose latch',
    });
  });

  it('preserves an explicit category without an entry header and accepts Windows line endings', () => {
    expect(parseDescription('Category: Plumbing\r\n\r\nLeaking tap')).toEqual({
      category: 'Plumbing',
      entry: null,
      text: 'Leaking tap',
    });
    expect(
      parseDescription(
        composeDescription('Electrical', 'key', 'Light flickers').replaceAll('\n', '\r\n'),
      ).category,
    ).toBe('Electrical');
  });

  it('derives a short title from the first sentence', () => {
    expect(titleFrom('Kitchen faucet leaks under the sink. Water pools.')).toBe(
      'Kitchen faucet leaks under the sink.',
    );
    expect(titleFrom('x'.repeat(200))).toHaveLength(78);
  });
});
