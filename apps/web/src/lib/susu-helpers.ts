export function formatFrequency(freq: string): string {
  switch (freq) {
    case 'daily': return 'Daily';
    case 'weekly': return 'Weekly';
    case 'biweekly': return 'Bi-weekly';
    case 'monthly': return 'Monthly';
    default: return freq;
  }
}

export function formatVariant(variant: string): string {
  switch (variant) {
    case 'rotating': return 'Rotating';
    case 'accumulating': return 'Accumulating';
    case 'goal_based': return 'Goal-based';
    case 'bidding': return 'Bidding';
    default: return variant;
  }
}

export function computePayoutAmount(contribution: number, memberCount: number): number {
  return contribution * memberCount;
}

export function computePremiumAmount(amount: number, premiumPercent: number): number {
  return Math.round(amount * premiumPercent / 100);
}

export function computePenaltyAmount(contribution: number, penaltyPercent: number): number {
  return Math.round(contribution * penaltyPercent / 100);
}

export function getVotesNeeded(memberCount: number): number {
  return Math.ceil(memberCount / 2);
}

export function isVotingComplete(votesFor: number, votesAgainst: number, totalMembers: number): {
  decided: boolean;
  approved: boolean;
} {
  const needed = Math.ceil(totalMembers / 2);
  if (votesFor >= needed) return { decided: true, approved: true };
  if (votesAgainst > totalMembers - needed) return { decided: true, approved: false };
  return { decided: false, approved: false };
}

export function generateReceiptNumber(id: string): string {
  return `CS-${id.slice(0, 8).toUpperCase()}`;
}

export function computeGoalProgress(contributed: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.min(Math.round((contributed / goal) * 1000) / 10, 100);
}
