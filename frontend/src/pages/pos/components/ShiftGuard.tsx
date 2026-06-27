import { ShiftSession } from '../../../types/domain.type';
import { money } from '../utils/posHelpers';

interface ShiftGuardProps {
  activeShift: ShiftSession | null;
  shiftLoading: boolean;
  isCashierShiftRequired: boolean;
  openingCash: string;
  onOpeningCashChange: (value: string) => void;
  onCheckIn: () => void;
}

/**
 * Renders early-return screens for shift states:
 * loading, no shift, opened (check-in), closed.
 * Returns null when POS main UI should render.
 */
const ShiftGuard = ({
  activeShift,
  shiftLoading,
  isCashierShiftRequired,
  openingCash,
  onOpeningCashChange,
  onCheckIn,
}: ShiftGuardProps) => {
  if (!isCashierShiftRequired) return null;

  // Loading state
  if (shiftLoading && !activeShift) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 p-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-black uppercase text-slate-400">Đang kiểm tra ca làm</p>
          <p className="mt-2 text-slate-600">Vui lòng đợi trong giây lát...</p>
        </div>
      </div>
    );
  }

  // No shift available
  if (!activeShift) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-lg rounded-xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-black uppercase text-red-600">Chưa có ca được mở</p>
          <h1 className="mt-2 text-2xl font-black text-slate-900">Không thể bán hàng</h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            Quản lý cần mở ca hôm nay cho tài khoản của bạn. Sau đó đăng nhập lại để bắt đầu nhận ca.
          </p>
        </div>
      </div>
    );
  }

  // Opened — needs check-in
  if (activeShift.status === 'opened') {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase text-blue-600">Nhận ca bán hàng</p>
          <h1 className="mt-2 text-2xl font-black text-slate-900">Nhập tiền đầu ca</h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            Ca hôm nay đã được quản lý mở. Hãy đếm tiền ban đầu trong ngăn kéo trước khi bán hàng.
          </p>

          <label className="mt-6 block">
            <span className="mb-2 block text-xs font-black uppercase text-slate-500">Tiền nhận ca ban đầu</span>
            <input
              type="number"
              min="0"
              value={openingCash}
              onChange={(event) => onOpeningCashChange(event.target.value)}
              placeholder="VD: 500000"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-lg font-black outline-none focus:border-blue-500"
            />
          </label>

          <button
            onClick={onCheckIn}
            disabled={shiftLoading}
            className="mt-5 w-full rounded-xl bg-blue-600 py-3 text-sm font-black uppercase text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {shiftLoading ? 'Đang nhận ca...' : 'Nhận ca và bắt đầu bán hàng'}
          </button>
        </div>
      </div>
    );
  }

  // Closed — show summary
  if (activeShift.status === 'closed') {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-2xl rounded-xl border border-emerald-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase text-emerald-600">Đã chốt ca</p>
          <h1 className="mt-2 text-2xl font-black text-slate-900">Báo cáo đã gửi quản lý</h1>
          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase text-slate-400">Doanh thu</p>
              <p className="text-xl font-black text-slate-900">{money(activeShift.summary?.revenue || 0)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase text-slate-400">Số đơn</p>
              <p className="text-xl font-black text-slate-900">{activeShift.summary?.order_count || 0}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase text-slate-400">Tiền cần có</p>
              <p className="text-xl font-black text-slate-900">{money(activeShift.expected_cash || 0)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase text-slate-400">Lệch tiền</p>
              <p className="text-xl font-black text-slate-900">{money(activeShift.cash_difference || 0)}</p>
            </div>
          </div>
          <p className="mt-5 text-sm font-semibold text-slate-500">
            Nếu cần bán tiếp, quản lý hãy mở ca mới cho nhân viên.
          </p>
        </div>
      </div>
    );
  }

  return null; // checked_in → render main POS UI
};

export default ShiftGuard;
