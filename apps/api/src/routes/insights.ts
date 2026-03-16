import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { insightsQuerySchema } from '@cedisense/shared';
import {
  fetchSummary,
  fetchCategoryBreakdown,
  assembleSummary,
  currentMonth,
  lastDayOfMonth,
  previousMonth,
  type CategoryRow,
} from '../lib/dashboard-queries.js';

const insights = new Hono<{ Bindings: Env; Variables: Variables }>();

const AI_MODEL = '@cf/qwen/qwen3-30b-a3b-fp8';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatGHS(pesewas: number): string {
  const ghs = pesewas / 100;
  return `₵${ghs.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function monthName(month: string): string {
  const [year, mon] = month.split('-').map(Number);
  const date = new Date(year, mon - 1, 1);
  return date.toLocaleString('en-GH', { month: 'long', year: 'numeric' });
}

interface CategoryTrend {
  category_id: string;
  name: string;
  icon: string;
  color: string;
  current_pesewas: number;
  previous_pesewas: number;
  change_pesewas: number;
  change_percentage: number;
}

interface TopChange {
  category_id: string;
  name: string;
  icon: string;
  color: string;
  current_pesewas: number;
  previous_pesewas: number;
  change_pesewas: number;
  change_percentage: number;
  direction: 'up' | 'down' | 'new';
}

function buildCategoryTrends(
  currentRows: CategoryRow[],
  previousRows: CategoryRow[]
): CategoryTrend[] {
  const currentMap = new Map<string, CategoryRow>();
  const previousMap = new Map<string, CategoryRow>();

  for (const row of currentRows) currentMap.set(row.id, row);
  for (const row of previousRows) previousMap.set(row.id, row);

  // Union all category IDs from both months
  const allIds = new Set([...currentMap.keys(), ...previousMap.keys()]);

  const trends: CategoryTrend[] = [];

  for (const id of allIds) {
    const cur = currentMap.get(id);
    const prev = previousMap.get(id);

    // Use whichever row exists to get category metadata
    const meta = cur ?? prev!;

    const current_pesewas = cur?.total_pesewas ?? 0;
    const previous_pesewas = prev?.total_pesewas ?? 0;
    const change_pesewas = current_pesewas - previous_pesewas;

    let change_percentage: number;
    if (previous_pesewas > 0) {
      change_percentage =
        Math.round(((current_pesewas - previous_pesewas) / previous_pesewas) * 1000) / 10;
    } else if (current_pesewas > 0) {
      change_percentage = 100;
    } else {
      change_percentage = 0;
    }

    trends.push({
      category_id: id,
      name: meta.name,
      icon: meta.icon,
      color: meta.color,
      current_pesewas,
      previous_pesewas,
      change_pesewas,
      change_percentage,
    });
  }

  // Sort by (current + previous) DESC, cap at top 15
  trends.sort((a, b) => b.current_pesewas + b.previous_pesewas - (a.current_pesewas + a.previous_pesewas));
  return trends.slice(0, 15);
}

function buildTopChanges(trends: CategoryTrend[]): TopChange[] {
  return [...trends]
    .sort((a, b) => Math.abs(b.change_percentage) - Math.abs(a.change_percentage))
    .slice(0, 5)
    .map((t) => {
      let direction: 'up' | 'down' | 'new';
      if (t.current_pesewas > t.previous_pesewas) {
        direction = 'up';
      } else if (t.previous_pesewas > 0 && t.current_pesewas === 0) {
        direction = 'down';
      } else if (t.current_pesewas > 0 && t.previous_pesewas === 0) {
        direction = 'new';
      } else {
        direction = 'down';
      }
      return { ...t, direction };
    });
}

// ---------------------------------------------------------------------------
// GET / — comparison data
// ---------------------------------------------------------------------------

insights.get('/', async (c) => {
  const userId = c.get('userId');

  const parsed = insightsQuerySchema.safeParse({ month: c.req.query('month') });
  if (!parsed.success) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid month format. Use YYYY-MM.' } },
      400
    );
  }

  const now = currentMonth();
  const month = parsed.data.month ?? now;

  if (month > now) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Cannot view future months.' } },
      400
    );
  }

  const prevMonth = previousMonth(month);

  const curStart = `${month}-01`;
  const curEnd = lastDayOfMonth(month);
  const prevStart = `${prevMonth}-01`;
  const prevEnd = lastDayOfMonth(prevMonth);

  // Parallel fetch: 4 queries
  const [curSummaryRows, curCategoryRows, prevSummaryRows, prevCategoryRows] = await Promise.all([
    fetchSummary(c.env.DB, userId, curStart, curEnd),
    fetchCategoryBreakdown(c.env.DB, userId, curStart, curEnd),
    fetchSummary(c.env.DB, userId, prevStart, prevEnd),
    fetchCategoryBreakdown(c.env.DB, userId, prevStart, prevEnd),
  ]);

  const curSummary = assembleSummary(curSummaryRows);
  const prevSummary = assembleSummary(prevSummaryRows);

  const categoryTrends = buildCategoryTrends(curCategoryRows, prevCategoryRows);
  const topChanges = buildTopChanges(categoryTrends);

  return c.json({
    data: {
      month,
      previous_month: prevMonth,
      current: {
        total_income_pesewas: curSummary.totalIncome,
        total_expenses_pesewas: curSummary.totalExpenses,
        net_pesewas: curSummary.totalIncome - curSummary.totalExpenses,
        total_fees_pesewas: curSummary.totalFees,
        transaction_count: curSummary.transactionCount,
      },
      previous: {
        total_income_pesewas: prevSummary.totalIncome,
        total_expenses_pesewas: prevSummary.totalExpenses,
        net_pesewas: prevSummary.totalIncome - prevSummary.totalExpenses,
        total_fees_pesewas: prevSummary.totalFees,
        transaction_count: prevSummary.transactionCount,
      },
      category_trends: categoryTrends,
      top_changes: topChanges,
    },
  });
});

// ---------------------------------------------------------------------------
// POST /report — AI monthly report
// ---------------------------------------------------------------------------

insights.post('/report', async (c) => {
  const userId = c.get('userId');

  const body = await c.req.json();
  const parsed = insightsQuerySchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid month format. Use YYYY-MM.' } },
      400
    );
  }

  const now = currentMonth();
  const month = parsed.data.month ?? now;

  if (month > now) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Cannot generate report for future months.' } },
      400
    );
  }

  // Increment KV daily counter (shared with chat, 40/day soft limit)
  const today = new Date().toISOString().slice(0, 10);
  const kvKey = `ai-usage:${userId}:${today}`;
  const currentCount = parseInt((await c.env.KV.get(kvKey)) ?? '0', 10);
  // Use absolute expiration at midnight UTC to avoid TTL reset on every request
  const tomorrow = new Date();
  tomorrow.setUTCHours(24, 0, 0, 0);
  const expiration = Math.floor(tomorrow.getTime() / 1000);
  await c.env.KV.put(kvKey, String(currentCount + 1), { expiration });

  const prevMonth = previousMonth(month);

  const curStart = `${month}-01`;
  const curEnd = lastDayOfMonth(month);
  const prevStart = `${prevMonth}-01`;
  const prevEnd = lastDayOfMonth(prevMonth);

  // Parallel fetch
  const [curSummaryRows, curCategoryRows, prevSummaryRows, prevCategoryRows] = await Promise.all([
    fetchSummary(c.env.DB, userId, curStart, curEnd),
    fetchCategoryBreakdown(c.env.DB, userId, curStart, curEnd),
    fetchSummary(c.env.DB, userId, prevStart, prevEnd),
    fetchCategoryBreakdown(c.env.DB, userId, prevStart, prevEnd),
  ]);

  const curSummary = assembleSummary(curSummaryRows);
  const prevSummary = assembleSummary(prevSummaryRows);
  const categoryTrends = buildCategoryTrends(curCategoryRows, prevCategoryRows);

  // Build prompt
  const monthName_ = monthName(month);
  const prevMonthName_ = monthName(prevMonth);

  const categoryLines = categoryTrends
    .map(
      (t) =>
        `- ${t.name}: ${formatGHS(t.current_pesewas)} → ${formatGHS(t.previous_pesewas)} (${t.change_percentage > 0 ? '+' : ''}${t.change_percentage}%)`
    )
    .join('\n');

  const userPrompt =
    `Current month (${monthName_}): Income ${formatGHS(curSummary.totalIncome)}, Expenses ${formatGHS(curSummary.totalExpenses)}, Net ${formatGHS(curSummary.totalIncome - curSummary.totalExpenses)}\n` +
    `Previous month (${prevMonthName_}): Income ${formatGHS(prevSummary.totalIncome)}, Expenses ${formatGHS(prevSummary.totalExpenses)}, Net ${formatGHS(prevSummary.totalIncome - prevSummary.totalExpenses)}\n\n` +
    `Category changes:\n${categoryLines}`;

  const systemPrompt =
    `You are CediSense AI generating a monthly financial report for a Ghanaian user.\n` +
    `Write a concise 3-4 paragraph summary covering:\n` +
    `1. Overall spending vs income comparison to last month\n` +
    `2. Notable category changes (what went up/down significantly)\n` +
    `3. One specific, actionable savings tip based on the data\n` +
    `Use ₵ formatting. Be warm and encouraging. Reference specific numbers from the data provided.\n` +
    `Do not use headers or bullet points — write in flowing paragraphs.`;

  // Call Workers AI
  let responseText: string;
  try {
    const aiResponse = await (
      c.env.AI.run as (
        model: string,
        input: Record<string, unknown>
      ) => Promise<{ response?: string }>
    )(AI_MODEL, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      stream: false,
      max_tokens: 1024,
    });

    responseText = aiResponse?.response ?? '';

    if (!responseText) {
      return c.json(
        { error: { code: 'AI_ERROR', message: 'No response from AI model' } },
        500
      );
    }
  } catch {
    return c.json(
      { error: { code: 'AI_ERROR', message: 'Failed to generate report' } },
      500
    );
  }

  return c.json({
    data: {
      report: responseText,
      month,
    },
  });
});

export { insights };
