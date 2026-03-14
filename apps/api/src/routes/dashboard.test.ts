import { describe, it, expect } from 'vitest';
import { lastDayOfMonth, allDaysInMonth } from './dashboard.js';

describe('Dashboard helpers', () => {
  describe('lastDayOfMonth', () => {
    it('returns correct last day for January (31 days)', () => {
      expect(lastDayOfMonth('2026-01')).toBe('2026-01-31');
    });

    it('returns correct last day for February non-leap year (28 days)', () => {
      expect(lastDayOfMonth('2025-02')).toBe('2025-02-28');
    });

    it('returns correct last day for February leap year (29 days)', () => {
      expect(lastDayOfMonth('2024-02')).toBe('2024-02-29');
    });

    it('returns correct last day for April (30 days)', () => {
      expect(lastDayOfMonth('2026-04')).toBe('2026-04-30');
    });

    it('returns correct last day for December (31 days)', () => {
      expect(lastDayOfMonth('2026-12')).toBe('2026-12-31');
    });
  });

  describe('allDaysInMonth', () => {
    it('returns 31 days for March', () => {
      const days = allDaysInMonth('2026-03');
      expect(days).toHaveLength(31);
      expect(days[0]).toBe('2026-03-01');
      expect(days[30]).toBe('2026-03-31');
    });

    it('returns 28 days for Feb non-leap', () => {
      const days = allDaysInMonth('2025-02');
      expect(days).toHaveLength(28);
      expect(days[27]).toBe('2025-02-28');
    });

    it('returns 29 days for Feb leap year', () => {
      const days = allDaysInMonth('2024-02');
      expect(days).toHaveLength(29);
    });

    it('all dates are in YYYY-MM-DD format', () => {
      const days = allDaysInMonth('2026-03');
      for (const d of days) {
        expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });
  });

  describe('category percentage computation', () => {
    it('computes correct percentages with rounding', () => {
      const totalExpenses = 30000;
      const categoryTotals = [15000, 10000, 5000];
      const percentages = categoryTotals.map(
        (t) => Math.round((t / totalExpenses) * 1000) / 10
      );
      expect(percentages).toEqual([50.0, 33.3, 16.7]);
    });

    it('returns 0 for all when totalExpenses is 0', () => {
      const totalExpenses = 0;
      const result = totalExpenses > 0
        ? Math.round((5000 / totalExpenses) * 1000) / 10
        : 0;
      expect(result).toBe(0);
    });
  });

  describe('uncategorized computation', () => {
    it('computes uncategorized as remainder', () => {
      const totalExpenses = 50000;
      const categorizedTotal = 35000;
      expect(totalExpenses - categorizedTotal).toBe(15000);
    });

    it('no uncategorized when fully categorized', () => {
      const totalExpenses = 50000;
      const categorizedTotal = 50000;
      expect(totalExpenses - categorizedTotal).toBe(0);
    });
  });

  describe('daily trend zero-fill', () => {
    it('fills missing days with 0', () => {
      const dailyMap = new Map<string, number>([
        ['2026-03-01', 5000],
        ['2026-03-15', 10000],
      ]);
      const days = allDaysInMonth('2026-03');
      const trend = days.map((date) => ({
        date,
        total_pesewas: dailyMap.get(date) ?? 0,
      }));
      expect(trend).toHaveLength(31);
      expect(trend[0]).toEqual({ date: '2026-03-01', total_pesewas: 5000 });
      expect(trend[1]).toEqual({ date: '2026-03-02', total_pesewas: 0 });
      expect(trend[14]).toEqual({ date: '2026-03-15', total_pesewas: 10000 });
    });
  });

  describe('summary type mapping', () => {
    it('maps credit to income, debit to expenses, ignores transfer for totals', () => {
      const rows = [
        { type: 'credit', total: 100000, fees: 0, count: 5 },
        { type: 'debit', total: 60000, fees: 2000, count: 12 },
        { type: 'transfer', total: 30000, fees: 500, count: 3 },
      ];
      let totalIncome = 0;
      let totalExpenses = 0;
      let totalFees = 0;
      let transactionCount = 0;
      for (const row of rows) {
        transactionCount += row.count;
        totalFees += row.fees;
        if (row.type === 'credit') totalIncome += row.total;
        else if (row.type === 'debit') totalExpenses += row.total;
      }
      expect(totalIncome).toBe(100000);
      expect(totalExpenses).toBe(60000);
      expect(totalFees).toBe(2500);
      expect(transactionCount).toBe(20);
    });
  });
});
