import { parseMoney } from '@/lib/leases/core';
import { toCents } from '@/lib/ledger/core';
import type { SetupFees } from '@/lib/ledger/lease-setup';
import type { WizardDraft } from './types';

const cents = (value: string): number => {
  const money = parseMoney(value);
  return money ? toCents(money) : 0;
};

/** The one-time money the wizard's Rent, deposit & fees step asks the ledger to create. */
export function feesFromDraft(draft: WizardDraft): SetupFees {
  return {
    monthlyRentCents: cents(draft.monthlyRent),
    depositCents: cents(draft.deposit),
    moveInFeeCents: draft.moveInFeeEnabled ? cents(draft.moveInFee) : 0,
    petDepositCents: draft.petDepositEnabled ? cents(draft.petDeposit) : 0,
    prorateFirstMonth: draft.prorateFirstMonth,
    rentDueDay: draft.rentDueDay,
  };
}
