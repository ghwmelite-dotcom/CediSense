import { parseAmount } from '../parse-amount';
import type { SMSPatternDef } from '../types';

const PROVIDER = 'absa';

export const absaPatterns: SMSPatternDef[] = [
  {
    provider: PROVIDER,
    name: 'absa_credit',
    regex: /Absa: GHS ([\d,]+\.\d{2}) credited to (\w+)\. Ref: (\w+)\. Balance: GHS ([\d,]+\.\d{2})\. ([\d/]+)/i,
    type: 'credit',
    extract: (m) => ({
      amount_ghs: parseAmount(m[1]),
      fee_ghs: 0,
      counterparty: null,
      reference: m[3],
      balance_after_ghs: parseAmount(m[4]),
      date_str: m[5],
      description: `Absa credit GHS ${m[1]} to account ${m[2]}`,
    }),
  },
  {
    provider: PROVIDER,
    name: 'absa_debit',
    regex: /Absa: GHS ([\d,]+\.\d{2}) debited from (\w+)\. Ref: (\w+)\. Balance: GHS ([\d,]+\.\d{2})\. ([\d/]+)/i,
    type: 'debit',
    extract: (m) => ({
      amount_ghs: parseAmount(m[1]),
      fee_ghs: 0,
      counterparty: null,
      reference: m[3],
      balance_after_ghs: parseAmount(m[4]),
      date_str: m[5],
      description: `Absa debit GHS ${m[1]} from account ${m[2]}`,
    }),
  },
];
