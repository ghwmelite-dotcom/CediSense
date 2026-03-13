import { parseAmount } from '../parse-amount';
import type { SMSPatternDef } from '../types';

const PROVIDER = 'vodafone_cash';

export const vodafoneCashPatterns: SMSPatternDef[] = [
  {
    provider: PROVIDER,
    name: 'vf_send_money',
    regex: /You have sent GHS ([\d,]+\.\d{2}) to ([A-Z ]+) \(([\dX]+)\)\. Fee: GHS ([\d,]+\.\d{2})\. Ref: (\w+)\. Balance: GHS ([\d,]+\.\d{2})\. ([\d/]+)/i,
    type: 'debit',
    extract: (m) => ({
      amount_ghs: parseAmount(m[1]),
      fee_ghs: parseAmount(m[4]),
      counterparty: m[2].trim(),
      reference: m[5],
      balance_after_ghs: parseAmount(m[6]),
      date_str: m[7],
      description: `Vodafone Cash sent to ${m[2].trim()} GHS ${m[1]}`,
    }),
  },
  {
    provider: PROVIDER,
    name: 'vf_receive_money',
    regex: /You have received GHS ([\d,]+\.\d{2}) from ([A-Z ]+) \(([\dX]+)\)\. Ref: (\w+)\. Balance: GHS ([\d,]+\.\d{2})\. ([\d/]+)/i,
    type: 'credit',
    extract: (m) => ({
      amount_ghs: parseAmount(m[1]),
      fee_ghs: 0,
      counterparty: m[2].trim(),
      reference: m[4],
      balance_after_ghs: parseAmount(m[5]),
      date_str: m[6],
      description: `Vodafone Cash received from ${m[2].trim()} GHS ${m[1]}`,
    }),
  },
  {
    provider: PROVIDER,
    name: 'vf_payment',
    regex: /Payment of GHS ([\d,]+\.\d{2}) to ([A-Z ]+)\. Ref: (\w+)\. Fee: GHS ([\d,]+\.\d{2})\. Balance: GHS ([\d,]+\.\d{2})\. ([\d/]+)/i,
    type: 'debit',
    extract: (m) => ({
      amount_ghs: parseAmount(m[1]),
      fee_ghs: parseAmount(m[4]),
      counterparty: m[2].trim(),
      reference: m[3],
      balance_after_ghs: parseAmount(m[5]),
      date_str: m[6],
      description: `Vodafone Cash payment to ${m[2].trim()} GHS ${m[1]}`,
    }),
  },
  {
    provider: PROVIDER,
    name: 'vf_withdrawal',
    regex: /Cash withdrawal of GHS ([\d,]+\.\d{2})\. Fee: GHS ([\d,]+\.\d{2})\. Ref: (\w+)\. Balance: GHS ([\d,]+\.\d{2})\. ([\d/]+)/i,
    type: 'debit',
    extract: (m) => ({
      amount_ghs: parseAmount(m[1]),
      fee_ghs: parseAmount(m[2]),
      counterparty: null,
      reference: m[3],
      balance_after_ghs: parseAmount(m[4]),
      date_str: m[5],
      description: `Vodafone Cash withdrawal GHS ${m[1]}`,
    }),
  },
  {
    provider: PROVIDER,
    name: 'vf_deposit',
    regex: /Cash deposit of GHS ([\d,]+\.\d{2}) received\. Ref: (\w+)\. Balance: GHS ([\d,]+\.\d{2})\. ([\d/]+)/i,
    type: 'credit',
    extract: (m) => ({
      amount_ghs: parseAmount(m[1]),
      fee_ghs: 0,
      counterparty: null,
      reference: m[2],
      balance_after_ghs: parseAmount(m[3]),
      date_str: m[4],
      description: `Vodafone Cash deposit GHS ${m[1]}`,
    }),
  },
];
