export interface TransactionForDetection {
  counterparty: string | null;
  amount_pesewas: number;
  category_id: string | null;
  transaction_date: string;
}

export interface DetectedCandidate {
  counterparty: string;
  category_id: string | null;
  avg_amount_pesewas: number;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  occurrence_count: number;
  last_occurrence_date: string;
}

export function classifyFrequency(medianDays: number): 'weekly' | 'biweekly' | 'monthly' | null {
  if (medianDays >= 5 && medianDays <= 9) return 'weekly';
  if (medianDays >= 12 && medianDays <= 16) return 'biweekly';
  if (medianDays >= 25 && medianDays <= 35) return 'monthly';
  return null;
}

export function computeNextDueDate(lastDate: string, frequency: string): string {
  const d = new Date(lastDate + 'T00:00:00');
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00');
  do {
    switch (frequency) {
      case 'weekly': d.setDate(d.getDate() + 7); break;
      case 'biweekly': d.setDate(d.getDate() + 14); break;
      case 'monthly': d.setMonth(d.getMonth() + 1); break;
    }
  } while (d <= today);
  return d.toISOString().slice(0, 10);
}

export function detectRecurringPatterns(
  transactions: TransactionForDetection[],
  confirmedCounterparties: Set<string>,
  dismissedCounterparties: Set<string>,
): DetectedCandidate[] {
  // 1. Group by counterparty (case-insensitive, trimmed), skip nulls
  const groups = new Map<string, TransactionForDetection[]>();
  for (const txn of transactions) {
    if (!txn.counterparty) continue;
    const key = txn.counterparty.toLowerCase().trim();
    if (confirmedCounterparties.has(key) || dismissedCounterparties.has(key)) continue;
    const group = groups.get(key) ?? [];
    group.push(txn);
    groups.set(key, group);
  }

  const candidates: DetectedCandidate[] = [];

  for (const [, group] of groups) {
    if (group.length < 2) continue;

    // 2a. Filter by 20% amount tolerance using median as center (robust to outliers)
    let filtered = [...group];
    {
      const sorted = [...filtered].sort((a, b) => a.amount_pesewas - b.amount_pesewas);
      const m = Math.floor(sorted.length / 2);
      const medianAmount = sorted.length % 2 === 0
        ? (sorted[m - 1].amount_pesewas + sorted[m].amount_pesewas) / 2
        : sorted[m].amount_pesewas;
      filtered = filtered.filter(t => Math.abs(t.amount_pesewas - medianAmount) <= medianAmount * 0.2);
    }
    if (filtered.length < 2) continue;

    // 2b. Compute final average amount
    const avgAmount = Math.round(filtered.reduce((s, t) => s + t.amount_pesewas, 0) / filtered.length);

    // 2c. Sort by date
    filtered.sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));

    // 2d. Compute intervals
    const intervals: number[] = [];
    for (let i = 1; i < filtered.length; i++) {
      const prev = new Date(filtered[i - 1].transaction_date + 'T00:00:00');
      const curr = new Date(filtered[i].transaction_date + 'T00:00:00');
      intervals.push(Math.round((curr.getTime() - prev.getTime()) / 86400000));
    }
    if (intervals.length === 0) continue;

    // 2e. Median interval
    const sortedIntervals = [...intervals].sort((a, b) => a - b);
    const mid = Math.floor(sortedIntervals.length / 2);
    const median = sortedIntervals.length % 2 === 0
      ? (sortedIntervals[mid - 1] + sortedIntervals[mid]) / 2
      : sortedIntervals[mid];

    // 2f. Classify by median
    const frequency = classifyFrequency(median);
    if (!frequency) continue;

    // 2g. Verify all intervals are consistent with the classified frequency
    const allConsistent = intervals.every(interval => classifyFrequency(interval) === frequency);
    if (!allConsistent) continue;

    // 2h. Most common category_id
    const catCounts = new Map<string, number>();
    for (const t of filtered) {
      if (t.category_id) {
        catCounts.set(t.category_id, (catCounts.get(t.category_id) ?? 0) + 1);
      }
    }
    let topCategory: string | null = null;
    let topCount = 0;
    for (const [cat, count] of catCounts) {
      if (count > topCount) { topCategory = cat; topCount = count; }
    }

    candidates.push({
      counterparty: filtered[0].counterparty!, // use original casing from first occurrence
      category_id: topCategory,
      avg_amount_pesewas: avgAmount,
      frequency,
      occurrence_count: filtered.length,
      last_occurrence_date: filtered[filtered.length - 1].transaction_date,
    });
  }

  return candidates;
}
