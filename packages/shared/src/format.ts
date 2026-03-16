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
 * Convert Ghana Cedis (GHS) to pesewas (integer).
 * e.g. 12.50 → 1250
 */
export function toPesewas(ghs: number): number {
  return Math.round(ghs * 100);
}

/**
 * Convert pesewas (integer) to Ghana Cedis (GHS).
 * e.g. 1250 → 12.5
 */
export function toGHS(pesewas: number): number {
  return pesewas / 100;
}

/**
 * Format pesewas as Ghana Cedis string: ₵1,234.56
 * e.g. 123456 → '₵1,234.56'
 */
export function formatPesewas(pesewas: number): string {
  return formatGHS(pesewas / 100);
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

/**
 * Normalize any phone number — Ghana local or international.
 * For Ghana numbers (0XXXXXXXXX or +233XXXXXXXXX), returns normalized Ghana format.
 * For international numbers (e.g. +44..., +1...), returns the number with leading +.
 * Returns null if the input doesn't look like a valid phone number.
 */
export function normalizePhoneInternational(phone: string): string | null {
  const trimmed = phone.trim();

  // Try Ghana format first
  const ghanaResult = normalizePhone(trimmed);
  if (ghanaResult) return ghanaResult;

  // International format: must start with + and have 8-15 digits
  if (trimmed.startsWith('+')) {
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length >= 8 && digits.length <= 15) {
      return '+' + digits;
    }
  }

  // Raw digits that look international (8-15 digits, not Ghana)
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length >= 8 && digits.length <= 15) {
    return digits;
  }

  return null;
}
