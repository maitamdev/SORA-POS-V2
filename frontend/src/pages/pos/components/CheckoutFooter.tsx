import {
  HiOutlineCheck,
  HiOutlineCash,
  HiOutlineDeviceMobile,
  HiOutlineCreditCard,
} from 'react-icons/hi';
import { usePOSStore, usePOSTotal, usePOSDiscountAmount, usePOSFinalAmount } from '../../../stores/pos.store';
import { money } from '../utils/posHelpers';

interface CheckoutFooterProps {
  onCheckout: (isTransferConfirmed?: boolean) => void;
}

const CheckoutFooter = ({ onCheckout }: CheckoutFooterProps) => {
  const paymentMethod = usePOSStore((s) => s.paymentMethod);
  const loading = usePOSStore((s) => s.loading);
  const cart = usePOSStore((s) => s.cart);
  const setPaymentMethod = usePOSStore((s) => s.setPaymentMethod);
  const setShowCashPayment = usePOSStore((s) => s.setShowCashPayment);
  const setReceivedAmount = usePOSStore((s) => s.setReceivedAmount);

  const total = usePOSTotal();
  const discountAmount = usePOSDiscountAmount();
  const finalAmount = usePOSFinalAmount();

  return (
    <div className="p-4 bg-white border-t border-slate-100 space-y-4 flex-shrink-0">
      {/* Calculation details */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-xs font-bold text-slate-500">
          <span>Tạm tính</span>
          <span>{money(total)}</span>
        </div>

        {discountAmount > 0 && (
          <div className="flex justify-between items-center text-xs font-bold text-red-500">
            <span>Chiết khấu</span>
            <span>-{money(discountAmount)}</span>
          </div>
        )}

        <div className="flex justify-between items-center text-xs font-bold text-slate-500">
          <span>Tổng tiền hàng</span>
          <span>{money(total)}</span>
        </div>

        <div className="flex justify-between items-center border-t border-slate-100 pt-2 text-sm font-extrabold text-slate-800">
          <span>Thành tiền</span>
          <span className="text-xl font-black text-blue-600">{money(finalAmount)}</span>
        </div>
      </div>

      {/* Payment Method Selector */}
      <div className="space-y-1.5">
        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Phương thức thanh toán</label>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => {
              setPaymentMethod('cash');
              setShowCashPayment(true);
            }}
            className={`flex flex-col items-center justify-center py-2.5 rounded-xl border text-[11px] font-black gap-1.5 transition ${
              paymentMethod === 'cash'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20'
                : 'bg-slate-50 border-slate-200/60 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <HiOutlineCash className="w-5 h-5 text-current" />
            <span>Tiền mặt</span>
          </button>

          <button
            onClick={() => {
              setPaymentMethod('transfer');
              setReceivedAmount(finalAmount);
              setShowCashPayment(false);
            }}
            className={`flex flex-col items-center justify-center py-2.5 rounded-xl border text-[11px] font-black gap-1.5 transition ${
              paymentMethod === 'transfer'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20'
                : 'bg-slate-50 border-slate-200/60 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <HiOutlineDeviceMobile className="w-5 h-5 text-current" />
            <span>Chuyển khoản QR</span>
          </button>

          <button
            onClick={() => {
              setPaymentMethod('card');
              setReceivedAmount(finalAmount);
              setShowCashPayment(false);
            }}
            className={`flex flex-col items-center justify-center py-2.5 rounded-xl border text-[11px] font-black gap-1.5 transition ${
              paymentMethod === 'card'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20'
                : 'bg-slate-50 border-slate-200/60 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <HiOutlineCreditCard className="w-5 h-5 text-current" />
            <span>Thẻ</span>
          </button>
        </div>
      </div>

      {/* CTA Button */}
      <div>
        <button
          onClick={() => onCheckout(false)}
          disabled={loading || cart.length === 0}
          className="w-full py-3 bg-blue-600 text-white hover:bg-blue-700 text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition disabled:opacity-60 disabled:shadow-none"
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Đang thanh toán...</span>
            </>
          ) : (
            <>
              <HiOutlineCheck className="w-4.5 h-4.5 stroke-[3]" />
              <span>Thanh toán (F9)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default CheckoutFooter;
