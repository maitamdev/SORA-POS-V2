import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { Category, Customer, Product, ShiftSession } from '../types/domain.type';
import { defaultOperationSettings, OperationSettings } from '../services/settings.api';
import { CartItem, CheckoutSuccessInfo } from '../pages/pos/utils/posHelpers';

/* ------------------------------------------------------------------ */
/*  State Interface                                                    */
/* ------------------------------------------------------------------ */

interface POSState {
  // Products
  products: Product[];
  categories: Category[];
  customers: Customer[];
  search: string;
  barcodeSearch: string;
  selectedCategoryId: string;
  sortBy: string;
  viewMode: 'grid' | 'list';
  page: number;
  pagination: { page: number; limit: number; total: number };

  // Cart
  cart: CartItem[];
  discountType: 'percent' | 'value';
  discountValue: number;
  voucherCode: string;
  autoPromoDiscount: number;
  voucherDiscount: number;

  // Customer
  customerId: string;
  customerPhone: string;
  matchedCustomer: Customer | null;
  newCustName: string;
  usedPoints: number;
  isRedeemingPoints: boolean;

  // Payment
  paymentMethod: 'cash' | 'transfer' | 'card';
  receivedAmount: number;
  transferMemo: string;

  // UI modals
  showCashPayment: boolean;
  showTransferPayment: boolean;
  showCheckoutConfirm: boolean;
  showClearCartConfirm: boolean;
  showPairingModal: boolean;

  // Checkout result
  checkoutSuccessInfo: CheckoutSuccessInfo | null;
  customerEmail: string;
  isSendingEmail: boolean;
  loading: boolean;

  // Settings & shift
  operationSettings: OperationSettings;
  activeShift: ShiftSession | null;
  shiftLoading: boolean;
  openingCash: string;
  logoError: boolean;

  // Actions — Products
  setProducts: (products: Product[]) => void;
  setCategories: (categories: Category[]) => void;
  setCustomers: (customers: Customer[]) => void;
  addCustomer: (customer: Customer) => void;
  setSearch: (search: string) => void;
  setBarcodeSearch: (search: string) => void;
  setSelectedCategoryId: (id: string) => void;
  setSortBy: (sortBy: string) => void;
  setViewMode: (mode: 'grid' | 'list') => void;
  setPage: (page: number | ((prev: number) => number)) => void;
  setPagination: (pagination: { page: number; limit: number; total: number }) => void;

  // Actions — Cart
  addToCart: (product: Product) => void;
  updateQty: (productId: string, quantity: number) => void;
  clearCart: () => void;
  setDiscountType: (type: 'percent' | 'value') => void;
  setDiscountValue: (value: number) => void;
  setVoucherCode: (code: string) => void;
  setAutoPromoDiscount: (value: number) => void;
  setVoucherDiscount: (value: number) => void;

  // Actions — Customer
  setCustomerId: (id: string) => void;
  setCustomerPhone: (phone: string) => void;
  setMatchedCustomer: (customer: Customer | null) => void;
  setNewCustName: (name: string) => void;
  setUsedPoints: (points: number) => void;
  setIsRedeemingPoints: (value: boolean) => void;

  // Actions — Payment
  setPaymentMethod: (method: 'cash' | 'transfer' | 'card') => void;
  setReceivedAmount: (amount: number | ((prev: number) => number)) => void;
  setTransferMemo: (memo: string) => void;

  // Actions — Modals
  setShowCashPayment: (show: boolean) => void;
  setShowTransferPayment: (show: boolean) => void;
  setShowCheckoutConfirm: (show: boolean) => void;
  setShowClearCartConfirm: (show: boolean) => void;
  setShowPairingModal: (show: boolean) => void;

  // Actions — Checkout
  setCheckoutSuccessInfo: (info: CheckoutSuccessInfo | null) => void;
  setCustomerEmail: (email: string) => void;
  setIsSendingEmail: (sending: boolean) => void;
  setLoading: (loading: boolean) => void;

  // Actions — Settings & Shift
  setOperationSettings: (settings: OperationSettings) => void;
  setActiveShift: (shift: ShiftSession | null) => void;
  setShiftLoading: (loading: boolean) => void;
  setOpeningCash: (cash: string) => void;
  setLogoError: (error: boolean) => void;

  // Actions — Reset
  resetCheckout: () => void;
}

/* ------------------------------------------------------------------ */
/*  Store                                                              */
/* ------------------------------------------------------------------ */

