import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  HiOutlineShoppingCart,
  HiOutlineTrash,
  HiOutlinePhone,
  HiOutlineTag,
  HiOutlineCheck,
  HiOutlineX,
} from 'react-icons/hi';
import { FiLoader, FiGift, FiPercent, FiDollarSign, FiPackage } from 'react-icons/fi';
import { usePOSStore, usePOSFinalAmount, usePOSTotal } from '../../../stores/pos.store';
import { money, getProductImage } from '../utils/posHelpers';
import type { CartItem } from '../utils/posHelpers';
import { promotionAPI } from '../../../services/promotion.api';

interface AutoPromoResult {
  promotion: {
    id: string;
    name: string;
    discount_type: string;
    discount_value: number;
    apply_to?: string;
    apply_to_ids?: string[];
    bundle_product_ids?: string[];
    get_product_ids?: string[];
    buy_quantity?: number;
    get_quantity?: number;
    combo_quantity?: number;
  };
  discount_amount: number;
  applicable_product_ids?: string[];
  description?: string;
}

const PromoTypeIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'percent': return <FiPercent className="w-3.5 h-3.5" />;
    case 'fixed_amount': return <FiDollarSign className="w-3.5 h-3.5" />;
    case 'buy_x_get_y': return <FiGift className="w-3.5 h-3.5" />;
    case 'fixed_price': return <FiPackage className="w-3.5 h-3.5" />;
    default: return <FiGift className="w-3.5 h-3.5" />;
  }
};

const getAutoPromotionProductLabel = (promo: AutoPromoResult, cart: CartItem[]) => {
  const bundleIds = promo.promotion.discount_type === 'bundle'
    ? promo.promotion.bundle_product_ids || []
    : [];
  const scopedIds = bundleIds.length > 0
    ? bundleIds
    : promo.applicable_product_ids && promo.applicable_product_ids.length > 0
      ? promo.applicable_product_ids
      : promo.promotion.apply_to === 'product'
        ? promo.promotion.apply_to_ids || []
        : promo.promotion.apply_to === 'category'
          ? cart
            .filter((item) => item.product.category_id && (promo.promotion.apply_to_ids || []).includes(item.product.category_id))
            .map((item) => item.product.id)
          : cart.map((item) => item.product.id);

  const names = Array.from(new Set(
    cart
      .filter((item) => scopedIds.includes(item.product.id))
      .map((item) => item.product.name)
      .filter(Boolean)
  ));

  if (names.length > 0) {
    const visibleNames = names.slice(0, 2);
    const remaining = names.length - visibleNames.length;
    return `${visibleNames.join(', ')}${remaining > 0 ? ` + ${remaining} SP khác` : ''}`;
  }

  if (promo.promotion.apply_to === 'all') return 'Toàn bộ sản phẩm trong đơn';
  if (promo.promotion.apply_to === 'category') return 'Sản phẩm thuộc danh mục đã chọn';
  if (promo.promotion.apply_to === 'product') return 'Sản phẩm đã chọn';
  return 'Sản phẩm trong chương trình';
};

interface CartPanelProps {
  onClearCart: () => void;
  onPhoneChange: (value: string) => void;
}

