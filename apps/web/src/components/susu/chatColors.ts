// Ghana-inspired chat color palette — vibrant but readable on dark backgrounds
const CHAT_COLORS = [
  '#FF6B35', // Flame orange
  '#00C896', // Teal green
  '#E8A838', // Gold
  '#7C6BFF', // Purple
  '#FF5C8A', // Rose pink
  '#00B4D8', // Cyan blue
  '#FFD166', // Warm yellow
  '#06D6A0', // Mint green
  '#EF476F', // Coral red
  '#118AB2', // Ocean blue
  '#8338EC', // Violet
  '#F77F00', // Tangerine
];

/**
 * Get a deterministic color for a member based on their user_id.
 * Same user always gets the same color across sessions.
 */
export function getMemberColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  return CHAT_COLORS[Math.abs(hash) % CHAT_COLORS.length];
}
