import { useRef } from 'react';
import toast from 'react-hot-toast';
import { catalogAPI } from '../../../services/catalog.api';
import { orderAPI } from '../../../services/order.api';
import { shiftAPI } from '../../../services/shift.api';
import { usePOSStore } from '../../../stores/pos.store';
import { useAuthStore } from '../../../stores/auth.store';
import { useNetworkStatus } from '../../../hooks/useNetworkStatus';
import {
  savePendingOrder,
  deductLocalStock,
} from '../../../services/offlineDB';
import { buildReceiptHtml } from '../utils/receiptTemplate';
import { printReceipt } from '../utils/receiptPrinter';
import { CartItem } from '../utils/posHelpers';

/**
 * Hook that handles the checkout flow (online + offline), customer phone lookup,
 * shift management, receipt printing, and post-checkout state reset.
 */
export const usePOSCheckout = (loadProducts: () => Promise<void>) => {
  const { user } = useAuthStore();
  const { refreshPendingCount } = useNetworkStatus();
  const customerPhoneRef = useRef('');

  // ─── Customer Phone Handler ───
  const handlePhoneChange = async (value: string) => {
    const store = usePOSStore.getState();
    store.setCustomerPhone(value);
    customerPhoneRef.current = value;
    const normalized = value.trim().replace(/[\s.-]/g, '');

    if (!normalized) {
      store.setMatchedCustomer(null);
      store.setCustomerId('');
      store.setNewCustName('');
      store.setUsedPoints(0);
      store.setIsRedeemingPoints(false);
      return;
    }

    // 1. Local search
    const localMatch = store.customers.find((c) => {
      const p = (c.phone || '').trim().replace(/[\s.-]/g, '');
      return p === normalized;
    });

    if (localMatch) {
      store.setMatchedCustomer(localMatch);
      store.setCustomerId(localMatch.id);
      store.setNewCustName('');
      store.setUsedPoints(0);
      store.setIsRedeemingPoints(false);
      return;
    }

    // 2. API search (when >= 9 digits)
    if (normalized.length >= 9) {
      try {
        const res = await catalogAPI.customers.list({ search: value, limit: 1 });

        // Race condition guard
        if (value !== customerPhoneRef.current) return;

        const matched = res.data.data.items[0];
        const dbPhone = (matched?.phone || '').trim().replace(/[\s.-]/g, '');
        if (matched && dbPhone === normalized) {
          store.addCustomer(matched);
          store.setMatchedCustomer(matched);
          store.setCustomerId(matched.id);
          store.setNewCustName('');
        } else {
          store.setMatchedCustomer(null);
          store.setCustomerId('');
        }
        store.setUsedPoints(0);
        store.setIsRedeemingPoints(false);
      } catch (err) {
        if (value !== customerPhoneRef.current) return;
        console.error('Lỗi khi tìm kiếm khách hàng bằng SĐT:', err);
        store.setMatchedCustomer(null);
        store.setCustomerId('');
      }
    } else {
      store.setMatchedCustomer(null);
      store.setCustomerId('');
    }
  };

  // ─── Shift Management ───
  const loadActiveShift = async () => {
    if (user?.role !== 'cashier') return;
    const store = usePOSStore.getState();
    store.setShiftLoading(true);
    try {
      const response = await shiftAPI.active();
      const shiftData = response.data.data;
      store.setActiveShift(shiftData);
      if (shiftData) {
        localStorage.setItem('sora_active_shift', JSON.stringify(shiftData));
      } else {
        localStorage.removeItem('sora_active_shift');
      }
    } catch {
      const cached = localStorage.getItem('sora_active_shift');
      if (cached) {
        try {
          const shiftObj = JSON.parse(cached);
          store.setActiveShift(shiftObj);
          toast.success('Đã phục hồi thông tin ca làm việc (ngoại tuyến)', { id: 'offline-shift-restore' });
        } catch {
          store.setActiveShift(null);
        }
      } else {
        store.setActiveShift(null);
      }
    } finally {
      store.setShiftLoading(false);
    }
  };

  const handleCheckInShift = async () => {
    const store = usePOSStore.getState();
    const cash = Number(store.openingCash || 0);
    if (!Number.isFinite(cash) || cash < 0) {
      toast.error('Tiền đầu ca không hợp lệ');
      return;
    }

    store.setShiftLoading(true);
    try {
      const response = await shiftAPI.checkIn(cash);
      const shiftData = response.data.data;
      store.setActiveShift(shiftData);
      localStorage.setItem('sora_active_shift', JSON.stringify(shiftData));
      toast.success('Đã nhận ca, có thể bán hàng');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Nhận ca thất bại');
    } finally {
      store.setShiftLoading(false);
    }
  };

  // ─── Clear Cart ───
  const handleClearCart = () => {
    const store = usePOSStore.getState();
    if (store.cart.length === 0) return;
    store.setShowClearCartConfirm(true);
  };

  // ─── Print Invoice ───
  const handlePrintInvoice = (orderNumber?: string, savedCart?: CartItem[]) => {
    const store = usePOSStore.getState();
    if (!orderNumber) {
      toast.error('Thanh toán xong mới có mã hóa đơn để in');
      return;
    }

    const itemsToRender = savedCart || store.cart;
    if (itemsToRender.length === 0) {
      toast.error('Không có dữ liệu sản phẩm để in hóa đơn!');
      return;
    }

    const checkoutInfo = store.checkoutSuccessInfo;
    const customerName = checkoutInfo?.customerName ??
      (store.customers.find((c) => c.id === store.customerId)?.name || 'Khách lẻ');
    const customerPhoneStr = checkoutInfo?.customerPhone ??
      (store.customerPhone || store.customers.find((c) => c.id === store.customerId)?.phone || '');

    const printTotal = itemsToRender.reduce(
      (s, i) => s + Number(i.product.sell_price) * i.quantity,
      0
    );
    const printFinal = checkoutInfo?.finalAmount ?? _computeFinalAmount(store);
    const printDiscount = printTotal - printFinal > 0 ? printTotal - printFinal : 0;
    const printPaymentMethod = checkoutInfo?.paymentMethod ?? store.paymentMethod;
    const printChange = checkoutInfo?.change ??
      Math.max((store.receivedAmount || printFinal) - printFinal, 0);

    const htmlContent = buildReceiptHtml(
      {
        orderNumber,
        cart: itemsToRender,
        total: printTotal,
        finalAmount: printFinal,
        discountAmount: printDiscount,
        change: printChange,
        paymentMethod: printPaymentMethod,
        receivedAmount:
          store.paymentMethod === 'cash'
            ? store.receivedAmount || printFinal
            : printFinal,
        customerName,
        customerPhone: customerPhoneStr,
        cashierName: user?.full_name || 'Nhân viên',
        date: checkoutInfo?.date || new Date().toLocaleString('vi-VN'),
        pointsBefore: checkoutInfo?.pointsBefore ?? 0,
        pointsUsed: checkoutInfo?.pointsUsed ?? 0,
        pointsEarned: checkoutInfo?.pointsEarned ?? 0,
        pointsAfter: checkoutInfo?.pointsAfter ?? 0,
      },
      store.operationSettings
    );

    printReceipt(htmlContent);
  };

  // ─── Checkout ───
  const checkout = async (isTransferConfirmed = false, isCheckoutConfirmed = false) => {
    const store = usePOSStore.getState();
    const {
      cart,
      matchedCustomer,
      activeShift,
      operationSettings,
      customerPhone,
      newCustName,
      paymentMethod,
      receivedAmount,
      discountType,
      discountValue,
      isRedeemingPoints,
      usedPoints,
    } = store;

    if (cart.length === 0) {
      toast.error('Giỏ hàng đang trống');
      return;
    }
    if (user?.role === 'cashier' && activeShift?.status !== 'checked_in') {
      toast.error('Vui lòng nhận ca và nhập tiền đầu ca trước khi bán hàng');
      return;
    }
    if (operationSettings.requireCustomerPhone && !customerPhone.trim()) {
      toast.error('Vui lòng nhập số điện thoại khách hàng');
      return;
    }

    const total = cart.reduce((sum, item) => sum + Number(item.product.sell_price) * item.quantity, 0);
    const discountAmount = _computeDiscountAmount(store);
    const pointsDiscount = isRedeemingPoints ? usedPoints * 1000 : 0;
    const finalAmount = Math.max(total - discountAmount - pointsDiscount, 0);

    const hasPoints = matchedCustomer && matchedCustomer.points > 0;
    const needConfirm = operationSettings.confirmBeforeCheckout || hasPoints;
    if (needConfirm && !isCheckoutConfirmed) {
      store.setShowCheckoutConfirm(true);
      return;
    }

    if (paymentMethod === 'cash' && receivedAmount > 0 && receivedAmount < finalAmount) {
      toast.error('Tiền khách đưa chưa đủ để thanh toán');
      return;
    }

    if (paymentMethod === 'transfer' && !isTransferConfirmed) {
      const datePart = new Date()
        .toLocaleDateString('vi-VN', { month: '2-digit', day: '2-digit' })
        .replace(/\//g, '');
      const timePart = new Date()
        .toLocaleTimeString('vi-VN', { hour12: false })
        .replace(/:/g, '')
        .slice(0, 4);
      store.setTransferMemo(`SORA${datePart}${timePart}`);
      store.setShowTransferPayment(true);
      return;
    }

    store.setLoading(true);

    // Calculate exact manual discount for the backend
    const maxPercent = operationSettings.maxDiscountPercent ?? 100;
    const maxDiscountValue = Math.floor((total * maxPercent) / 100);
    const manualDiscount =
      discountType === 'percent'
        ? Math.floor((total * Math.min(discountValue, maxPercent)) / 100)
        : Math.min(discountValue, maxDiscountValue);

    // Build order payload
    const orderPayload = {
      customer_id: matchedCustomer?.id || null,
      shift_code: activeShift?.shift_code || undefined,
      discount_amount: discountAmount + pointsDiscount,
      manual_discount_amount: manualDiscount,
      used_points: isRedeemingPoints ? usedPoints : 0,
      note: null as string | null,
      payment: {
        method: paymentMethod,
        received_amount: paymentMethod === 'cash' ? (receivedAmount || finalAmount) : finalAmount,
      },
      items: cart.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity,
      })),
    };

    // ═══ OFFLINE MODE ═══
    if (!navigator.onLine) {
      try {
        const pending = await savePendingOrder(orderPayload, finalAmount, paymentMethod);

        for (const item of cart) {
          await deductLocalStock(item.product.id, item.quantity);
        }

        const customerObj = matchedCustomer ||
          (customerPhone ? { name: newCustName || 'Khách lẻ', phone: customerPhone } : null);

        store.setCheckoutSuccessInfo({
          orderNumber: pending.offlineOrderNumber,
          finalAmount,
          total,
          discountAmount: discountAmount + pointsDiscount,
          change: paymentMethod === 'cash' ? Math.max((receivedAmount || finalAmount) - finalAmount, 0) : 0,
          paymentMethod,
          receivedAmount: paymentMethod === 'cash' ? (receivedAmount || finalAmount) : finalAmount,
          cart: [...cart],
          customerName: customerObj?.name || 'Khách lẻ',
          customerPhone: customerPhone || '',
          cashierName: user?.full_name || 'Nhân viên',
          date: new Date().toLocaleString('vi-VN'),
        });

        store.resetCheckout();
        await loadProducts();
        await refreshPendingCount();
        toast.success(
          `Đã lưu đơn hàng ngoại tuyến ${pending.offlineOrderNumber} — sẽ đồng bộ khi có mạng`,
          { duration: 5000 }
        );
      } catch (err) {
        console.error('[POS Offline] Lỗi lưu đơn hàng offline:', err);
        toast.error('Không thể lưu đơn hàng ngoại tuyến');
      } finally {
        store.setLoading(false);
      }
      return;
    }

    // ═══ ONLINE MODE ═══
    try {
      let finalCustomerId = matchedCustomer?.id || null;

      // Auto-create new customer
      if (customerPhone.trim() && !matchedCustomer) {
        if (!newCustName.trim()) {
          toast.error('Vui lòng nhập Họ và tên khách hàng mới để đăng ký tích điểm');
          store.setLoading(false);
          return;
        }
        try {
          const custRes = await catalogAPI.customers.create({
            name: newCustName.trim(),
            phone: customerPhone.trim(),
            is_active: true,
          });
          const newCust = custRes.data.data;
          store.addCustomer(newCust);
          store.setMatchedCustomer(newCust);
          finalCustomerId = newCust.id;
          toast.success(`Đã tự động tạo tài khoản tích điểm cho khách hàng ${newCust.name}`);
        } catch (err) {
          console.error(err);
          toast.error('Không thể tạo tài khoản khách hàng mới');
          store.setLoading(false);
          return;
        }
      }

      orderPayload.customer_id = finalCustomerId;

      const response = await orderAPI.create(orderPayload);
      const orderId = response.data.data.id;
      const orderNumber = response.data.data.order_number;

      const customerObj = finalCustomerId
        ? store.customers.find((c) => c.id === finalCustomerId) || { name: newCustName, phone: customerPhone, email: '' }
        : null;

      const pBefore = matchedCustomer ? matchedCustomer.points : 0;
      const pUsed = isRedeemingPoints ? usedPoints : 0;
      const pEarned = Math.floor(finalAmount / 10000);
      const pAfter = Math.max(0, pBefore - pUsed + pEarned);

      store.setCustomerEmail((customerObj as any)?.email || '');

      store.setCheckoutSuccessInfo({
        orderId,
        orderNumber,
        finalAmount,
        total,
        discountAmount: discountAmount + pointsDiscount,
        change: paymentMethod === 'cash' ? Math.max((receivedAmount || finalAmount) - finalAmount, 0) : 0,
        paymentMethod,
        receivedAmount: paymentMethod === 'cash' ? (receivedAmount || finalAmount) : finalAmount,
        cart: [...cart],
        customerName: (customerObj as any)?.name || 'Khách lẻ',
        customerPhone: customerPhone || (customerObj as any)?.phone || '',
        cashierName: user?.full_name || 'Nhân viên',
        date: new Date().toLocaleString('vi-VN'),
        pointsBefore: pBefore,
        pointsUsed: pUsed,
        pointsEarned: pEarned,
        pointsAfter: pAfter,
      });

      store.resetCheckout();
      await loadProducts();
      await loadActiveShift();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Thanh toán thất bại');
    } finally {
      store.setLoading(false);
    }
  };

  return {
    checkout,
    handlePhoneChange,
    handleClearCart,
    handlePrintInvoice,
    handleCheckInShift,
    loadActiveShift,
  };
};

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

function _computeDiscountAmount(s: ReturnType<typeof usePOSStore.getState>) {
  const total = s.cart.reduce((sum, item) => sum + Number(item.product.sell_price) * item.quantity, 0);
  const maxPercent = s.operationSettings.maxDiscountPercent ?? 100;
  const maxDiscountValue = Math.floor((total * maxPercent) / 100);
  const safeValue =
    s.discountType === 'percent'
      ? Math.min(s.discountValue, maxPercent)
      : Math.min(s.discountValue, maxDiscountValue);
  const manualDiscount = s.discountType === 'percent' ? Math.floor((total * safeValue) / 100) : safeValue;
  return manualDiscount + (s.autoPromoDiscount || 0) + (s.voucherDiscount || 0);
}

function _computeFinalAmount(s: ReturnType<typeof usePOSStore.getState>) {
  const total = s.cart.reduce((sum, item) => sum + Number(item.product.sell_price) * item.quantity, 0);
  const discount = _computeDiscountAmount(s);
  const pointsDiscount = s.isRedeemingPoints ? s.usedPoints * 1000 : 0;
  return Math.max(total - discount - pointsDiscount, 0);
}
