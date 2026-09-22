/** Clamp a numeric value between min and max. */
export function clampQuantity(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Late return penalty rate (50% of daily rate). */
export const titanLateReturnPenaltyRate = 0.5;

/**
 * Exact Article 7 Titan caution (escrow):
 * Custom amount if specified and > 0, otherwise 100 000 Ar for < 200 000 Ar, else 50% of total rent.
 */
export function calculateTitanCautionAmount(
  totalRent: number,
  customCautionAmount?: number | null
): number {
  if (customCautionAmount !== null && customCautionAmount !== undefined && customCautionAmount > 0) {
    return customCautionAmount;
  }
  if (totalRent <= 0) return 0;
  return totalRent < 200000 ? 100000 : Math.round(totalRent * 0.5);
}
