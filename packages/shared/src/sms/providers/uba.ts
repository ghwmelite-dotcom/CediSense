import { parseAmount } from '../parse-amount';
import type { SMSPatternDef } from '../types';

const PROVIDER = 'uba';

export const ubaPatterns: SMSPatternDef[] = [
  {
    provider: PROVIDER,
    name: 'uba_credit',
    regex: /UBA: Acct (\w+) credited GHS ([\d,]+\.\d{2})\. Ref: (\w+)\. Bal: GHS ([\d,]+\.\d{2})\. ([\d/]+)/i,
    type: 'credit',
    extract: (m) => ({
      amount_ghs: parseAmount(m[2]),
      fee_ghs: 0,
      counterparty: null,
      reference: m[3],
      balance_after_ghs: parseAmount(m[4]),
      date_str: m[5],
      description: `UBA credit GHS ${m[2]} to account ${m[1]}`,
    }),
  },
  {
    provider: PROVIDER,
    name: 'uba_debit',
    regex: /UBA: Acct (\w+) debited GHS ([\d,]+\.\d{2})\. Ref: (\w+)\. Bal: GHS ([\d,]+\.\d{2})\. ([\d/]+)/i,
    type: 'debit',
    extract: (m) => ({
      amount_ghs: parseAmount(m[2]),
      fee_ghs: 0,
      counterparty: null,
      reference: m[3],
      balance_after_ghs: parseAmount(m[4]),
      date_str: m[5],
      description: `UBA debit GHS ${m[2]} from account ${m[1]}`,
    }),
  },
];
