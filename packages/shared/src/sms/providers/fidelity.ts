import { parseAmount } from '../parse-amount';
import type { SMSPatternDef } from '../types';

const PROVIDER = 'fidelity';

export const fidelityPatterns: SMSPatternDef[] = [
  {
    provider: PROVIDER,
    name: 'fidelity_credit',
    regex: /Fidelity Bank: GHS ([\d,]+\.\d{2}) credited to account (\w+)\. Ref: (\w+)\. Balance: GHS ([\d,]+\.\d{2})\. ([\d/]+)/i,
    type: 'credit',
    extract: (m) => ({
      amount_ghs: parseAmount(m[1]),
      fee_ghs: 0,
      counterparty: null,
      reference: m[3],
      balance_after_ghs: parseAmount(m[4]),
      date_str: m[5],
      description: `Fidelity Bank credit GHS ${m[1]} to account ${m[2]}`,
    }),
  },
  {
    provider: PROVIDER,
    name: 'fidelity_debit',
    regex: /Fidelity Bank: GHS ([\d,]+\.\d{2}) debited from account (\w+)\. Ref: (\w+)\. Balance: GHS ([\d,]+\.\d{2})\. ([\d/]+)/i,
    type: 'debit',
    extract: (m) => ({
      amount_ghs: parseAmount(m[1]),
      fee_ghs: 0,
      counterparty: null,
      reference: m[3],
      balance_after_ghs: parseAmount(m[4]),
      date_str: m[5],
      description: `Fidelity Bank debit GHS ${m[1]} from account ${m[2]}`,
    }),
  },
];
