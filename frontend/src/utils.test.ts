import { describe, it, expect } from 'vitest';
import { calculateTitanCautionAmount, clampQuantity, titanLateReturnPenaltyRate } from './utils';

describe('utils', () => {
  it('clamps values correctly', () => {
    expect(clampQuantity(5, 0, 10)).toBe(5);
    expect(clampQuantity(-1, 0, 10)).toBe(0);
    expect(clampQuantity(15, 0, 10)).toBe(10);
  });

  it('exposes titanLateReturnPenaltyRate as 0.5', () => {
    expect(titanLateReturnPenaltyRate).toBe(0.5);
  });

  describe('calculateTitanCautionAmount', () => {
    it('returns custom caution amount if provided and positive', () => {
      expect(calculateTitanCautionAmount(500000, 250000)).toBe(250000);
      expect(calculateTitanCautionAmount(100000, 75000)).toBe(75000);
    });

    it('returns 0 when totalRent is 0 or negative', () => {
      expect(calculateTitanCautionAmount(0)).toBe(0);
      expect(calculateTitanCautionAmount(-500)).toBe(0);
    });

    it('returns 100 000 Ar when totalRent is between 1 and 199 999 Ar (Article 7)', () => {
      expect(calculateTitanCautionAmount(50000)).toBe(100000);
      expect(calculateTitanCautionAmount(199999)).toBe(100000);
    });

    it('returns 50% of totalRent when totalRent is >= 200 000 Ar (Article 7)', () => {
      expect(calculateTitanCautionAmount(200000)).toBe(100000);
      expect(calculateTitanCautionAmount(500000)).toBe(250000);
      expect(calculateTitanCautionAmount(1500000)).toBe(750000);
    });

    it('ignores non-positive custom caution amount and uses Article 7 calculation', () => {
      expect(calculateTitanCautionAmount(300000, 0)).toBe(150000);
      expect(calculateTitanCautionAmount(100000, null)).toBe(100000);
      expect(calculateTitanCautionAmount(400000, undefined)).toBe(200000);
    });
  });
});
