import { parseAmount } from '../parse-amount';
import type { SMSPatternDef } from '../types';

const PROVIDER = 'airteltigo';

export const airteltigoPatterns: SMSPatternDef[] = [
  {
    provider: PROVIDER,
    name: 'at_transfer_sent',
    regex: /AirtelTigo Money: You sent GHS ([\d,]+\.\d{2}) to ([A-Z ]+) \(([\dX]+)\)\. Fee: GHS ([\d,]+\.\d{2})\. TxnID: (\w+)\. Bal: GHS ([\d,]+\.\d{2})\. ([\d/]+)/i,
    type: 'debit',
    extract: (m) => ({
      amount_ghs: parseAmount(m[1]),
      fee_ghs: parseAmount(m[4]),
      counterparty: m[2].trim(),
      reference: m[5],
      balance_after_ghs: parseAmount(m[6]),
      date_str: m[7],
      description: `AirtelTigo Money sent to ${m[2].trim()} GHS ${m[1]}`,
    }),
  },
  {
    provider: PROVIDER,
    name: 'at_transfer_received',
    regex: /AirtelTigo Money: You received GHS ([\d,]+\.\d{2}) from ([A-Z ]+) \(([\dX]+)\)\. TxnID: (\w+)\. Bal: GHS ([\d,]+\.\d{2})\. ([\d/]+)/i,
    type: 'credit',
    extract: (m) => ({
      amount_ghs: parseAmount(m[1]),
      fee_ghs: 0,
      counterparty: m[2].trim(),
      reference: m[4],
      balance_after_ghs: parseAmount(m[5]),
      date_str: m[6],
      description: `AirtelTigo Money received from ${m[2].trim()} GHS ${m[1]}`,
    }),
  },
  {
    provider: PROVIDER,
    name: 'at_withdrawal',
    regex: /AirtelTigo Money: Cash out GHS ([\d,]+\.\d{2})\. Fee: GHS ([\d,]+\.\d{2})\. TxnID: (\w+)\. Bal: GHS ([\d,]+\.\d{2})\. ([\d/]+)/i,
    type: 'debit',
    extract: (m) => ({
      amount_ghs: parseAmount(m[1]),
      fee_ghs: parseAmount(m[2]),
      counterparty: null,
      reference: m[3],
      balance_after_ghs: parseAmount(m[4]),
      date_str: m[5],
      description: `AirtelTigo Money cash out GHS ${m[1]}`,
    }),
  },
  {
    provider: PROVIDER,
    name: 'at_payment',
    regex: /AirtelTigo Money: Payment GHS ([\d,]+\.\d{2}) to ([A-Z ]+)\. TxnID: (\w+)\. Fee: GHS ([\d,]+\.\d{2})\. Bal: GHS ([\d,]+\.\d{2})\. ([\d/]+)/i,
    type: 'debit',
    extract: (m) => ({
      amount_ghs: parseAmount(m[1]),
      fee_ghs: parseAmount(m[4]),
      counterparty: m[2].trim(),
      reference: m[3],
      balance_after_ghs: parseAmount(m[5]),
      date_str: m[6],
      description: `AirtelTigo Money payment to ${m[2].trim()} GHS ${m[1]}`,
    }),
  },
];
