import type { RawTransaction, CategoryRule, Category, CategorizedBy } from '@cedisense/shared';

export interface CategorizedTransaction extends RawTransaction {
  category_id: string | null;
  categorized_by: CategorizedBy | null;
}

/**
 * Apply user-defined category rules to a list of raw transactions.
 *
 * Rules are sorted by priority DESC so higher-priority rules win.
 * Each rule is tested against the configured field (counterparty,
 * description, or provider) using the match_type strategy.
 */
export function applyRules(
  transactions: RawTransaction[],
  rules: CategoryRule[],
): CategorizedTransaction[] {
  // Sort rules by priority descending (highest priority wins)
  const sorted = [...rules].sort((a, b) => b.priority - a.priority);

  return transactions.map(txn => {
    for (const rule of sorted) {
      const fieldValue = getField(txn, rule.match_field);
      if (fieldValue === null) continue;

      if (matches(fieldValue, rule.match_type, rule.match_value)) {
        return {
          ...txn,
          category_id: rule.category_id,
          categorized_by: 'rule' as CategorizedBy,
        };
      }
    }

    return {
      ...txn,
      category_id: null,
      categorized_by: null,
    };
  });
}

function getField(txn: RawTransaction, field: CategoryRule['match_field']): string | null {
  switch (field) {
    case 'counterparty':
      return txn.counterparty;
    case 'description':
      return txn.description;
    case 'provider':
      return txn.provider ?? null;
    default:
      return null;
  }
}

function matches(value: string, matchType: CategoryRule['match_type'], pattern: string): boolean {
  switch (matchType) {
    case 'contains':
      return value.toLowerCase().includes(pattern.toLowerCase());
    case 'exact':
      return value.toLowerCase() === pattern.toLowerCase();
    case 'regex': {
      try {
        return new RegExp(pattern, 'i').test(value);
      } catch {
        return false;
      }
    }
    default:
      return false;
  }
}

// ── AI Categorization ─────────────────────────────────────────────────────────

const AI_BATCH_SIZE = 50;

interface AiCategorizeResponse {
  results?: Array<{ category: string }>;
}

/**
 * Use Workers AI (Granite Micro) to categorize transactions that have not yet
 * been matched by rules.  Non-blocking on failure — if AI returns an error or
 * an unrecognised category name the transaction stays uncategorized.
 *
 * @param transactions       - Transactions to categorize (may already have a category_id)
 * @param systemCategories   - Full list of Category objects to validate against
 * @param ai                 - Cloudflare `Ai` binding from the Worker environment
 */
export async function categorizeWithAI(
  transactions: CategorizedTransaction[],
  systemCategories: Category[],
  ai: Ai,
): Promise<CategorizedTransaction[]> {
  const uncategorized = transactions.filter(t => t.category_id === null);
  if (uncategorized.length === 0) return transactions;

  const categoryNames = systemCategories.map(c => c.name);
  const categoryNameSet = new Set(categoryNames.map(n => n.toLowerCase()));
  const categoryByName = new Map<string, Category>(
    systemCategories.map(c => [c.name.toLowerCase(), c]),
  );

  const results = new Map<number, string>();

  // Process in batches of AI_BATCH_SIZE
  for (let i = 0; i < uncategorized.length; i += AI_BATCH_SIZE) {
    const batch = uncategorized.slice(i, i + AI_BATCH_SIZE);

    const prompt = buildPrompt(batch, categoryNames);

    try {
      const response = (await ai.run('@cf/ibm/granite-3-8b-instruct', {
        prompt,
        max_tokens: 512,
      })) as AiCategorizeResponse | { response?: string } | string;

      const raw = typeof response === 'string'
        ? response
        : (response as { response?: string }).response ?? '';

      const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);

      lines.forEach((line, lineIdx) => {
        const txnIdx = i + lineIdx;
        if (txnIdx >= i + batch.length) return;
        const nameLower = line.toLowerCase();
        if (categoryNameSet.has(nameLower)) {
          results.set(txnIdx, categoryByName.get(nameLower)!.id);
        }
      });
    } catch {
      // Non-blocking: AI failure leaves transactions uncategorized
    }
  }

  // Merge results back
  const resultList = [...transactions];
  let uncategorizedIdx = 0;

  return resultList.map(txn => {
    if (txn.category_id !== null) return txn;

    const globalIdx = uncategorizedIdx++;
    const catId = results.get(globalIdx) ?? null;
    if (catId) {
      return { ...txn, category_id: catId, categorized_by: 'ai' as CategorizedBy };
    }
    return txn;
  });
}

function buildPrompt(transactions: CategorizedTransaction[], categories: string[]): string {
  const txnList = transactions
    .map((t, i) => `${i + 1}. ${t.description ?? t.counterparty ?? 'Unknown'} (${t.type}, GHS ${(t.amount_pesewas / 100).toFixed(2)})`)
    .join('\n');

  return [
    'You are a financial transaction categorizer for Ghana.',
    `Available categories: ${categories.join(', ')}`,
    '',
    'For each transaction below, reply with ONLY the category name on its own line',
    '(one line per transaction, same order). If uncertain, reply "Uncategorized".',
    '',
    txnList,
  ].join('\n');
}
