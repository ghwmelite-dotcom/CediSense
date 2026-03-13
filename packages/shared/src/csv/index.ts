import type { RawTransaction, CSVFormat } from '../types.js';
import { toPesewas } from '../format.js';
import { parseGhanaDate } from '../sms/parse-date.js';
import { CSV_FORMATS } from './formats.js';

export { CSV_FORMATS };

/**
 * Returns all available CSV format definitions.
 */
export function getCSVFormats(): CSVFormat[] {
  return CSV_FORMATS;
}

/**
 * Parse a single CSV line respecting quoted fields.
 * Handles fields like: `"Smith, John"` correctly.
 */
function parseCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote inside quoted field
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Parse a CSV text string using the named format provider.
 *
 * @param csvText  - Raw CSV string (may be empty)
 * @param formatId - Provider id from CSV_FORMATS (e.g. 'gcb_bank')
 * @returns Array of RawTransaction objects
 * @throws Error if formatId is not recognised
 */
export function parseCSV(csvText: string, formatId: string): RawTransaction[] {
  const format = CSV_FORMATS.find(f => f.provider === formatId);
  if (!format) {
    throw new Error(`Unknown CSV format: ${formatId}`);
  }

  const lines = csvText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length === 0) return [];

  // Parse header row to get column index mapping
  const headerLine = format.hasHeader ? lines[0] : null;
  const dataLines = format.hasHeader ? lines.slice(1) : lines;

  if (dataLines.length === 0) return [];

  let headerIndex: Record<string, number> = {};
  if (headerLine) {
    const headers = parseCsvLine(headerLine, format.delimiter);
    headers.forEach((h, i) => {
      headerIndex[h.trim()] = i;
    });
  }

  const { columnMap } = format;

  function getField(fields: string[], colName: string | undefined): string {
    if (!colName) return '';
    const idx = headerIndex[colName];
    if (idx === undefined || idx < 0) return '';
    return (fields[idx] ?? '').trim();
  }

  const transactions: RawTransaction[] = [];

  for (const line of dataLines) {
    if (!line) continue;
    const fields = parseCsvLine(line, format.delimiter);

    const dateRaw = getField(fields, columnMap.date);
    const description = getField(fields, columnMap.description) || null;
    const referenceRaw = getField(fields, columnMap.reference);
    const reference = referenceRaw || null;
    const balanceRaw = getField(fields, columnMap.balance);

    let amountGhs = 0;
    let type: RawTransaction['type'] = 'debit';

    if (columnMap.debit !== undefined && columnMap.credit !== undefined) {
      // Separate debit / credit columns
      const debitRaw = getField(fields, columnMap.debit);
      const creditRaw = getField(fields, columnMap.credit);

      const debitVal = parseFloat(debitRaw.replace(/,/g, '')) || 0;
      const creditVal = parseFloat(creditRaw.replace(/,/g, '')) || 0;

      if (creditVal > 0) {
        amountGhs = creditVal;
        type = 'credit';
      } else {
        amountGhs = debitVal;
        type = 'debit';
      }
    } else if (columnMap.amount !== undefined) {
      // Single signed amount column: negative = debit, positive = credit
      const amountRaw = getField(fields, columnMap.amount);
      const parsed = parseFloat(amountRaw.replace(/,/g, '')) || 0;
      if (parsed < 0) {
        amountGhs = Math.abs(parsed);
        type = 'debit';
      } else {
        amountGhs = parsed;
        type = 'credit';
      }
    }

    const amount_pesewas = toPesewas(amountGhs);
    const transaction_date = parseGhanaDate(dateRaw);
    const balance_after_pesewas = balanceRaw
      ? toPesewas(parseFloat(balanceRaw.replace(/,/g, '')) || 0)
      : null;

    const raw: RawTransaction = {
      type,
      amount_pesewas,
      fee_pesewas: 0,
      description,
      raw_text: line,
      counterparty: null,
      reference,
      balance_after_pesewas,
      source: 'csv_import',
      transaction_date,
      provider: formatId,
    };

    transactions.push(raw);
  }

  return transactions;
}
