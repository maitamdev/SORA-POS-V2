import {
  HiOutlineCheck,
  HiOutlineUser,
  HiOutlineCreditCard,
  HiOutlineCash,
  HiOutlineDeviceMobile,
  HiOutlineExclamationCircle,
} from 'react-icons/hi';
import { usePOSStore, usePOSTotal, usePOSDiscountAmount, usePOSPointsDiscount, usePOSFinalAmount } from '../../../stores/pos.store';
import { useAuthStore } from '../../../stores/auth.store';
import { money, getProductImage } from '../utils/posHelpers';

interface CheckoutConfirmModalProps {
  onCheckout: (isTransferConfirmed?: boolean, isCheckoutConfirmed?: boolean) => void;
}

const CheckoutConfirmModal = ({ onCheckout }: CheckoutConfirmModalProps) => {
  const showCheckoutConfirm = usePOSStore((s) => s.showCheckoutConfirm);
  const cart = usePOSStore((s) => s.cart);
  const matchedCustomer = usePOSStore((s) => s.matchedCustomer);
  const customerPhone = usePOSStore((s) => s.customerPhone);
  const newCustName = usePOSStore((s) => s.newCustName);
  const paymentMethod = usePOSStore((s) => s.paymentMethod);
  const isRedeemingPoints = usePOSStore((s) => s.isRedeemingPoints);
  const usedPoints = usePOSStore((s) => s.usedPoints);

  const setShowCheckoutConfirm = usePOSStore((s) => s.setShowCheckoutConfirm);
  const setIsRedeemingPoints = usePOSStore((s) => s.setIsRedeemingPoints);
  const setUsedPoints = usePOSStore((s) => s.setUsedPoints);

  const { user } = useAuthStore();
  const total = usePOSTotal();
  const discountAmount = usePOSDiscountAmount();
  const pointsDiscount = usePOSPointsDiscount();
  const finalAmount = usePOSFinalAmount();

  if (!showCheckoutConfirm) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden animate-fadeIn flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Xác nhận thanh toán</h3>
          <p className="text-xs font-semibold text-slate-400 mt-0.5">Vui lòng kiểm tra lại thông tin đơn hàng trước khi hoàn tất.</p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <p className="text-sm font-bold text-slate-705">
            Bạn có chắc chắn muốn tiến hành thanh toán cho đơn hàng này không?
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Column 1: Customer & Payment */}
            <div className="space-y-4">
              {/* Customer */}
              <div className="bg-slate-50/70 border border-slate-200/60 rounded-xl p-3.5 space-y-2.5">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                  <HiOutlineUser className="w-3.5 h-3.5" />
                  <span>Khách hàng</span>
                </p>
                <div className="text-xs font-extrabold text-slate-800">
                  {matchedCustomer ? (
                    <div className="space-y-1">
                      <p className="text-sm font-black text-slate-800">{matchedCustomer.name}</p>
                      <p className="text-slate-500">{customerPhone}</p>
                      <p className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-extrabold mt-1">
                        Điểm khả dụng: {matchedCustomer.points} điểm
                      </p>
                    </div>
                  ) : newCustName.trim() ? (
                    <div className="space-y-1">
                      <p className="text-sm font-black text-slate-800">{newCustName}</p>
                      <p className="text-slate-500">{customerPhone}</p>
                      <span className="text-[9px] font-black uppercase bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200 inline-block mt-1">Đăng ký mới</span>
                    </div>
                  ) : (
                    <p className="text-sm font-black text-slate-500 italic">Khách vãng lai (Khách lẻ)</p>
                  )}
                </div>
              </div>

              {/* Payment method */}
              <div className="bg-slate-50/70 border border-slate-200/60 rounded-xl p-3.5 space-y-2.5">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                  <HiOutlineCreditCard className="w-3.5 h-3.5 animate-pulse" />
                  <span>Phương thức & Nhân viên</span>
                </p>
                <div className="space-y-2 text-xs font-extrabold text-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-semibold">Thanh toán:</span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border bg-white shadow-xs">
                      {paymentMethod === 'cash' ? (
                        <><HiOutlineCash className="w-4 h-4 text-emerald-600 stroke-[2.5]" /><span className="text-emerald-700 font-black">Tiền mặt</span></>
                      ) : paymentMethod === 'transfer' ? (
                        <><HiOutlineDeviceMobile className="w-4 h-4 text-blue-600 stroke-[2.5]" /><span className="text-blue-700 font-black">Chuyển khoản QR</span></>
                      ) : (
                        <><HiOutlineCreditCard className="w-4 h-4 text-indigo-600 stroke-[2.5]" /><span className="text-indigo-700 font-black">Thẻ ngân hàng</span></>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200/50 pt-2">
                    <span className="text-slate-500 font-semibold">Thu ngân:</span>
                    <span className="text-slate-700">{user?.full_name || 'Nhân viên'}</span>
                  </div>
                </div>
              </div>

              {/* Points redemption */}
              {matchedCustomer && matchedCustomer.points > 0 && (
                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3.5 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isRedeemingPoints}
                      onChange={(e) => {
                        setIsRedeemingPoints(e.target.checked);
                        if (e.target.checked) {
                          const maxPoints = Math.min(matchedCustomer.points, Math.floor((total - discountAmount) / 1000));
                          setUsedPoints(maxPoints);
                        } else {
                          setUsedPoints(0);
                        }
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span className="text-xs font-black text-blue-900">
                      Sử dụng điểm tích lũy ({matchedCustomer.points} điểm khả dụng)
                    </span>
                  </label>
                  {isRedeemingPoints && (
                    <div className="flex items-center gap-2 pl-6 pt-1">
                      <input
                        type="number"
                        min={0}
                        max={Math.min(matchedCustomer.points, Math.floor((total - discountAmount) / 1000))}
                        value={usedPoints || ''}
                        onChange={(e) => {
                          const points = Math.max(0, parseInt(e.target.value, 10) || 0);
                          const maxPoints = Math.min(matchedCustomer.points, Math.floor((total - discountAmount) / 1000));
                          setUsedPoints(Math.min(points, maxPoints));
                        }}
                        placeholder="0"
                        className="w-24 bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-xs font-black text-slate-800 text-center outline-none focus:border-blue-500 transition"
                      />
                      <span className="text-xs text-blue-700 font-bold">điểm (giảm {money(usedPoints * 1000)})</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Column 2: Cart Items & Financials */}
            <div className="space-y-4">
              {/* Cart Items */}
              <div className="border border-slate-200/60 rounded-xl overflow-hidden bg-white shadow-xs">
                <div className="bg-slate-50/70 px-3.5 py-2 border-b border-slate-100 flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                    Sản phẩm ({cart.reduce((s, i) => s + i.quantity, 0)})
                  </span>
                </div>
                <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto px-3.5">
                  {cart.map((item) => (
                    <div key={item.product.id} className="py-2 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={getProductImage(item.product)}
                          alt={item.product.name}
                          className="w-7 h-7 rounded border border-slate-200 object-contain p-0.5 bg-white flex-shrink-0"
                        />
                        <div className="min-w-0 leading-tight">
                          <p className="font-extrabold text-slate-800 truncate" title={item.product.name}>
                            {item.product.name}
                          </p>
                          <span className="text-[9px] text-slate-400 font-bold uppercase">{item.product.sku}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-slate-400 font-bold">x{item.quantity}</span>
                        <span className="font-extrabold text-slate-800 w-16 text-right">
                          {money(Number(item.product.sell_price) * item.quantity)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pricing Breakdown */}
              <div className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-4 space-y-2 text-xs font-bold text-slate-600">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Tạm tính:</span>
                  <span className="text-slate-800 font-extrabold">{money(total)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between items-center text-red-500">
                    <span>Chiết khấu đơn:</span>
                    <span className="font-extrabold">-{money(discountAmount)}</span>
                  </div>
                )}
                {pointsDiscount > 0 && (
                  <div className="flex justify-between items-center text-blue-600">
                    <span>Đổi điểm tích lũy:</span>
                    <span className="font-extrabold">-{money(pointsDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center border-t border-slate-200 pt-2 text-sm font-extrabold text-slate-800">
                  <span>Cần thanh toán:</span>
                  <span className="text-lg font-black text-blue-600">{money(finalAmount)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="grid grid-cols-2 gap-3 p-5 border-t border-slate-100 bg-slate-50">
          <button
            onClick={() => {
              setShowCheckoutConfirm(false);
              setIsRedeemingPoints(false);
              setUsedPoints(0);
            }}
            className="py-2.5 border border-slate-200 bg-white text-slate-600 text-xs font-black rounded-xl hover:bg-slate-100 transition"
          >
            Quay lại
          </button>
          <button
            onClick={() => {
              setShowCheckoutConfirm(false);
              onCheckout(false, true);
            }}
            className="py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl flex items-center justify-center gap-1.5 transition"
          >
            <HiOutlineCheck className="w-4 h-4 stroke-[3]" />
            <span>Xác nhận (F9)</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CheckoutConfirmModal;
