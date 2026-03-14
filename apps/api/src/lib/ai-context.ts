import {
  fetchAccounts, fetchSummary, fetchCategoryBreakdown,
  fetchRecentTransactions, assembleSummary,
  currentMonth, lastDayOfMonth,
} from './dashboard-queries.js';

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

  const [accounts, summaryRows, categories, recentTxns] = await Promise.all([
    fetchAccounts(db, userId),
    fetchSummary(db, userId, startDate, endDate),
    fetchCategoryBreakdown(db, userId, startDate, endDate),
    fetchRecentTransactions(db, userId, 5),
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
