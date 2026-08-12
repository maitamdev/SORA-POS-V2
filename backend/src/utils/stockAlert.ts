export type StockAlertStatus = 'low_stock' | 'out_of_stock' | null;

export const getStockAlertStatus = (stockQuantity: number, minStockLevel: number): StockAlertStatus => {
  const stock = Number(stockQuantity);
  const minimum = Number(minStockLevel);

  if (stock <= 0) return 'out_of_stock';
  if (stock <= minimum) return 'low_stock';
  return null;
};
