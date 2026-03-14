# PDF Export — Design Spec

## Overview

Add PDF export for monthly spending reports and transaction history using client-side `window.print()` with print-optimized CSS. No server-side PDF generation or R2 storage needed — the browser's native print dialog handles PDF saving.

## Scope

**In scope:**
- Monthly report print view: income/expenses summary, category breakdown table, AI summary
- Transaction history print view: filtered transaction table with totals
- Print-optimized CSS (white background, black text, clean tables, no nav)
- "Export PDF" buttons on Insights page and Transaction Feed page

**Out of scope:**
- Server-side PDF generation
- R2 storage of generated PDFs
- Scheduled/automated report generation
- Custom PDF styling beyond print CSS

## Architecture

Two print-friendly page components rendered at dedicated routes (`/print/report`, `/print/transactions`). These routes are unstyled (no AppShell) with `@media print` CSS. The "Export PDF" button opens the print view in a new tab, which auto-triggers `window.print()`.

---

## Print Routes

### `/print/report?month=YYYY-MM`

Renders a print-friendly monthly report:
- CediSense header with month
- Summary table: income, expenses, fees, net, transaction count
- Category breakdown table: name, amount, percentage (sorted by amount DESC)
- White background, black text, clean borders

### `/print/transactions?from=YYYY-MM-DD&to=YYYY-MM-DD&category_id=X&account_id=X`

Renders a print-friendly transaction list:
- CediSense header with date range
- Transaction table: date, description, counterparty, category, amount, type
- Totals row at bottom: total income, total expenses
- Supports same filters as the transaction feed

---

## Print CSS

```css
@media print {
  body { background: white; color: black; font-family: system-ui; }
  .no-print { display: none; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
  th { background: #f5f5f5; font-weight: 600; }
  .amount-credit { color: #16a34a; }
  .amount-debit { color: #dc2626; }
}

@media screen {
  .print-only { display: none; }
}
```

---

## File Structure

### New Files
- `apps/web/src/pages/print/MonthlyReportPrint.tsx`
- `apps/web/src/pages/print/TransactionsPrint.tsx`
- `apps/web/src/styles/print.css`

### Modified Files
- `apps/web/src/App.tsx` — Add print routes (outside AppShell, no auth required for print view since data is fetched with token)
- `apps/web/src/pages/InsightsPage.tsx` — Add "Export PDF" button
- `apps/web/src/pages/TransactionFeedPage.tsx` — Add "Export" button
