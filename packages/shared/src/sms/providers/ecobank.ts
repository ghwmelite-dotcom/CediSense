import { parseAmount } from '../parse-amount';
import type { SMSPatternDef } from '../types';

const PROVIDER = 'ecobank';

export const ecobankPatterns: SMSPatternDef[] = [
  {
    provider: PROVIDER,
    name: 'ecobank_credit',
    regex: /Ecobank: Credit of GHS ([\d,]+\.\d{2}) to your account (\w+)\. Ref: (\w+)\. Bal: GHS ([\d,]+\.\d{2})\. (\d{2}-\w{3}-\d{4})/i,
    type: 'credit',
    extract: (m) => ({
      amount_ghs: parseAmount(m[1]),
      fee_ghs: 0,
      counterparty: null,
      reference: m[3],
      balance_after_ghs: parseAmount(m[4]),
      date_str: m[5],
      description: `Ecobank credit GHS ${m[1]} to account ${m[2]}`,
    }),
  },
  {
    provider: PROVIDER,
    name: 'ecobank_debit',
    regex: /Ecobank: Debit of GHS ([\d,]+\.\d{2}) from your account (\w+)\. Ref: (\w+)\. Bal: GHS ([\d,]+\.\d{2})\. (\d{2}-\w{3}-\d{4})/i,
    type: 'debit',
    extract: (m) => ({
      amount_ghs: parseAmount(m[1]),
      fee_ghs: 0,
      counterparty: null,
      reference: m[3],
      balance_after_ghs: parseAmount(m[4]),
      date_str: m[5],
      description: `Ecobank debit GHS ${m[1]} from account ${m[2]}`,
    }),
  },
];
