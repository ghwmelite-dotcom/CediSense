import { describe, it, expect } from 'vitest';
import {
  formatFrequency,
  formatVariant,
  computePayoutAmount,
  computePremiumAmount,
  computePenaltyAmount,
  getVotesNeeded,
  isVotingComplete,
  generateReceiptNumber,
  computeGoalProgress,
} from './susu-helpers';

describe('Susu Helpers', () => {
  // ─── formatFrequency ──────────────────────────────────────────────────────

  describe('formatFrequency', () => {
    it('formats daily', () => expect(formatFrequency('daily')).toBe('Daily'));
    it('formats weekly', () => expect(formatFrequency('weekly')).toBe('Weekly'));
    it('formats biweekly', () => expect(formatFrequency('biweekly')).toBe('Bi-weekly'));
    it('formats monthly', () => expect(formatFrequency('monthly')).toBe('Monthly'));
    it('returns unknown values as-is', () => expect(formatFrequency('yearly')).toBe('yearly'));
    it('returns empty string as-is', () => expect(formatFrequency('')).toBe(''));
  });

  // ─── formatVariant ────────────────────────────────────────────────────────

  describe('formatVariant', () => {
    it('formats rotating', () => expect(formatVariant('rotating')).toBe('Rotating'));
    it('formats accumulating', () => expect(formatVariant('accumulating')).toBe('Accumulating'));
    it('formats goal_based', () => expect(formatVariant('goal_based')).toBe('Goal-based'));
    it('formats bidding', () => expect(formatVariant('bidding')).toBe('Bidding'));
    it('returns unknown values as-is', () => expect(formatVariant('custom')).toBe('custom'));
  });

  // ─── computePayoutAmount ──────────────────────────────────────────────────

  describe('computePayoutAmount', () => {
    it('multiplies contribution by member count', () => {
      expect(computePayoutAmount(20000, 8)).toBe(160000);
    });

    it('handles single member', () => {
      expect(computePayoutAmount(5000, 1)).toBe(5000);
    });

    it('handles large group of 50', () => {
      expect(computePayoutAmount(10000, 50)).toBe(500000);
    });

    it('handles zero contribution', () => {
      expect(computePayoutAmount(0, 10)).toBe(0);
    });
  });

  // ─── computePremiumAmount ─────────────────────────────────────────────────

  describe('computePremiumAmount', () => {
    it('computes 5% premium', () => {
      expect(computePremiumAmount(160000, 5)).toBe(8000);
    });

    it('computes 10% premium', () => {
      expect(computePremiumAmount(100000, 10)).toBe(10000);
    });

    it('rounds to nearest pesewa', () => {
      expect(computePremiumAmount(33333, 5)).toBe(1667);
    });

    it('handles 0% premium', () => {
      expect(computePremiumAmount(100000, 0)).toBe(0);
    });

    it('handles 100% premium', () => {
      expect(computePremiumAmount(50000, 100)).toBe(50000);
    });
  });

  // ─── computePenaltyAmount ─────────────────────────────────────────────────

  describe('computePenaltyAmount', () => {
    it('computes 2% penalty', () => {
      expect(computePenaltyAmount(20000, 2)).toBe(400);
    });

    it('computes 3% penalty and rounds correctly', () => {
      expect(computePenaltyAmount(15000, 3)).toBe(450);
    });

    it('computes 5% penalty', () => {
      expect(computePenaltyAmount(10000, 5)).toBe(500);
    });

    it('handles 0% penalty', () => {
      expect(computePenaltyAmount(50000, 0)).toBe(0);
    });
  });

  // ─── getVotesNeeded ───────────────────────────────────────────────────────

  describe('getVotesNeeded', () => {
    it('returns majority for even count (8)', () => {
      expect(getVotesNeeded(8)).toBe(4);
    });

    it('returns majority for odd count (7)', () => {
      expect(getVotesNeeded(7)).toBe(4);
    });

    it('returns 1 for 2 members', () => {
      expect(getVotesNeeded(2)).toBe(1);
    });

    it('returns 6 for 12 members', () => {
      expect(getVotesNeeded(12)).toBe(6);
    });

    it('returns 1 for 1 member', () => {
      expect(getVotesNeeded(1)).toBe(1);
    });

    it('returns 3 for 5 members', () => {
      expect(getVotesNeeded(5)).toBe(3);
    });
  });

  // ─── isVotingComplete ─────────────────────────────────────────────────────

  describe('isVotingComplete', () => {
    it('approves when votes_for reaches majority', () => {
      expect(isVotingComplete(4, 1, 8)).toEqual({ decided: true, approved: true });
    });

    it('denies when approval is impossible', () => {
      expect(isVotingComplete(1, 5, 8)).toEqual({ decided: true, approved: false });
    });

    it('undecided when votes are split', () => {
      expect(isVotingComplete(2, 2, 8)).toEqual({ decided: false, approved: false });
    });

    it('approves at exact majority for odd group', () => {
      expect(isVotingComplete(3, 0, 5)).toEqual({ decided: true, approved: true });
    });

    it('undecided at one below majority', () => {
      expect(isVotingComplete(3, 0, 8)).toEqual({ decided: false, approved: false });
    });

    it('approves unanimously', () => {
      expect(isVotingComplete(8, 0, 8)).toEqual({ decided: true, approved: true });
    });

    it('denies unanimously', () => {
      expect(isVotingComplete(0, 8, 8)).toEqual({ decided: true, approved: false });
    });

    it('handles 2-member group approval', () => {
      expect(isVotingComplete(1, 0, 2)).toEqual({ decided: true, approved: true });
    });

    it('handles 2-member group denial', () => {
      expect(isVotingComplete(0, 2, 2)).toEqual({ decided: true, approved: false });
    });
  });

  // ─── generateReceiptNumber ────────────────────────────────────────────────

  describe('generateReceiptNumber', () => {
    it('generates CS- prefix with 8 uppercase chars', () => {
      const result = generateReceiptNumber('abcdef1234567890');
      expect(result).toBe('CS-ABCDEF12');
    });

    it('matches expected format pattern', () => {
      const result = generateReceiptNumber('a1b2c3d4e5f6');
      expect(result).toMatch(/^CS-[A-Z0-9]{8}$/);
    });

    it('handles already uppercase input', () => {
      const result = generateReceiptNumber('ABCDEF1234567890');
      expect(result).toBe('CS-ABCDEF12');
    });

    it('handles mixed case input', () => {
      const result = generateReceiptNumber('aBcDeF12');
      expect(result).toBe('CS-ABCDEF12');
    });
  });

  // ─── computeGoalProgress ──────────────────────────────────────────────────

  describe('computeGoalProgress', () => {
    it('computes 50% correctly', () => {
      expect(computeGoalProgress(50000, 100000)).toBe(50);
    });

    it('caps at 100 when over-contributed', () => {
      expect(computeGoalProgress(150000, 100000)).toBe(100);
    });

    it('returns 0 for zero goal', () => {
      expect(computeGoalProgress(5000, 0)).toBe(0);
    });

    it('returns 0 for negative goal', () => {
      expect(computeGoalProgress(5000, -100)).toBe(0);
    });

    it('rounds to 1 decimal place', () => {
      expect(computeGoalProgress(33333, 100000)).toBe(33.3);
    });

    it('returns 100 at exact goal', () => {
      expect(computeGoalProgress(100000, 100000)).toBe(100);
    });

    it('returns 0 for zero contributed', () => {
      expect(computeGoalProgress(0, 100000)).toBe(0);
    });

    it('handles small progress', () => {
      expect(computeGoalProgress(100, 100000)).toBe(0.1);
    });
  });
});
