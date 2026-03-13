export function parseAmount(str: string): number {
  const cleaned = str.replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}
