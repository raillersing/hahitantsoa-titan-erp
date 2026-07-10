export interface StockValidationResult {
  isValid: boolean;
  newAvailable: number;
  quantiteEngagee: number;
  error?: string;
}

export const validateStockChange = (
  newTotalStock: number,
  reservedStock: number,
  outStock: number,
  expectedReturnStock: number,
  brokenLostStock: number
): StockValidationResult => {
  const quantiteEngagee = reservedStock + outStock + expectedReturnStock + brokenLostStock;
  const newAvailable = newTotalStock - quantiteEngagee;

  if (newTotalStock < 0) {
    return {
      isValid: false,
      newAvailable,
      quantiteEngagee,
      error: `Le stock total ne peut pas être négatif.`
    };
  }
  
  if (newAvailable < 0) {
    return {
      isValid: false,
      newAvailable,
      quantiteEngagee,
      error: `Le stock total ne peut pas être inférieur aux ${quantiteEngagee} unités actuellement réservées, sorties ou en retour.`
    };
  }

  return { isValid: true, newAvailable, quantiteEngagee };
};
