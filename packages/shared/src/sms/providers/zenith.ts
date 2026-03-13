import { parseAmount } from '../parse-amount';
import type { SMSPatternDef } from '../types';

const PROVIDER = 'zenith';

export const zenithPatterns: SMSPatternDef[] = [
  {
    provider: PROVIDER,
    name: 'zenith_credit',
    regex: /Zenith Bank: GHS ([\d,]+\.\d{2}) has been credited to your account (\w+)\. Ref: (\w+)\. Balance: GHS ([\d,]+\.\d{2})\. ([\d/]+)/i,
    type: 'credit',
    extract: (m) => ({
      amount_ghs: parseAmount(m[1]),
      fee_ghs: 0,
      counterparty: null,
      reference: m[3],
      balance_after_ghs: parseAmount(m[4]),
      date_str: m[5],
      description: `Zenith Bank credit GHS ${m[1]} to account ${m[2]}`,
    }),
  },
  {
    provider: PROVIDER,
    name: 'zenith_debit',
    regex: /Zenith Bank: GHS ([\d,]+\.\d{2}) has been debited from your account (\w+)\. Ref: (\w+)\. Balance: GHS ([\d,]+\.\d{2})\. ([\d/]+)/i,
    type: 'debit',
    extract: (m) => ({
      amount_ghs: parseAmount(m[1]),
      fee_ghs: 0,
      counterparty: null,
      reference: m[3],
      balance_after_ghs: parseAmount(m[4]),
      date_str: m[5],
      description: `Zenith Bank debit GHS ${m[1]} from account ${m[2]}`,
    }),
  },
];
