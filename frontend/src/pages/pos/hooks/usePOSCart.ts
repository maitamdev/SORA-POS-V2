import { useState, useMemo, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Product, Customer } from '../../../types/domain.type';
import { OperationSettings } from '../../../services/settings.api';

export interface CartItem {
  product: Product;
  quantity: number;
}

export const usePOSCart = (operationSettings: OperationSettings) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountType, setDiscountType] = useState<'percent' | 'value'>('value');
  const [discountValue, setDiscountValue] = useState(0);
  const [voucherCode, setVoucherCode] = useState('');
  const [usedPoints, setUsedPoints] = useState(0);
  const [isRedeemingPoints, setIsRedeemingPoints] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'card'>('cash');
  const [receivedAmount, setReceivedAmount] = useState(0);
  const [matchedCustomer, setMatchedCustomer] = useState<Customer | null>(null);

  // Core Math Calculations
  const total = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.product.sell_price) * item.quantity, 0),
    [cart]
  );

  const discountAmount = useMemo(() => {
    const maxPercent = operationSettings.maxDiscountPercent ?? 100;
    const safeDiscountValue =
      discountType === 'percent'
        ? Math.min(discountValue, maxPercent)
        : discountValue;
    if (discountType === 'percent') {
      return Math.floor((total * safeDiscountValue) / 100);
    }
    return safeDiscountValue;
  }, [total, discountType, discountValue, operationSettings.maxDiscountPercent]);

  const pointsDiscount = useMemo(() => {
    return isRedeemingPoints ? usedPoints * 1000 : 0;
  }, [isRedeemingPoints, usedPoints]);

  const finalAmount = useMemo(() => Math.max(total - discountAmount - pointsDiscount, 0), [total, discountAmount, pointsDiscount]);

  const changeAmount = useMemo(() => {
    if (paymentMethod !== 'cash') return 0;
    return Math.max(receivedAmount - finalAmount, 0);
  }, [receivedAmount, finalAmount, paymentMethod]);

  const cashSuggestions = useMemo(() => {
    const rounded10k = Math.ceil(finalAmount / 10000) * 10000;
    const rounded50k = Math.ceil(finalAmount / 50000) * 50000;
    const rounded100k = Math.ceil(finalAmount / 100000) * 100000;

    return Array.from(
      new Set([finalAmount, rounded10k, rounded50k, rounded100k].filter((amount) => amount > 0))
    );
  }, [finalAmount]);

  // Sync default payment method from settings
  useEffect(() => {
    if (operationSettings.defaultPaymentMethod) {
      setPaymentMethod(operationSettings.defaultPaymentMethod as 'cash' | 'transfer' | 'card');
    }
  }, [operationSettings.defaultPaymentMethod]);

  // Sync receivedAmount for card/transfer payment
  useEffect(() => {
    if (paymentMethod !== 'cash') {
      setReceivedAmount(finalAmount);
    }
  }, [finalAmount, paymentMethod]);

  // Cart operations
  const addToCart = (product: Product) => {
    const allowOutOfStock = operationSettings.allowSellOutOfStock ?? false;
    const lowStockWarning = operationSettings.lowStockWarning ?? true;

    if (!allowOutOfStock && Number(product.stock_quantity) <= 0) {
      toast.error('Sản phẩm đã hết hàng');
      return;
    }

    if (
      lowStockWarning &&
      Number(product.stock_quantity) > 0 &&
      Number(product.stock_quantity) <= Number(product.min_stock_level)
    ) {
      toast.error('Sản phẩm đang tồn thấp, cần kiểm tra kho');
    }

    setCart((items) => {
      const existing = items.find((item) => item.product.id === product.id);
      if (existing) {
        if (!allowOutOfStock && existing.quantity >= Number(product.stock_quantity)) {
          toast.error('Không đủ tồn kho');
          return items;
        }
        return items.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...items, { product, quantity: 1 }];
    });
  };

  const updateQty = (productId: string, quantity: number) => {
    const allowOutOfStock = operationSettings.allowSellOutOfStock ?? false;
    
    setCart((items) =>
      items
        .map((item) => {
          if (item.product.id !== productId) return item;
          const maxQuantity = allowOutOfStock
            ? quantity
            : Math.min(quantity, Number(item.product.stock_quantity));
          const nextQuantity = Math.max(0, maxQuantity);
          return { ...item, quantity: nextQuantity };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const clearCart = () => {
    setCart([]);
    setDiscountValue(0);
    setVoucherCode('');
    setUsedPoints(0);
    setIsRedeemingPoints(false);
    setReceivedAmount(0);
  };

  return {
    cart,
    setCart,
    discountType,
    setDiscountType,
    discountValue,
    setDiscountValue,
    discountAmount,
    pointsDiscount,
    voucherCode,
    setVoucherCode,
    usedPoints,
    setUsedPoints,
    isRedeemingPoints,
    setIsRedeemingPoints,
    paymentMethod,
    setPaymentMethod,
    receivedAmount,
    setReceivedAmount,
    matchedCustomer,
    setMatchedCustomer,
    total,
    finalAmount,
    changeAmount,
    cashSuggestions,
    addToCart,
    updateQty,
    clearCart,
  };
};
