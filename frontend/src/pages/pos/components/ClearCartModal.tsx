import { HiOutlineTrash } from 'react-icons/hi';
import toast from 'react-hot-toast';
import { usePOSStore } from '../../../stores/pos.store';

const ClearCartModal = () => {
  const showClearCartConfirm = usePOSStore((s) => s.showClearCartConfirm);
  const setShowClearCartConfirm = usePOSStore((s) => s.setShowClearCartConfirm);
  const clearCart = usePOSStore((s) => s.clearCart);

  if (!showClearCartConfirm) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-red-50/30">
          <h3 className="text-base font-black text-red-700 uppercase tracking-tight">Xóa giỏ hàng</h3>
          <p className="text-xs font-semibold text-slate-400 mt-0.5">Thao tác này sẽ dọn trống toàn bộ sản phẩm hiện tại.</p>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-sm font-semibold text-slate-600">
            Bạn có chắc chắn muốn xóa toàn bộ sản phẩm trong giỏ hàng không? Thao tác này không thể khôi phục lại.
          </p>
        </div>

        {/* Footer */}
        <div className="grid grid-cols-2 gap-3 p-5 border-t border-slate-100 bg-slate-50">
          <button
            onClick={() => setShowClearCartConfirm(false)}
            className="py-2.5 border border-slate-200 bg-white text-slate-600 text-xs font-black rounded-xl hover:bg-slate-100 transition"
          >
            Hủy bỏ
          </button>
          <button
            onClick={() => {
              clearCart();
              toast.success('Đã xóa giỏ hàng');
            }}
            className="py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black rounded-xl flex items-center justify-center gap-1.5 transition"
          >
            <HiOutlineTrash className="w-4 h-4" />
            <span>Xóa sạch</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClearCartModal;
