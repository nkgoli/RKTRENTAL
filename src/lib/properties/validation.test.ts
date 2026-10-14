import { describe, expect, it } from 'vitest';
import {
  checkTypeChange,
  parsePropertyInput,
  parseUnitInput,
  resolveUnitStatus,
} from './validation';

const valid = {
  name: ' Oak Terrace ',
  type: 'MULTI_UNIT',
  street: '12 Oak St',
  city: 'Austin',
  state: 'tx',
  postalCode: '78704',
  yearBuilt: '1998',
  ownerId: '',
  unitCount: '3',
};
const now = new Date('2026-10-14T00:00:00Z');

describe('parsePropertyInput', () => {
  it('trims, normalizes state and parses numbers', () => {
    const r = parsePropertyInput(valid, { now });
    expect(r).toEqual({
      ok: true,
      data: {
        name: 'Oak Terrace',
        type: 'MULTI_UNIT',
        street: '12 Oak St',
        city: 'Austin',
        state: 'TX',
        postalCode: '78704',
        yearBuilt: 1998,
        ownerId: null,
        unitCount: 3,
      },
    });
  });

  it('reads FormData', () => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(valid)) fd.set(k, v);
    expect(parsePropertyInput(fd, { now }).ok).toBe(true);
  });

  it('reports every bad field', () => {
    const r = parsePropertyInput(
      {
        ...valid,
        name: '  ',
        type: 'HOUSE',
        state: 'Texas',
        postalCode: '7870',
        yearBuilt: '1700',
      },
      { now },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.errors).sort()).toEqual([
        'name',
        'postalCode',
        'state',
        'type',
        'yearBuilt',
      ]);
    }
  });

  it('accepts ZIP+4 and rejects a future year built', () => {
    expect(parsePropertyInput({ ...valid, postalCode: '78704-1234' }, { now }).ok).toBe(true);
    const r = parsePropertyInput({ ...valid, yearBuilt: '2040' }, { now });
    expect(r.ok).toBe(false);
  });

  it('ignores unit count for single-unit homes and bounds it for multi-unit', () => {
    const single = parsePropertyInput({ ...valid, type: 'SINGLE_UNIT', unitCount: '99' }, { now });
    expect(single.ok && single.data.unitCount).toBe(0);
    expect(parsePropertyInput({ ...valid, unitCount: '-1' }, { now }).ok).toBe(false);
    expect(parsePropertyInput({ ...valid, unitCount: '5000' }, { now }).ok).toBe(false);
  });
});

describe('parseUnitInput', () => {
  it('parses a full unit', () => {
    const r = parseUnitInput({
      number: ' 6A ',
      bedrooms: '2',
      bathrooms: '1.5',
      squareFeet: '950',
      listedRent: '$1,750.50',
      status: 'VACANT',
    });
    expect(r).toEqual({
      ok: true,
      data: {
        number: '6A',
        bedrooms: 2,
        bathrooms: 1.5,
        squareFeet: 950,
        listedRent: 1750.5,
        status: 'VACANT',
      },
    });
  });

  it('treats blanks as null and defaults to vacant', () => {
    const r = parseUnitInput({ number: '1' });
    expect(r).toMatchObject({
      ok: true,
      data: { bedrooms: null, listedRent: null, status: 'VACANT' },
    });
  });

  it('rejects bad values', () => {
    const r = parseUnitInput({
      number: '',
      bedrooms: '-1',
      bathrooms: '1.25',
      squareFeet: '0',
      listedRent: 'abc',
      status: 'GONE',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.errors).sort()).toEqual([
        'bathrooms',
        'bedrooms',
        'listedRent',
        'number',
        'squareFeet',
        'status',
      ]);
    }
  });

  it('uses the fixed number for an implicit unit', () => {
    const r = parseUnitInput({ number: 'ignored' }, { implicit: true });
    expect(r.ok && r.data.number).toBe('Whole property');
  });
});

describe('resolveUnitStatus', () => {
  it('forces OCCUPIED while a lease is active and blocks archiving', () => {
    expect(resolveUnitStatus('VACANT', true)).toEqual({ ok: true, data: 'OCCUPIED' });
    expect(resolveUnitStatus('ARCHIVED', true).ok).toBe(false);
  });
  it('rejects OCCUPIED without a lease', () => {
    expect(resolveUnitStatus('OCCUPIED', false).ok).toBe(false);
    expect(resolveUnitStatus('TURNOVER', false)).toEqual({ ok: true, data: 'TURNOVER' });
  });
});

describe('checkTypeChange', () => {
  it('blocks single-unit when several units exist', () => {
    expect(checkTypeChange('SINGLE_UNIT', 2)).not.toBeNull();
    expect(checkTypeChange('SINGLE_UNIT', 1)).toBeNull();
    expect(checkTypeChange('MULTI_UNIT', 12)).toBeNull();
  });
});
