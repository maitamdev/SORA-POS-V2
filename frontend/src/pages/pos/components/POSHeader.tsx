import { Link } from 'react-router-dom';
import {
  HiOutlineShoppingCart,
  HiOutlineSearch,
} from 'react-icons/hi';
import { useAuthStore } from '../../../stores/auth.store';
import { usePOSStore } from '../../../stores/pos.store';
import { useBarcodeScanner } from '../../../hooks/useBarcodeScanner';
import { getRoleLabel, getUserInitials } from '../../../utils/userDisplay';

// Custom Barcode icon svg
const BarcodeIcon = () => (
  <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h2M7 5h1M10 5h3M15 5h1M18 5h3M3 10h1M6 10h2M10 10h2M14 10h3M19 10h2M3 15h3M8 15h1M11 15h2M15 15h2M19 15h2M3 20h2M7 20h2M11 20h1M14 20h3M19 20h2" />
  </svg>
);

interface POSHeaderProps {
  onBarcodeSubmit: (e?: React.FormEvent) => void;
}

const POSHeader = ({ onBarcodeSubmit }: POSHeaderProps) => {
  const { user } = useAuthStore();
  const { isConnected, pairingCode } = useBarcodeScanner();

  const search = usePOSStore((s) => s.search);
  const barcodeSearch = usePOSStore((s) => s.barcodeSearch);
  const activeShift = usePOSStore((s) => s.activeShift);
  const setSearch = usePOSStore((s) => s.setSearch);
  const setBarcodeSearch = usePOSStore((s) => s.setBarcodeSearch);
  const setPage = usePOSStore((s) => s.setPage);
  const setShowPairingModal = usePOSStore((s) => s.setShowPairingModal);

  const isCashierShiftRequired = user?.role === 'cashier';

  return (
    <header className="h-auto min-h-[4rem] flex flex-wrap items-center justify-between gap-2 px-3 sm:px-6 py-2 bg-white border-b border-slate-100 flex-shrink-0 z-10 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
          <HiOutlineShoppingCart className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-black tracking-tight text-slate-800 uppercase leading-none">Bán hàng POS</h1>
          <p className="text-[10px] text-slate-400 font-bold tracking-wide mt-0.5">Bán hàng tại quầy</p>
        </div>
      </div>

      {/* Header Search Bars */}
      <div className="hidden md:flex items-center gap-3">
        {/* F3 Product Search */}
        <div className="relative">
          <HiOutlineSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            id="product-search-input"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Tìm sản phẩm"
            className="w-60 lg:w-80 pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 bg-slate-50 transition"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600">✕</button>
          )}
        </div>

        {/* F2 Barcode Scanner Input */}
        <form onSubmit={onBarcodeSubmit} className="relative">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
            <BarcodeIcon />
          </div>
          <input
            id="barcode-search-input"
            value={barcodeSearch}
            onChange={(e) => setBarcodeSearch(e.target.value)}
            placeholder="Quét mã vạch"
            className="w-48 lg:w-56 pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 bg-slate-50 transition"
          />
          <button type="submit" className="hidden">Submit</button>
        </form>
        {isConnected ? (
          <button
            onClick={() => setShowPairingModal(true)}
            className="hidden xl:flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] font-black text-emerald-700 hover:bg-emerald-100 transition"
            title="Đã kết nối máy quét điện thoại. Nhấn để xem mã ghép đôi."
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500 bg-emerald-500" style={{ boxShadow: '0 0 8px #10b981' }} />
            Quét ĐT: Bật
          </button>
        ) : (
          <button
            onClick={() => setShowPairingModal(true)}
            className="hidden xl:flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-black text-slate-500 hover:bg-slate-100 transition"
            title="Chưa kết nối điện thoại. Nhấn để quét mã QR ghép đôi."
          >
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            Ghép ĐT ({pairingCode})
          </button>
        )}
      </div>

      {/* Right Info Widgets */}
      <div className="hidden sm:flex items-center gap-2 sm:gap-4">
        {isCashierShiftRequired && activeShift?.status === 'checked_in' && (
          <Link
            to="/my-shift"
            className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100"
          >
            Ca của tôi
          </Link>
        )}
        <div className="flex items-center gap-2 pl-3 border-l border-slate-100">
          <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shadow-sm">
            {getUserInitials(user)}
          </div>
          <div className="hidden md:block leading-tight">
            <p className="text-xs font-black text-slate-800">{user?.full_name || 'Nhân viên'}</p>
            <p className="text-[10px] font-bold text-slate-400">{getRoleLabel(user?.role)}</p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default POSHeader;
