import {
  fetchAccounts, fetchSummary, fetchCategoryBreakdown,
  fetchRecentTransactions, assembleSummary,
  currentMonth, lastDayOfMonth,
} from './dashboard-queries.js';
import { getTrustLabel } from './trust-score.js';

function formatGHS(pesewas: number): string {
  const ghs = pesewas / 100;
  return `₵${ghs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatMonthName(month: string): string {
  const [year, mon] = month.split('-').map(Number);
  const d = new Date(year, mon - 1, 1);
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(d);
}

export async function buildFinancialContext(db: D1Database, userId: string): Promise<string> {
  const month = currentMonth();
  const startDate = `${month}-01`;
  const endDate = lastDayOfMonth(month);

  const [accounts, summaryRows, categories, recentTxns, budgetResult, goalResult, susuResult] = await Promise.all([
    fetchAccounts(db, userId),
    fetchSummary(db, userId, startDate, endDate),
    fetchCategoryBreakdown(db, userId, startDate, endDate),
    fetchRecentTransactions(db, userId, 5),
    // Budget data for AI context
    db.prepare(
      `SELECT b.amount_pesewas, c.name as category_name, COALESCE(s.spent, 0) as spent_pesewas
       FROM budgets b
       JOIN categories c ON b.category_id = c.id
       LEFT JOIN (
         SELECT category_id, SUM(amount_pesewas) as spent
         FROM transactions WHERE user_id = ? AND type = 'debit'
           AND transaction_date >= ? AND transaction_date <= ?
         GROUP BY category_id
       ) s ON b.category_id = s.category_id
       WHERE b.user_id = ?
       ORDER BY COALESCE(s.spent, 0) * 1.0 / b.amount_pesewas DESC`
    ).bind(userId, startDate, endDate, userId).all(),
    // Goals data for AI context
    db.prepare(
      'SELECT name, target_pesewas, current_pesewas, deadline FROM savings_goals WHERE user_id = ? ORDER BY current_pesewas * 1.0 / target_pesewas DESC'
    ).bind(userId).all(),
    // Susu group data for AI context
    db.prepare(
      `SELECT sg.name, sg.contribution_pesewas, sg.frequency, sg.current_round, sg.max_members,
              sg.variant, sg.is_active, sg.goal_amount_pesewas,
              (SELECT COUNT(*) FROM susu_members WHERE group_id = sg.id) as member_count,
              ts.score as trust_score, ts.current_streak
       FROM susu_groups sg
       JOIN susu_members sm ON sg.id = sm.group_id AND sm.user_id = ?
       LEFT JOIN trust_scores ts ON ts.user_id = ?
       WHERE sg.is_active = 1`
    ).bind(userId, userId).all(),
  ]);

  const { totalIncome, totalExpenses, totalFees, transactionCount } = assembleSummary(summaryRows);
  const totalBalance = accounts.reduce((sum, a) => sum + (a.balance_pesewas ?? 0), 0);
  const net = totalIncome - totalExpenses;

  const lines: string[] = [];

  lines.push('Accounts:');
  for (const acc of accounts) {
    lines.push(`- ${acc.name}: ${formatGHS(acc.balance_pesewas)}`);
  }
  lines.push(`Total balance: ${formatGHS(totalBalance)}`);
  lines.push('');

  lines.push(`This month (${formatMonthName(month)}):`);
  lines.push(`- Income: ${formatGHS(totalIncome)}`);
  lines.push(`- Expenses: ${formatGHS(totalExpenses)}`);
  lines.push(`- Fees: ${formatGHS(totalFees)}`);
  lines.push(`- Net: ${net >= 0 ? '+' : '-'}${formatGHS(Math.abs(net))}`);
  lines.push(`- Transactions: ${transactionCount}`);
  lines.push('');

  if (categories.length > 0) {
    lines.push('Top spending categories:');
    const topCats = categories.slice(0, 5);
    topCats.forEach((cat, i) => {
      const pct = totalExpenses > 0
        ? Math.round((cat.total_pesewas / totalExpenses) * 1000) / 10
        : 0;
      lines.push(`${i + 1}. ${cat.name}: ${formatGHS(cat.total_pesewas)} (${pct.toFixed(1)}%)`);
    });
    lines.push('');
  }

  if (recentTxns.length > 0) {
    lines.push('Recent transactions:');
    for (const txn of recentTxns) {
      const date = txn.transaction_date.slice(5);
      const [m, d] = date.split('-');
      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const dateLabel = `${monthNames[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`;
      const sign = txn.type === 'credit' ? '+' : '-';
      const desc = txn.description || txn.counterparty || 'Transaction';
      const cat = txn.category_name ? ` (${txn.category_name})` : '';
      lines.push(`- ${dateLabel}: ${sign}${formatGHS(txn.amount_pesewas)} ${desc}${cat}`);
    }
  }

  // Extract rows
  const budgetRows = (budgetResult.results ?? []) as Array<{ amount_pesewas: number; category_name: string; spent_pesewas: number }>;
  const goalRows = (goalResult.results ?? []) as Array<{ name: string; target_pesewas: number; current_pesewas: number; deadline: string | null }>;
  const susuRows = (susuResult.results ?? []) as Array<{
    name: string;
    contribution_pesewas: number;
    frequency: string;
    current_round: number;
    max_members: number;
    variant: string;
    is_active: number;
    goal_amount_pesewas: number | null;
    member_count: number;
    trust_score: number | null;
    current_streak: number | null;
  }>;

  // Budget context
  if (budgetRows.length > 0) {
    lines.push('');
    lines.push('Budgets (this month):');
    let totalBudgeted = 0;
    let totalBudgetSpent = 0;
    for (const b of budgetRows) {
      const spent = b.spent_pesewas ?? 0;
      const amount = b.amount_pesewas;
      const pct = amount > 0 ? Math.round((spent / amount) * 1000) / 10 : 0;
      const indicator = pct >= 100 ? '❌' : pct >= 80 ? '⚠️' : '✓';
      lines.push(`- ${b.category_name}: ${formatGHS(spent)}/${formatGHS(amount)} (${pct.toFixed(1)}%) ${indicator}`);
      totalBudgeted += amount;
      totalBudgetSpent += spent;
    }
    const totalPct = totalBudgeted > 0 ? Math.round((totalBudgetSpent / totalBudgeted) * 1000) / 10 : 0;
    lines.push(`Total: ${formatGHS(totalBudgetSpent)}/${formatGHS(totalBudgeted)} budgeted (${totalPct.toFixed(1)}%)`);
  }

  // Goals context
  if (goalRows.length > 0) {
    lines.push('');
    lines.push('Savings Goals:');
    for (const g of goalRows) {
      const pct = Math.min(Math.round((g.current_pesewas / g.target_pesewas) * 1000) / 10, 100);
      let deadlineStr = 'no deadline';
      if (g.deadline) {
        const days = Math.ceil((new Date(g.deadline + 'T23:59:59').getTime() - Date.now()) / 86400000);
        deadlineStr = days < 0 ? 'overdue' : `${days} days left`;
      }
      lines.push(`- ${g.name}: ${formatGHS(g.current_pesewas)}/${formatGHS(g.target_pesewas)} (${pct.toFixed(1)}%) — ${deadlineStr}`);
    }
  }

  // Susu groups context
  if (susuRows.length > 0) {
    lines.push('');
    lines.push('Susu Groups:');
    for (const s of susuRows) {
      const contrib = formatGHS(s.contribution_pesewas);
      const freq = s.frequency;
      if (s.variant === 'rotating') {
        const trustLabel = s.trust_score != null ? getTrustLabel(s.trust_score) : null;
        const trustStr = s.trust_score != null
          ? `, Trust score: ${s.trust_score} (${trustLabel})`
          : '';
        const streakStr = s.current_streak != null ? `, ${s.current_streak}-round streak` : '';
        lines.push(`- ${s.name} (rotating, ${freq}): Round ${s.current_round} of ${s.max_members}, ${s.member_count} members, ${contrib}/${freq}${trustStr}${streakStr}`);
      } else if (s.variant === 'goal_based' && s.goal_amount_pesewas != null) {
        const poolPct = Math.min(Math.round((s.contribution_pesewas * s.current_round / s.goal_amount_pesewas) * 1000) / 10, 100);
        lines.push(`- ${s.name} (goal_based, ${freq}): ${poolPct.toFixed(0)}% of ${formatGHS(s.goal_amount_pesewas)} goal reached, ${s.member_count} members, ${contrib}/${freq}`);
      } else {
        lines.push(`- ${s.name} (${s.variant}, ${freq}): Round ${s.current_round}, ${s.member_count} members, ${contrib}/${freq}`);
      }
    }
  }

  return lines.join('\n');
}

export function buildSystemPrompt(financialContext: string): string {
  return `You are CediSense AI, a friendly and knowledgeable personal finance advisor for Ghanaians.

You understand:
- Ghana Cedis (GHS/₵), pesewas, Mobile Money (MTN MoMo, Vodafone Cash, AirtelTigo)
- Ghanaian financial culture: susu savings, market day spending, family obligations, church tithes
- Local costs: trotro fares, ECG prepaid, water bills, rent advances
- MoMo fee structures and how to minimize them
- Savings options: T-Bills, mutual funds, susu collectors
- Susu (rotating savings groups): traditional Ghanaian communal savings, trust scores, contribution streaks

Guidelines:
- Be warm, practical, and non-judgmental
- Give specific advice based on the user's actual spending data
- Use ₵ formatting for all amounts (e.g., ₵1,234.56)
- When interpreting amounts from context, divide pesewas by 100 to get GHS
- Keep responses concise — 2-3 paragraphs max unless the user asks for detail
- If asked about something outside personal finance, politely redirect
- Never fabricate transaction data — only reference what's provided in the financial context below

Here is the user's current financial data:
${financialContext}`;
}
