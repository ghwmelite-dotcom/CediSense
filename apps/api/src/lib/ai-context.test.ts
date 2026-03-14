import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from './ai-context.js';

describe('buildSystemPrompt', () => {
  it('injects financial context into system prompt', () => {
    const context = 'Accounts:\n- MTN MoMo: ₵500.00\nTotal balance: ₵500.00';
    const prompt = buildSystemPrompt(context);

    expect(prompt).toContain('CediSense AI');
    expect(prompt).toContain('MTN MoMo');
    expect(prompt).toContain('₵500.00');
    expect(prompt).toContain('Ghana Cedis');
    expect(prompt).toContain('susu');
  });

  it('includes all guideline sections', () => {
    const prompt = buildSystemPrompt('test context');

    expect(prompt).toContain('You understand:');
    expect(prompt).toContain('Guidelines:');
    expect(prompt).toContain('MoMo fee');
    expect(prompt).toContain('non-judgmental');
    expect(prompt).toContain('Never fabricate');
  });
});
