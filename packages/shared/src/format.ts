/**
 * Format a number as Ghana Cedis: ₵1,234.56
 */
export function formatGHS(amount: number): string {
  return `₵${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Normalize a Ghana phone number to 0XXXXXXXXX format.
 * Accepts: "024 123 4567", "024-123-4567", "+233241234567", "233241234567", "0241234567"
 * Returns null if invalid.
 */
export function normalizePhone(phone: string): string | null {
  // Strip all non-digit characters
  let digits = phone.replace(/\D/g, '');

  // Handle +233 or 233 prefix
  if (digits.startsWith('233') && digits.length === 12) {
    digits = '0' + digits.slice(3);
  }

  // Validate Ghana format: 0[2-5]XXXXXXXX (10 digits)
  if (/^0[2-5]\d{8}$/.test(digits)) {
    return digits;
  }

  return null;
}
