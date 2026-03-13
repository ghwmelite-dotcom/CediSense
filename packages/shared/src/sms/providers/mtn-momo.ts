import { parseAmount } from '../parse-amount';
import type { SMSPatternDef } from '../types';

const PROVIDER = 'mtn_momo';

export const mtnMomoPatterns: SMSPatternDef[] = [
  {
    provider: PROVIDER,
    name: 'mtn_cash_out',
    regex: /You have cashed out GHS ([\d,]+\.\d{2}).*?Fee charged: GHS ([\d,]+\.\d{2}).*?Reference: (\w+).*?Balance: GHS ([\d,]+\.\d{2}).*?Date: ([\d/]+)/is,
    type: 'debit',
    extract: (m) => ({
      amount_ghs: parseAmount(m[1]),
      fee_ghs: parseAmount(m[2]),
      counterparty: null,
      reference: m[3],
      balance_after_ghs: parseAmount(m[4]),
      date_str: m[5],
      description: `MoMo cash-out GHS ${m[1]}`,
    }),
  },
  {
    provider: PROVIDER,
    name: 'mtn_transfer_sent',
    regex: /You have sent GHS ([\d,]+\.\d{2}) to ([A-Z ]+) \(([\d]+X*)\).*?Reference: (\w+).*?Fee: GHS ([\d,]+\.\d{2}).*?Balance: GHS ([\d,]+\.\d{2}).*?Date: ([\d/]+)/is,
    type: 'debit',
    extract: (m) => ({
      amount_ghs: parseAmount(m[1]),
      fee_ghs: parseAmount(m[5]),
      counterparty: m[2].trim(),
      reference: m[4],
      balance_after_ghs: parseAmount(m[6]),
      date_str: m[7],
      description: `MoMo transfer to ${m[2].trim()} GHS ${m[1]}`,
    }),
  },
  {
    provider: PROVIDER,
    name: 'mtn_transfer_received',
    regex: /You have received GHS ([\d,]+\.\d{2}) from ([A-Z ]+) \(([\d]+X*)\).*?Reference: (\w+).*?Balance: GHS ([\d,]+\.\d{2}).*?Date: ([\d/]+)/is,
    type: 'credit',
    extract: (m) => ({
      amount_ghs: parseAmount(m[1]),
      fee_ghs: 0,
      counterparty: m[2].trim(),
      reference: m[4],
      balance_after_ghs: parseAmount(m[5]),
      date_str: m[6],
      description: `MoMo received from ${m[2].trim()} GHS ${m[1]}`,
    }),
  },
  {
    provider: PROVIDER,
    name: 'mtn_merchant_payment',
    regex: /You have paid GHS ([\d,]+\.\d{2}) to ([A-Z ]+)\..*?Reference: (\w+).*?Fee: GHS ([\d,]+\.\d{2}).*?Balance: GHS ([\d,]+\.\d{2}).*?Date: ([\d/]+)/is,
    type: 'debit',
    extract: (m) => ({
      amount_ghs: parseAmount(m[1]),
      fee_ghs: parseAmount(m[4]),
      counterparty: m[2].trim(),
      reference: m[3],
      balance_after_ghs: parseAmount(m[5]),
      date_str: m[6],
      description: `MoMo payment to ${m[2].trim()} GHS ${m[1]}`,
    }),
  },
  {
    provider: PROVIDER,
    name: 'mtn_airtime',
    regex: /You have bought GHS ([\d,]+\.\d{2}) airtime.*?Reference: (\w+).*?Balance: GHS ([\d,]+\.\d{2}).*?Date: ([\d/]+)/is,
    type: 'debit',
    extract: (m) => ({
      amount_ghs: parseAmount(m[1]),
      fee_ghs: 0,
      counterparty: 'MTN Airtime',
      reference: m[2],
      balance_after_ghs: parseAmount(m[3]),
      date_str: m[4],
      description: `MoMo airtime purchase GHS ${m[1]}`,
    }),
  },
  {
    provider: PROVIDER,
    name: 'mtn_cash_in',
    regex: /You have received GHS ([\d,]+\.\d{2}) cash deposit.*?Reference: (\w+).*?Balance: GHS ([\d,]+\.\d{2}).*?Date: ([\d/]+)/is,
    type: 'credit',
    extract: (m) => ({
      amount_ghs: parseAmount(m[1]),
      fee_ghs: 0,
      counterparty: null,
      reference: m[2],
      balance_after_ghs: parseAmount(m[3]),
      date_str: m[4],
      description: `MoMo cash deposit GHS ${m[1]}`,
    }),
  },
];
