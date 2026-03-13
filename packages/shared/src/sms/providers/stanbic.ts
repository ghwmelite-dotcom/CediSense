import { parseAmount } from '../parse-amount';
import type { SMSPatternDef } from '../types';

const PROVIDER = 'stanbic';

export const stanbicPatterns: SMSPatternDef[] = [
  {
    provider: PROVIDER,
    name: 'stanbic_credit',
    regex: /Stanbic: Your account (\w+) credited GHS ([\d,]+\.\d{2})\. Reference: (\w+)\. Balance: GHS ([\d,]+\.\d{2})\. (\d{4}-\d{2}-\d{2})/i,
    type: 'credit',
    extract: (m) => ({
      amount_ghs: parseAmount(m[2]),
      fee_ghs: 0,
      counterparty: null,
      reference: m[3],
      balance_after_ghs: parseAmount(m[4]),
      date_str: m[5],
      description: `Stanbic credit GHS ${m[2]} to account ${m[1]}`,
    }),
  },
  {
    provider: PROVIDER,
    name: 'stanbic_debit',
    regex: /Stanbic: Your account (\w+) debited GHS ([\d,]+\.\d{2})\. Reference: (\w+)\. Balance: GHS ([\d,]+\.\d{2})\. (\d{4}-\d{2}-\d{2})/i,
    type: 'debit',
    extract: (m) => ({
      amount_ghs: parseAmount(m[2]),
      fee_ghs: 0,
      counterparty: null,
      reference: m[3],
      balance_after_ghs: parseAmount(m[4]),
      date_str: m[5],
      description: `Stanbic debit GHS ${m[2]} from account ${m[1]}`,
    }),
  },
];
