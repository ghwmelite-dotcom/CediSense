import { describe, it, expect } from 'vitest';
import {
  createSusuGroupSchema,
  joinSusuGroupSchema,
  recordContributionSchema,
  updateSusuGroupSchema,
  confirmCandidateSchema,
  earlyPayoutRequestSchema,
  earlyPayoutVoteSchema,
  susuMessageSchema,
} from './schemas';

describe('Susu Schemas', () => {
  // ─── createSusuGroupSchema ──────────────────────────────────────────────────

  describe('createSusuGroupSchema', () => {
    it('accepts valid rotating group', () => {
      const result = createSusuGroupSchema.safeParse({
        name: 'Accra Savings Club',
        contribution_pesewas: 50000,
        frequency: 'weekly',
        max_members: 10,
        variant: 'rotating',
      });
      expect(result.success).toBe(true);
    });

    it('accepts valid goal_based group with goal amount', () => {
      const result = createSusuGroupSchema.safeParse({
        name: 'School Fees Fund',
        contribution_pesewas: 100000,
        frequency: 'monthly',
        max_members: 5,
        variant: 'goal_based',
        goal_amount_pesewas: 2000000,
        goal_description: 'Save for school fees',
      });
      expect(result.success).toBe(true);
    });

    it('rejects goal_based without goal amount', () => {
      const result = createSusuGroupSchema.safeParse({
        name: 'No Goal Amount',
        contribution_pesewas: 50000,
        frequency: 'weekly',
        variant: 'goal_based',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty name', () => {
      const result = createSusuGroupSchema.safeParse({
        name: '',
        contribution_pesewas: 50000,
        frequency: 'weekly',
      });
      expect(result.success).toBe(false);
    });

    it('rejects negative contribution', () => {
      const result = createSusuGroupSchema.safeParse({
        name: 'Test Group',
        contribution_pesewas: -100,
        frequency: 'weekly',
      });
      expect(result.success).toBe(false);
    });

    it('rejects zero contribution', () => {
      const result = createSusuGroupSchema.safeParse({
        name: 'Test Group',
        contribution_pesewas: 0,
        frequency: 'weekly',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid frequency', () => {
      const result = createSusuGroupSchema.safeParse({
        name: 'Test Group',
        contribution_pesewas: 50000,
        frequency: 'biweekly',
      });
      expect(result.success).toBe(false);
    });

    it('rejects max_members below 2', () => {
      const result = createSusuGroupSchema.safeParse({
        name: 'Test Group',
        contribution_pesewas: 50000,
        frequency: 'weekly',
        max_members: 1,
      });
      expect(result.success).toBe(false);
    });

    it('rejects max_members above 50', () => {
      const result = createSusuGroupSchema.safeParse({
        name: 'Test Group',
        contribution_pesewas: 50000,
        frequency: 'weekly',
        max_members: 51,
      });
      expect(result.success).toBe(false);
    });

    it('defaults variant to rotating', () => {
      const result = createSusuGroupSchema.safeParse({
        name: 'Default Variant',
        contribution_pesewas: 50000,
        frequency: 'weekly',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.variant).toBe('rotating');
      }
    });

    it('defaults max_members to 12', () => {
      const result = createSusuGroupSchema.safeParse({
        name: 'Default Members',
        contribution_pesewas: 50000,
        frequency: 'weekly',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.max_members).toBe(12);
      }
    });

    it('accepts accumulating variant without goal', () => {
      const result = createSusuGroupSchema.safeParse({
        name: 'Pool Fund',
        contribution_pesewas: 30000,
        frequency: 'daily',
        variant: 'accumulating',
      });
      expect(result.success).toBe(true);
    });

    it('accepts bidding variant', () => {
      const result = createSusuGroupSchema.safeParse({
        name: 'Bidding Group',
        contribution_pesewas: 75000,
        frequency: 'monthly',
        variant: 'bidding',
      });
      expect(result.success).toBe(true);
    });

    it('rejects name over 100 chars', () => {
      const result = createSusuGroupSchema.safeParse({
        name: 'A'.repeat(101),
        contribution_pesewas: 50000,
        frequency: 'weekly',
      });
      expect(result.success).toBe(false);
    });

    it('rejects non-integer contribution', () => {
      const result = createSusuGroupSchema.safeParse({
        name: 'Test Group',
        contribution_pesewas: 50000.5,
        frequency: 'weekly',
      });
      expect(result.success).toBe(false);
    });
  });

  // ─── joinSusuGroupSchema ───────────────────────────────────────────────────

  describe('joinSusuGroupSchema', () => {
    it('accepts valid invite code', () => {
      const result = joinSusuGroupSchema.safeParse({ invite_code: 'ABC123XY' });
      expect(result.success).toBe(true);
    });

    it('rejects empty invite code', () => {
      const result = joinSusuGroupSchema.safeParse({ invite_code: '' });
      expect(result.success).toBe(false);
    });

    it('rejects missing invite code', () => {
      const result = joinSusuGroupSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  // ─── recordContributionSchema ──────────────────────────────────────────────

  describe('recordContributionSchema', () => {
    it('accepts valid contribution', () => {
      const result = recordContributionSchema.safeParse({
        member_id: 'mem_abc123',
        amount_pesewas: 50000,
      });
      expect(result.success).toBe(true);
    });

    it('accepts contribution with is_late flag', () => {
      const result = recordContributionSchema.safeParse({
        member_id: 'mem_abc123',
        amount_pesewas: 50000,
        is_late: true,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is_late).toBe(true);
      }
    });

    it('accepts contribution without is_late (optional)', () => {
      const result = recordContributionSchema.safeParse({
        member_id: 'mem_abc123',
        amount_pesewas: 50000,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is_late).toBeUndefined();
      }
    });

    it('rejects missing member_id', () => {
      const result = recordContributionSchema.safeParse({
        amount_pesewas: 50000,
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty member_id', () => {
      const result = recordContributionSchema.safeParse({
        member_id: '',
        amount_pesewas: 50000,
      });
      expect(result.success).toBe(false);
    });

    it('rejects zero amount', () => {
      const result = recordContributionSchema.safeParse({
        member_id: 'mem_abc123',
        amount_pesewas: 0,
      });
      expect(result.success).toBe(false);
    });

    it('rejects negative amount', () => {
      const result = recordContributionSchema.safeParse({
        member_id: 'mem_abc123',
        amount_pesewas: -5000,
      });
      expect(result.success).toBe(false);
    });

    it('rejects non-integer amount', () => {
      const result = recordContributionSchema.safeParse({
        member_id: 'mem_abc123',
        amount_pesewas: 50000.5,
      });
      expect(result.success).toBe(false);
    });
  });

  // ─── earlyPayoutRequestSchema ─────────────────────────────────────────────

  describe('earlyPayoutRequestSchema', () => {
    it('accepts with reason', () => {
      const result = earlyPayoutRequestSchema.safeParse({
        reason: 'Emergency medical bills',
      });
      expect(result.success).toBe(true);
    });

    it('accepts without reason', () => {
      const result = earlyPayoutRequestSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('rejects reason over 200 chars', () => {
      const result = earlyPayoutRequestSchema.safeParse({
        reason: 'A'.repeat(201),
      });
      expect(result.success).toBe(false);
    });

    it('accepts reason at exactly 200 chars', () => {
      const result = earlyPayoutRequestSchema.safeParse({
        reason: 'A'.repeat(200),
      });
      expect(result.success).toBe(true);
    });
  });

  // ─── earlyPayoutVoteSchema ────────────────────────────────────────────────

  describe('earlyPayoutVoteSchema', () => {
    it('accepts for vote', () => {
      const result = earlyPayoutVoteSchema.safeParse({ vote: 'for' });
      expect(result.success).toBe(true);
    });

    it('accepts against vote', () => {
      const result = earlyPayoutVoteSchema.safeParse({ vote: 'against' });
      expect(result.success).toBe(true);
    });

    it('rejects invalid vote value', () => {
      const result = earlyPayoutVoteSchema.safeParse({ vote: 'abstain' });
      expect(result.success).toBe(false);
    });

    it('rejects missing vote', () => {
      const result = earlyPayoutVoteSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('rejects empty string vote', () => {
      const result = earlyPayoutVoteSchema.safeParse({ vote: '' });
      expect(result.success).toBe(false);
    });
  });

  // ─── susuMessageSchema ────────────────────────────────────────────────────

  describe('susuMessageSchema', () => {
    it('accepts valid message', () => {
      const result = susuMessageSchema.safeParse({ content: 'Hello group!' });
      expect(result.success).toBe(true);
    });

    it('rejects empty message', () => {
      const result = susuMessageSchema.safeParse({ content: '' });
      expect(result.success).toBe(false);
    });

    it('rejects message over 500 chars', () => {
      const result = susuMessageSchema.safeParse({ content: 'A'.repeat(501) });
      expect(result.success).toBe(false);
    });

    it('accepts message at exactly 500 chars', () => {
      const result = susuMessageSchema.safeParse({ content: 'A'.repeat(500) });
      expect(result.success).toBe(true);
    });

    it('rejects missing content field', () => {
      const result = susuMessageSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  // ─── confirmCandidateSchema ───────────────────────────────────────────────

  describe('confirmCandidateSchema', () => {
    it('defaults reminder_days_before to 3', () => {
      const result = confirmCandidateSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.reminder_days_before).toBe(3);
      }
    });

    it('accepts custom reminder days', () => {
      const result = confirmCandidateSchema.safeParse({ reminder_days_before: 7 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.reminder_days_before).toBe(7);
      }
    });

    it('rejects reminder days above 14', () => {
      const result = confirmCandidateSchema.safeParse({ reminder_days_before: 15 });
      expect(result.success).toBe(false);
    });

    it('rejects negative reminder days', () => {
      const result = confirmCandidateSchema.safeParse({ reminder_days_before: -1 });
      expect(result.success).toBe(false);
    });

    it('accepts reminder days at 0', () => {
      const result = confirmCandidateSchema.safeParse({ reminder_days_before: 0 });
      expect(result.success).toBe(true);
    });

    it('accepts reminder days at 14', () => {
      const result = confirmCandidateSchema.safeParse({ reminder_days_before: 14 });
      expect(result.success).toBe(true);
    });
  });

  // ─── updateSusuGroupSchema ────────────────────────────────────────────────

  describe('updateSusuGroupSchema', () => {
    it('accepts partial updates (name only)', () => {
      const result = updateSusuGroupSchema.safeParse({ name: 'New Name' });
      expect(result.success).toBe(true);
    });

    it('accepts is_active boolean', () => {
      const result = updateSusuGroupSchema.safeParse({ is_active: false });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is_active).toBe(false);
      }
    });

    it('rejects invalid frequency', () => {
      const result = updateSusuGroupSchema.safeParse({ frequency: 'biweekly' });
      expect(result.success).toBe(false);
    });

    it('accepts valid frequency update', () => {
      const result = updateSusuGroupSchema.safeParse({ frequency: 'monthly' });
      expect(result.success).toBe(true);
    });

    it('accepts empty object (all optional)', () => {
      const result = updateSusuGroupSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('accepts multiple fields at once', () => {
      const result = updateSusuGroupSchema.safeParse({
        name: 'Updated Group',
        contribution_pesewas: 75000,
        frequency: 'daily',
        max_members: 20,
        is_active: true,
      });
      expect(result.success).toBe(true);
    });

    it('rejects max_members below 2', () => {
      const result = updateSusuGroupSchema.safeParse({ max_members: 1 });
      expect(result.success).toBe(false);
    });

    it('rejects max_members above 50', () => {
      const result = updateSusuGroupSchema.safeParse({ max_members: 51 });
      expect(result.success).toBe(false);
    });
  });
});
