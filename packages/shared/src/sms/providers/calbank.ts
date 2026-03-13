import { parseAmount } from '../parse-amount';
import type { SMSPatternDef } from '../types';

const PROVIDER = 'calbank';

export const calbankPatterns: SMSPatternDef[] = [
  {
    provider: PROVIDER,
    name: 'calbank_credit',
    regex: /CalBank Alert: Credit GHS ([\d,]+\.\d{2})\. Account: (\w+)\. Ref: (\w+)\. Bal: GHS ([\d,]+\.\d{2})\. ([\d/]+)/i,
    type: 'credit',
    extract: (m) => ({
      amount_ghs: parseAmount(m[1]),
      fee_ghs: 0,
      counterparty: null,
      reference: m[3],
      balance_after_ghs: parseAmount(m[4]),
      date_str: m[5],
      description: `CalBank credit GHS ${m[1]} to account ${m[2]}`,
    }),
  },
  {
    provider: PROVIDER,
    name: 'calbank_debit',
    regex: /CalBank Alert: Debit GHS ([\d,]+\.\d{2})\. Account: (\w+)\. Ref: (\w+)\. Bal: GHS ([\d,]+\.\d{2})\. ([\d/]+)/i,
    type: 'debit',
    extract: (m) => ({
      amount_ghs: parseAmount(m[1]),
      fee_ghs: 0,
      counterparty: null,
      reference: m[3],
      balance_after_ghs: parseAmount(m[4]),
      date_str: m[5],
      description: `CalBank debit GHS ${m[1]} from account ${m[2]}`,
    }),
  },
];
