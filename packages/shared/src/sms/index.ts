import type { RawTransaction } from '../types';
import { toPesewas } from '../format';
import { parseGhanaDate } from './parse-date';
import { ALL_PATTERNS } from './registry';

export { parseGhanaDate } from './parse-date';
export { parseAmount } from './parse-amount';
export { ALL_PATTERNS } from './registry';

export function parseSMS(text: string): RawTransaction | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  for (const pattern of ALL_PATTERNS) {
    const match = trimmed.match(pattern.regex);
    if (!match) continue;

    const extracted = pattern.extract(match);
    return {
      amount_pesewas: toPesewas(extracted.amount_ghs),
      fee_pesewas: toPesewas(extracted.fee_ghs),
      type: pattern.type,
      counterparty: extracted.counterparty,
      reference: extracted.reference,
      balance_after_pesewas: extracted.balance_after_ghs != null
        ? toPesewas(extracted.balance_after_ghs)
        : null,
      transaction_date: extracted.date_str
        ? parseGhanaDate(extracted.date_str)
        : new Date().toISOString().slice(0, 10),
      description: extracted.description,
      raw_text: trimmed,
      source: 'sms_import',
      provider: pattern.provider,
    };
  }

  return null;
}