export const usePOSStore = create<POSState>()((set, get) => ({
  // Products
  products: [],
  categories: [],
  customers: [],
  search: '',
  barcodeSearch: '',
  selectedCategoryId: 'all',
  sortBy: 'default',
  viewMode: 'grid',
  page: 1,
  pagination: { page: 1, limit: defaultOperationSettings.productPageSize, total: 0 },

  // Cart
  cart: [],
  discountType: 'value',
  discountValue: 0,
  voucherCode: '',
  autoPromoDiscount: 0,
  voucherDiscount: 0,

  // Customer
  customerId: '',
  customerPhone: '',
  matchedCustomer: null,
  newCustName: '',
  usedPoints: 0,
  isRedeemingPoints: false,

  // Payment
  paymentMethod: 'cash',
  receivedAmount: 0,
  transferMemo: '',

  // UI modals
  showCashPayment: false,
  showTransferPayment: false,
  showCheckoutConfirm: false,
  showClearCartConfirm: false,
  showPairingModal: false,

  // Checkout result
  checkoutSuccessInfo: null,
  customerEmail: '',
  isSendingEmail: false,
  loading: false,

  // Settings & shift
  operationSettings: defaultOperationSettings,
  activeShift: null,
  shiftLoading: false,
  openingCash: '',
  logoError: false,

  // ── Actions — Products ──
  setProducts: (products) => set({ products }),
  setCategories: (categories) => set({ categories }),
  setCustomers: (customers) => set({ customers }),
  addCustomer: (customer) =>
    set((s) => ({
      customers: s.customers.some((c) => c.id === customer.id)
        ? s.customers
        : [customer, ...s.customers],
    })),
  setSearch: (search) => set({ search }),
  setBarcodeSearch: (barcodeSearch) => set({ barcodeSearch }),
  setSelectedCategoryId: (id) => set({ selectedCategoryId: id }),
  setSortBy: (sortBy) => set({ sortBy }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setPage: (page) =>
    set((s) => ({
      page: typeof page === 'function' ? page(s.page) : page,
    })),
  setPagination: (pagination) => set({ pagination }),

  // ── Actions — Cart ──
  addToCart: (product) => {
    const { operationSettings } = get();
    const allowOutOfStock = operationSettings.allowSellOutOfStock ?? false;

    if (!allowOutOfStock && Number(product.stock_quantity) <= 0) {
      // Caller should handle toast
      return;
    }

    set((s) => {
      const existing = s.cart.find((item) => item.product.id === product.id);
      if (existing) {
        if (!allowOutOfStock && existing.quantity >= Number(product.stock_quantity)) {
          return s; // Caller should handle toast
        }
        return {
          cart: s.cart.map((item) =>
            item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
          ),
        };
      }
      return { cart: [...s.cart, { product, quantity: 1 }] };
    });
  },

  updateQty: (productId, quantity) => {
    const { operationSettings } = get();
    const allowOutOfStock = operationSettings.allowSellOutOfStock ?? false;

    set((s) => ({
      cart: s.cart
        .map((item) => {
          if (item.product.id !== productId) return item;
          const maxQuantity = allowOutOfStock
            ? quantity
            : Math.min(quantity, Number(item.product.stock_quantity));
          const nextQuantity = Math.max(0, maxQuantity);
          return { ...item, quantity: nextQuantity };
        })
        .filter((item) => item.quantity > 0),
    }));
  },

  clearCart: () =>
    set({
      cart: [],
      discountValue: 0,
      voucherCode: '',
      autoPromoDiscount: 0,
      voucherDiscount: 0,
      receivedAmount: 0,
      showCashPayment: false,
      showClearCartConfirm: false,
    }),

  setDiscountType: (type) => set({ discountType: type }),
  setDiscountValue: (value) => set({ discountValue: value }),
  setVoucherCode: (code) => set({ voucherCode: code }),
  setAutoPromoDiscount: (value) => set({ autoPromoDiscount: value }),
  setVoucherDiscount: (value) => set({ voucherDiscount: value }),

  // ── Actions — Customer ──
  setCustomerId: (id) => set({ customerId: id }),
  setCustomerPhone: (phone) => set({ customerPhone: phone }),
  setMatchedCustomer: (customer) => set({ matchedCustomer: customer }),
  setNewCustName: (name) => set({ newCustName: name }),
  setUsedPoints: (points) => set({ usedPoints: points }),
  setIsRedeemingPoints: (value) => set({ isRedeemingPoints: value }),

  // ── Actions — Payment ──
  setPaymentMethod: (method) => set({ paymentMethod: method }),
  setReceivedAmount: (amount) =>
    set((s) => ({
      receivedAmount: typeof amount === 'function' ? amount(s.receivedAmount) : amount,
    })),
  setTransferMemo: (memo) => set({ transferMemo: memo }),

  // ── Actions — Modals ──
  setShowCashPayment: (show) => set({ showCashPayment: show }),
  setShowTransferPayment: (show) => set({ showTransferPayment: show }),
  setShowCheckoutConfirm: (show) => set({ showCheckoutConfirm: show }),
  setShowClearCartConfirm: (show) => set({ showClearCartConfirm: show }),
  setShowPairingModal: (show) => set({ showPairingModal: show }),

  // ── Actions — Checkout ──
  setCheckoutSuccessInfo: (info) => set({ checkoutSuccessInfo: info }),
  setCustomerEmail: (email) => set({ customerEmail: email }),
  setIsSendingEmail: (sending) => set({ isSendingEmail: sending }),
  setLoading: (loading) => set({ loading }),

  // ── Actions — Settings & Shift ──
  setOperationSettings: (settings) => set({ operationSettings: settings }),
  setActiveShift: (shift) => set({ activeShift: shift }),
  setShiftLoading: (loading) => set({ shiftLoading: loading }),
  setOpeningCash: (cash) => set({ openingCash: cash }),
  setLogoError: (error) => set({ logoError: error }),

  // ── Actions — Reset ──
  resetCheckout: () =>
    set({
      cart: [],
      receivedAmount: 0,
      showCashPayment: false,
      showTransferPayment: false,
      discountValue: 0,
      voucherCode: '',
      autoPromoDiscount: 0,
      voucherDiscount: 0,
      customerPhone: '',
      matchedCustomer: null,
      newCustName: '',
      usedPoints: 0,
      isRedeemingPoints: false,
      showCheckoutConfirm: false,
    }),
}));

/* ------------------------------------------------------------------ */
/*  Shared computation helper (eliminates duplicate calculations)       */
/* ------------------------------------------------------------------ */

function computePOS(s: POSState) {
  const total = s.cart.reduce((sum, item) => sum + Number(item.product.sell_price) * item.quantity, 0);
  const maxPercent = s.operationSettings.maxDiscountPercent ?? 100;
  const safeValue =
    s.discountType === 'percent'
      ? Math.min(s.discountValue, maxPercent)
      : s.discountValue;
  const manualDiscount = s.discountType === 'percent' ? Math.floor((total * safeValue) / 100) : safeValue;
  
  // Total discount is the sum of manual discount + auto-matched promotions + voucher discount
  const discount = manualDiscount + (s.autoPromoDiscount || 0) + (s.voucherDiscount || 0);
  
  const pointsDiscount = s.isRedeemingPoints ? s.usedPoints * 1000 : 0;
  const finalAmount = Math.max(total - discount - pointsDiscount, 0);
  return { total, discount, pointsDiscount, finalAmount };
}

/* ------------------------------------------------------------------ */
/*  Derived Selectors (hook-based for re-render isolation)             */
/* ------------------------------------------------------------------ */

export const usePOSTotal = () =>
  usePOSStore((s) => computePOS(s).total);

export const usePOSDiscountAmount = () =>
  usePOSStore((s) => computePOS(s).discount);

export const usePOSPointsDiscount = () =>
  usePOSStore((s) => computePOS(s).pointsDiscount);

export const usePOSFinalAmount = () =>
  usePOSStore((s) => computePOS(s).finalAmount);

export const usePOSChangeAmount = () =>
  usePOSStore((s) => {
    if (s.paymentMethod !== 'cash') return 0;
    return Math.max(s.receivedAmount - computePOS(s).finalAmount, 0);
  });

export const usePOSCashSuggestions = () =>
  usePOSStore(
    useShallow((s) => {
      const { finalAmount } = computePOS(s);
      const rounded10k = Math.ceil(finalAmount / 10000) * 10000;
      const rounded50k = Math.ceil(finalAmount / 50000) * 50000;
      const rounded100k = Math.ceil(finalAmount / 100000) * 100000;
      return Array.from(
        new Set([finalAmount, rounded10k, rounded50k, rounded100k].filter((a) => a > 0))
      );
    })
  );

export const usePOSSortedProducts = () =>
  usePOSStore(
    useShallow((s) => {
      const items = [...s.products];
      if (s.sortBy === 'price-asc') {
        items.sort((a, b) => Number(a.sell_price) - Number(b.sell_price));
      } else if (s.sortBy === 'price-desc') {
        items.sort((a, b) => Number(b.sell_price) - Number(a.sell_price));
      } else if (s.sortBy === 'name-asc') {
        items.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
      } else if (s.sortBy === 'name-desc') {
        items.sort((a, b) => b.name.localeCompare(a.name, 'vi'));
      }
      return items;
    })
  );

