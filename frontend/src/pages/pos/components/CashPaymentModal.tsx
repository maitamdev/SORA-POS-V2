import { HiOutlineXCircle } from 'react-icons/hi';
import { usePOSStore, usePOSFinalAmount, usePOSChangeAmount, usePOSCashSuggestions } from '../../../stores/pos.store';
import { money } from '../utils/posHelpers';

interface CashPaymentModalProps {
  onCheckout: (isTransferConfirmed?: boolean) => void;
}

const CashPaymentModal = ({ onCheckout }: CashPaymentModalProps) => {
  const showCashPayment = usePOSStore((s) => s.showCashPayment);
  const receivedAmount = usePOSStore((s) => s.receivedAmount);
  const loading = usePOSStore((s) => s.loading);
  const cart = usePOSStore((s) => s.cart);
  const operationSettings = usePOSStore((s) => s.operationSettings);
  const setShowCashPayment = usePOSStore((s) => s.setShowCashPayment);
  const setReceivedAmount = usePOSStore((s) => s.setReceivedAmount);

  const finalAmount = usePOSFinalAmount();
  const changeAmount = usePOSChangeAmount();
  const cashSuggestions = usePOSCashSuggestions();

  if (!showCashPayment) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Thanh toán tiền mặt</h3>
            <p className="text-xs font-semibold text-slate-400 mt-0.5">Nhập số tiền khách đưa hoặc chọn nhanh mệnh giá.</p>
          </div>
          <button
            onClick={() => setShowCashPayment(false)}
            className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 flex items-center justify-center transition"
            aria-label="Thoát"
          >
            <HiOutlineXCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-blue-500">Cần thu</p>
              <p className="text-2xl font-black text-blue-700 mt-1">{money(finalAmount, operationSettings.currency, operationSettings.locale)}</p>
            </div>
            <div className={`rounded-xl border p-3 ${receivedAmount >= finalAmount ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
              <p className={`text-[10px] font-black uppercase tracking-wider ${receivedAmount >= finalAmount ? 'text-emerald-600' : 'text-amber-600'}`}>
                {receivedAmount >= finalAmount ? 'Tiền trả lại' : 'Còn thiếu'}
              </p>
              <p className={`text-2xl font-black mt-1 ${receivedAmount >= finalAmount ? 'text-emerald-700' : 'text-amber-700'}`}>
                {money(receivedAmount >= finalAmount ? changeAmount : Math.max(finalAmount - receivedAmount, 0), operationSettings.currency, operationSettings.locale)}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Tiền khách đưa</label>
            <input
              type="number"
              value={receivedAmount || ''}
              onChange={(e) => setReceivedAmount(Number(e.target.value))}
              placeholder={String(finalAmount)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-lg font-black text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Chọn nhanh</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {cashSuggestions.map((amount) => (
                <button
                  key={amount}
                  onClick={() => setReceivedAmount(amount)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:border-blue-400 hover:bg-blue-50 transition"
                >
                  {amount === finalAmount ? 'Đủ tiền' : money(amount, operationSettings.currency, operationSettings.locale)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Cộng mệnh giá</p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[10000, 20000, 50000, 100000, 200000, 500000].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setReceivedAmount((prev: number) => prev + amount)}
                  className="rounded-xl bg-slate-100 px-2 py-2 text-[11px] font-black text-slate-600 hover:bg-slate-200 transition"
                >
                  +{amount / 1000}K
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 p-5 border-t border-slate-100 bg-slate-50">
          <button
            onClick={() => setShowCashPayment(false)}
            className="py-2.5 border border-slate-200 bg-white text-slate-600 text-xs font-black rounded-xl hover:bg-slate-100 transition"
          >
            Thoát
          </button>
          <button
            onClick={() => setReceivedAmount(0)}
            className="py-2.5 border border-slate-200 bg-white text-slate-600 text-xs font-black rounded-xl hover:bg-slate-100 transition"
          >
            Xóa tiền
          </button>
          <button
            onClick={() => onCheckout(false)}
            disabled={loading || cart.length === 0 || (receivedAmount > 0 && receivedAmount < finalAmount)}
            className="py-2.5 bg-blue-600 text-white text-xs font-black rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
          >
            Thanh toán
          </button>
        </div>
      </div>
    </div>
  );
};

export default CashPaymentModal;
