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

  it('treats manager-written descriptions as Other', () => {
    expect(parseDescription('Loose latch')).toEqual({
      category: 'Other',
      entry: null,
      text: 'Loose latch',
    });
    expect(parseDescription(null).text).toBe('');
  });

  it('derives a short title from the first sentence', () => {
    expect(titleFrom('Kitchen faucet leaks under the sink. Water pools.')).toBe(
      'Kitchen faucet leaks under the sink.',
    );
    expect(titleFrom('x'.repeat(200))).toHaveLength(78);
  });
});