const CartPanel = ({ onClearCart, onPhoneChange }: CartPanelProps) => {
  const cart = usePOSStore((s) => s.cart);
  const customerPhone = usePOSStore((s) => s.customerPhone);
  const matchedCustomer = usePOSStore((s) => s.matchedCustomer);
  const newCustName = usePOSStore((s) => s.newCustName);
  const discountType = usePOSStore((s) => s.discountType);
  const discountValue = usePOSStore((s) => s.discountValue);
  const voucherCode = usePOSStore((s) => s.voucherCode);
  const operationSettings = usePOSStore((s) => s.operationSettings);

  const updateQty = usePOSStore((s) => s.updateQty);
  const setDiscountType = usePOSStore((s) => s.setDiscountType);
  const setDiscountValue = usePOSStore((s) => s.setDiscountValue);
  const setVoucherCode = usePOSStore((s) => s.setVoucherCode);
  const setNewCustName = usePOSStore((s) => s.setNewCustName);
  const setAutoPromoDiscount = usePOSStore((s) => s.setAutoPromoDiscount);
  const setVoucherDiscount = usePOSStore((s) => s.setVoucherDiscount);
  const setAutoPromotionIds = usePOSStore((s) => s.setAutoPromotionIds);
  const setVoucherPromotionId = usePOSStore((s) => s.setVoucherPromotionId);

  const finalAmount = usePOSFinalAmount();
  const total = usePOSTotal();

  // ══════════════════════════════════════════════
  // AUTO PROMOTIONS — detect when cart changes
  // ══════════════════════════════════════════════
  const [autoPromos, setAutoPromos] = useState<AutoPromoResult[]>([]);
  const [autoPromoLoading, setAutoPromoLoading] = useState(false);

  // Build cart fingerprint for debounced detection
  const cartFingerprint = useMemo(() => {
    return cart.map(i => `${i.product.id}:${i.quantity}`).sort().join('|');
  }, [cart]);

  useEffect(() => {
    if (cart.length === 0) {
      setAutoPromos([]);
      setAutoPromoDiscount(0);
      setAutoPromotionIds([]);
      return;
    }

    setAutoPromotionIds([]);

    const timer = setTimeout(async () => {
      const items = cart.map((item) => ({
        product_id: item.product.id,
        category_id: item.product.category_id || undefined,
        quantity: item.quantity,
        unit_price: Number(item.product.sell_price),
      }));

      setAutoPromoLoading(true);
      try {
        const res = await promotionAPI.getAutoPromotions({ order_total: total, items });
        const data = res.data.data;
        const arr = Array.isArray(data) ? data : [];
        setAutoPromos(arr);
        const sum = arr.reduce((acc, p) => acc + p.discount_amount, 0);
        setAutoPromoDiscount(sum);
        setAutoPromotionIds(
          Array.from(new Set(
            arr
              .filter((promo) => Number(promo.discount_amount) > 0)
              .map((promo) => promo.promotion.id)
              .filter(Boolean)
          ))
        );
      } catch {
        setAutoPromos([]);
        setAutoPromoDiscount(0);
        setAutoPromotionIds([]);
      } finally {
        setAutoPromoLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [cartFingerprint, total, setAutoPromoDiscount, setAutoPromotionIds]);

  const totalAutoDiscount = useMemo(
    () => autoPromos.reduce((sum, p) => sum + p.discount_amount, 0),
    [autoPromos]
  );

  // ══════════════════════════════════════════════
  // VOUCHER CODE validation (manual entry)
  // ══════════════════════════════════════════════
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherResult, setVoucherResult] = useState<{
    valid: boolean;
    promoName: string;
    discountAmount: number;
    description: string;
  } | null>(null);
  const [voucherError, setVoucherError] = useState('');

  const validateVoucher = useCallback(async (code: string) => {
    if (!code.trim()) {
      setVoucherResult(null);
      setVoucherDiscount(0);
      setVoucherPromotionId(null);
      setVoucherError('');
      return;
    }

    const items = cart.map((item) => ({
      product_id: item.product.id,
      category_id: item.product.category_id || undefined,
      quantity: item.quantity,
      unit_price: Number(item.product.sell_price),
    }));

    setVoucherLoading(true);
    setVoucherError('');
    try {
      const res = await promotionAPI.validate({
        code: code.trim(),
        order_total: total,
        items,
      });
      const disc = res.data.data.discount_amount;
      setVoucherResult({
        valid: true,
        promoName: res.data.data.promotion.name,
        discountAmount: disc,
        description: (res.data.data as any).description || '',
      });
      setVoucherDiscount(disc);
      setVoucherPromotionId(res.data.data.promotion.id);
    } catch (err: any) {
      setVoucherResult(null);
      setVoucherDiscount(0);
      setVoucherPromotionId(null);
      setVoucherError(err.response?.data?.message || 'Mã không hợp lệ');
    } finally {
      setVoucherLoading(false);
    }
  }, [cart, total, setVoucherDiscount, setVoucherPromotionId]);

  // Debounce voucher validation
  useEffect(() => {
    const timer = setTimeout(() => {
      if (voucherCode.trim().length >= 3) {
        validateVoucher(voucherCode);
      } else {
        setVoucherResult(null);
        setVoucherDiscount(0);
        setVoucherPromotionId(null);
        setVoucherError('');
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [voucherCode, total, cartFingerprint, validateVoucher, setVoucherDiscount, setVoucherPromotionId]);

  useEffect(() => {
    if (cart.length === 0) {
      setVoucherResult(null);
      setVoucherDiscount(0);
      setVoucherPromotionId(null);
      setVoucherError('');
    }
  }, [cart.length, setVoucherDiscount, setVoucherPromotionId]);

  return (
    <>
      {/* Cart Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
        <h2 className="text-base font-black text-slate-800 flex items-center gap-2 uppercase">
          <HiOutlineShoppingCart className="w-7 h-7 text-blue-600" />
          <span>Giỏ hàng ({cart.reduce((s, i) => s + i.quantity, 0)})</span>
        </h2>
        {cart.length > 0 && (
          <button
            onClick={onClearCart}
            className="flex items-center gap-1 text-[11px] font-bold text-red-500 hover:text-red-700 transition"
          >
            <HiOutlineTrash className="w-4 h-4" />
            <span>Xóa giỏ hàng</span>
          </button>
        )}
      </div>

      {/* Scrollable Cart Items + Customer Panel */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-slate-50/20 divide-y divide-slate-100">
        {/* Cart Items */}
        <div className="p-4 divide-y divide-slate-100 bg-white">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center text-slate-400 py-10">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                <HiOutlineShoppingCart className="w-6 h-6" />
              </div>
              <p className="text-xs font-black text-slate-500 uppercase">Giỏ hàng trống</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Chọn sản phẩm bên trái hoặc quét mã vạch.</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product.id} className="py-3.5 flex items-start justify-between gap-3 group">
                <div className="flex items-start gap-3 min-w-0">
                  <img
                    src={getProductImage(item.product)}
                    alt={item.product.name}
                    className="w-14 h-14 rounded-lg border border-slate-200/60 object-contain flex-shrink-0 bg-white p-0.5"
                  />
                  <div className="min-w-0 leading-tight">
                    <p className="text-sm font-black text-slate-800 truncate" title={item.product.name}>
                      {item.product.name}
                    </p>
                    <p className="text-[11px] text-slate-400 font-bold uppercase mt-0.5">{item.product.sku}</p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <button
                        onClick={() => updateQty(item.product.id, item.quantity - 1)}
                        className="w-7 h-7 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-extrabold"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateQty(item.product.id, Number(e.target.value))}
                        className="w-12 h-7 border border-slate-200 text-center text-sm font-black text-slate-800 outline-none rounded"
                      />
                      <button
                        onClick={() => updateQty(item.product.id, item.quantity + 1)}
                        className="w-7 h-7 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-extrabold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <span className="text-sm font-black text-slate-800">
                    {money(Number(item.product.sell_price) * item.quantity)}
                  </span>
                  <span className="text-xs font-bold text-slate-400">
                    {money(item.product.sell_price)}
                  </span>
                  <button
                    onClick={() => updateQty(item.product.id, 0)}
                    className="text-xs font-bold text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition duration-150 self-end mt-1"
                  >
                    Xóa
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ══════════════════════════════════════════════ */}
        {/* AUTO PROMOTIONS — shows when cart qualifies   */}
        {/* ══════════════════════════════════════════════ */}
        {cart.length > 0 && (autoPromos.length > 0 || autoPromoLoading) && (
          <div className="px-4 py-3 bg-emerald-50/60">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] font-black text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                <FiGift className="w-3.5 h-3.5" />
                Khuyến mãi tự động
              </h3>
              {autoPromoLoading && (
                <FiLoader className="w-3 h-3 text-emerald-500 animate-spin" />
              )}
            </div>

            {autoPromos.length > 0 && (
              <div className="space-y-1.5">
                {autoPromos.map((ap) => {
                  const isApplied = ap.discount_amount > 0;
                  const productLabel = getAutoPromotionProductLabel(ap, cart);
                  return (
                    <div
                      key={ap.promotion.id}
                      className={`flex items-center justify-between bg-white rounded-lg px-3 py-2 border shadow-sm ${
                        isApplied ? 'border-emerald-200/60' : 'border-amber-200/60 bg-amber-50/20'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isApplied ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                        }`}>
                          <PromoTypeIcon type={ap.promotion.discount_type} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-extrabold text-slate-800 truncate">{ap.promotion.name}</p>
                          <p className={`text-[9px] font-bold ${isApplied ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {ap.description}
                          </p>
                          <p
                            className="text-[9px] font-semibold text-slate-500 truncate"
                            title={`Sản phẩm áp dụng: ${productLabel}`}
                          >
                            SP áp dụng: {productLabel}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {isApplied ? (
                          <>
                            <span className="text-xs font-black text-emerald-700">-{money(ap.discount_amount)}</span>
                            <HiOutlineCheck className="w-3.5 h-3.5 text-emerald-500" />
                          </>
                        ) : (
                          <span className="text-[9px] font-black text-amber-700 bg-amber-100/70 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                            Chưa đạt
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {autoPromos.length > 1 && (
                  <div className="flex justify-end pt-0.5">
                    <span className="text-[10px] font-black text-emerald-700">
                      Tổng KM: -{money(totalAutoDiscount)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Customer & Discount Panel */}
        <div className="p-4 bg-slate-50/50 space-y-3">
          {/* Customer Phone */}
          <div className="space-y-2 border-b border-slate-100 pb-3">
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Số điện thoại khách hàng</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                  <HiOutlinePhone className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => onPhoneChange(e.target.value)}
                  placeholder="Nhập số điện thoại để tích điểm/đổi điểm"
                  className="w-full bg-white border border-slate-200 pl-8 pr-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition"
                />
              </div>
            </div>

            {customerPhone.trim() && (
              matchedCustomer ? (
                <div className="bg-blue-50/45 border border-blue-100 rounded-lg p-2.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[11px] font-bold text-blue-600 bg-blue-100/60 px-1.5 py-0.5 rounded-md flex-shrink-0">TV</span>
                      <span className="font-extrabold text-slate-800 truncate" title={matchedCustomer.name}>
                        {matchedCustomer.name}
                      </span>
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.2 rounded-full flex-shrink-0">
                        {matchedCustomer.points} điểm
                      </span>
                    </div>
                    <button
                      onClick={() => onPhoneChange('')}
                      className="text-[10px] font-bold text-red-500 hover:text-red-700 uppercase"
                    >
                      Hủy
                    </button>
                  </div>
                  <div className="border-t border-blue-200/50 pt-1.5 flex flex-col gap-1.5">
                    <p className="text-[10px] font-bold text-emerald-600">
                      Tích lũy thêm: +{Math.floor(finalAmount / 10000)} điểm
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50/45 border border-amber-100 rounded-lg p-2.5 space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] font-bold text-amber-700">
                    <span>Khách mới (Chưa tích điểm)</span>
                  </div>
                  <input
                    type="text"
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    placeholder="Nhập họ và tên để tự động tạo tài khoản"
                    className="w-full bg-white border border-amber-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:border-amber-500 transition"
                  />
                </div>
              )
            )}
          </div>

          {/* Discount and Voucher Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Chiết khấu đơn</label>
              <div className="flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden w-full">
                <input
                  type="number"
                  value={discountValue || ''}
                  disabled={!operationSettings.allowDiscount}
                  max={
                    discountType === 'percent'
                      ? operationSettings.maxDiscountPercent
                      : Math.floor((total * (operationSettings.maxDiscountPercent ?? 100)) / 100)
                  }
                  onChange={(e) => {
                    const valStr = e.target.value;
                    if (valStr === '') {
                      setDiscountValue(0);
                      return;
                    }
                    const nextValue = Math.max(0, Number(valStr));
                    const maxLimit =
                      discountType === 'percent'
                        ? (operationSettings.maxDiscountPercent ?? 100)
                        : Math.floor((total * (operationSettings.maxDiscountPercent ?? 100)) / 100);
                    setDiscountValue(Math.min(nextValue, maxLimit));
                  }}
                  placeholder="0"
                  className="flex-1 w-full px-2.5 py-1.5 text-xs font-semibold outline-none disabled:bg-slate-100 disabled:text-slate-400"
                />
                <button
                  disabled={!operationSettings.allowDiscount}
                  onClick={() => {
                    setDiscountType(discountType === 'percent' ? 'value' : 'percent');
                    setDiscountValue(0);
                  }}
                  className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 border-l border-slate-200 text-xs font-black text-slate-600 transition disabled:opacity-50"
                >
                  {discountType === 'percent' ? '%' : 'đ'}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Mã khuyến mãi</label>
              <div className={`flex items-center border rounded-lg bg-white overflow-hidden w-full px-2 transition ${
                voucherResult?.valid
                  ? 'border-emerald-400 ring-1 ring-emerald-400/20'
                  : voucherError
                  ? 'border-red-300 ring-1 ring-red-300/20'
                  : 'border-slate-200'
              }`}>
                <HiOutlineTag className={`w-4 h-4 flex-shrink-0 ${
                  voucherResult?.valid ? 'text-emerald-500' : voucherError ? 'text-red-400' : 'text-slate-400'
                }`} />
                <input
                  type="text"
                  value={voucherCode}
                  onChange={(e) => {
                    setVoucherCode(e.target.value.toUpperCase());
                    setVoucherPromotionId(null);
                  }}
                  placeholder="Nhập mã KM"
                  className="flex-1 w-full px-1.5 py-1.5 text-xs font-semibold outline-none uppercase"
                />
                {voucherLoading && (
                  <FiLoader className="w-3.5 h-3.5 text-slate-400 animate-spin flex-shrink-0" />
                )}
                {!voucherLoading && voucherResult?.valid && (
                  <HiOutlineCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                )}
                {!voucherLoading && voucherError && voucherCode.trim() && (
                  <HiOutlineX className="w-4 h-4 text-red-400 flex-shrink-0" />
                )}
              </div>
              {/* Voucher feedback */}
              {voucherResult?.valid && (
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[9px] font-bold text-emerald-600">
                    ✓ {voucherResult.promoName}: -{money(voucherResult.discountAmount)}
                  </span>
                </div>
              )}
              {voucherError && voucherCode.trim() && (
                <p className="text-[9px] font-bold text-red-500 mt-0.5">{voucherError}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CartPanel;
