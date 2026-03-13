import { parseAmount } from '../parse-amount';
import type { SMSPatternDef } from '../types';

const PROVIDER = 'gcb';

export const gcbPatterns: SMSPatternDef[] = [
  {
    provider: PROVIDER,
    name: 'gcb_credit',
    regex: /GCB Bank: Your account (\w+) has been credited with GHS ([\d,]+\.\d{2})\. Ref: (\w+)\. Balance: GHS ([\d,]+\.\d{2})\. ([\d/]+)/i,
    type: 'credit',
    extract: (m) => ({
      amount_ghs: parseAmount(m[2]),
      fee_ghs: 0,
      counterparty: null,
      reference: m[3],
      balance_after_ghs: parseAmount(m[4]),
      date_str: m[5],
      description: `GCB Bank credit GHS ${m[2]} to account ${m[1]}`,
    }),
  },
  {
    provider: PROVIDER,
    name: 'gcb_debit',
    regex: /GCB Bank: Your account (\w+) has been debited with GHS ([\d,]+\.\d{2})\. Ref: (\w+)\. Balance: GHS ([\d,]+\.\d{2})\. ([\d/]+)/i,
    type: 'debit',
    extract: (m) => ({
      amount_ghs: parseAmount(m[2]),
      fee_ghs: 0,
      counterparty: null,
      reference: m[3],
      balance_after_ghs: parseAmount(m[4]),
      date_str: m[5],
      description: `GCB Bank debit GHS ${m[2]} from account ${m[1]}`,
    }),
  },
];
