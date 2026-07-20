/** Clamp a numeric value between min and max. */
export function clampQuantity(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Late return penalty rate (50% of daily rate). */
export const titanLateReturnPenaltyRate = 0.5;
