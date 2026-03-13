import type { TransactionType } from '../types';

export interface SMSPatternDef {
  provider: string;
  name: string;
  regex: RegExp;
  type: TransactionType;
  extract: (match: RegExpMatchArray) => {
    amount_ghs: number;
    fee_ghs: number;
    counterparty: string | null;
    reference: string | null;
    balance_after_ghs: number | null;
    date_str: string | null;
    description: string;
  };
}
