// Ghana-inspired chat color palette — vibrant, readable on DARK backgrounds
const CHAT_COLORS_DARK = [
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

// Same hues, darkened to stay legible (≈AA) on LIGHT surfaces so member names
// read as premium, not neon.
const CHAT_COLORS_LIGHT = [
  '#C2410C', // flame
  '#047857', // teal green
  '#8A6308', // gold
  '#5B45D6', // purple
  '#BE2A5B', // rose
  '#0E7490', // cyan
  '#8A6D0B', // warm yellow
  '#0F766E', // mint
  '#BE1D4A', // coral
  '#0E6A8C', // ocean
  '#6D28D9', // violet
  '#C05600', // tangerine
];

/**
 * Get a deterministic color for a member based on their user_id.
 * Same user always gets the same hue; the shade adapts to the theme so names
 * stay readable on light surfaces.
 */
export function getMemberColor(userId: string, theme: 'light' | 'dark' = 'dark'): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  const palette = theme === 'light' ? CHAT_COLORS_LIGHT : CHAT_COLORS_DARK;
  return palette[Math.abs(hash) % palette.length];
}
