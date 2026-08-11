import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FiArrowLeft, FiPlus, FiTrash2, FiSearch, FiDollarSign, FiFileText, FiUser, FiInfo, FiCheck, FiLoader
} from 'react-icons/fi';
import { goodsReceiptAPI } from '../../services/goodsReceipt.api';
import { catalogAPI } from '../../services/catalog.api';
import { Product, Supplier } from '../../types/domain.type';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';

interface SelectedItem {
  lineId: string;
  product: Product;
  quantity: number;
  unit_price: number;
  expiry_date: string;
  batch_number: string;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
};

const createLineId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function CreateReceiptPage() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Form states
  const [supplierId, setSupplierId] = useState('');
  const [note, setNote] = useState('');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);

  // Product Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchProducts, setSearchProducts] = useState<Product[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Kết nối máy quét mã vạch từ xa qua Supabase Realtime
  const { scannedBarcode, isConnected: isScannerConnected, pairingCode } = useBarcodeScanner();

  const handleScanProduct = async (barcode: string) => {
    const code = barcode.trim();
    if (!code) return;

    const toastId = toast.loading(`Đang tìm sản phẩm có mã: ${code}...`);
    try {
      const response = await catalogAPI.products.list({ search: code, is_active: true, limit: 5 });
      const dbMatch = response.data.data.items.find((p: Product) => p.barcode === code || p.sku === code);

      if (dbMatch) {
        handleAddItem(dbMatch);
        toast.success(`Đã thêm ${dbMatch.name} vào phiếu nhập`, { id: toastId });
      } else {
        toast.error(`Không tìm thấy sản phẩm có mã: ${code}`, { id: toastId });
      }
    } catch (err) {
      toast.error('Lỗi khi truy vấn mã vạch', { id: toastId });
    }
  };

  useEffect(() => {
    if (scannedBarcode) {
      handleScanProduct(scannedBarcode);
    }
  }, [scannedBarcode]);

  useEffect(() => {
    const loadSuppliers = async () => {
      setLoading(true);
      try {
        const res = await catalogAPI.suppliers.list({ limit: 100, is_active: true });
        setSuppliers(res.data.data.items);
      } catch (err) {
        toast.error('Không thể tải danh sách nhà cung cấp');
      } finally {
        setLoading(false);
      }
    };
    loadSuppliers();
  }, []);

  // Handle product search
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      const trimmed = searchQuery.trim();
      if (!trimmed) {
        setSearchProducts([]);
        setShowDropdown(false);
        return;
      }

      setSearchLoading(true);
      try {
        const res = await catalogAPI.products.list({ search: trimmed, is_active: true, limit: 10 });
        setSearchProducts(res.data.data.items);
        setShowDropdown(true);
      } catch (err) {
        console.error('Lỗi tìm sản phẩm:', err);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // Click outside listener for search dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calculate totals
  const totalAmount = selectedItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const remainingAmount = Math.max(totalAmount - paidAmount, 0);
  const today = new Date().toISOString().split('T')[0];
  const hasIncompleteLot = selectedItems.some((item) => !item.batch_number.trim() || !item.expiry_date || item.expiry_date < today || item.quantity <= 0);

  // Auto-set paid amount to total if user wants to pay in full
  const handlePayInFull = () => {
    setPaidAmount(totalAmount);
  };

  const handleAddItem = (product: Product) => {
    // Mỗi lần thêm tạo một dòng lô riêng. Cùng sản phẩm có thể có nhiều HSD.
    setSelectedItems((currentItems) => [
      ...currentItems,
      {
        lineId: createLineId(),
        product,
        quantity: 1,
        unit_price: product.cost_price || 0,
        expiry_date: '',
        batch_number: '',
      },
    ]);
    setSearchQuery('');
    setShowDropdown(false);
  };

  const handleUpdateQty = (lineId: string, qty: number) => {
    if (qty <= 0) return;
    setSelectedItems((items) => items.map((item) => item.lineId === lineId ? { ...item, quantity: qty } : item));
  };

  const handleUpdatePrice = (lineId: string, price: number) => {
    if (price < 0) return;
    setSelectedItems((items) => items.map((item) => item.lineId === lineId ? { ...item, unit_price: price } : item));
  };

  const handleUpdateExpiry = (lineId: string, expiry: string) => {
    setSelectedItems((items) => items.map((item) => item.lineId === lineId ? { ...item, expiry_date: expiry } : item));
  };

  const handleUpdateBatch = (lineId: string, batchNumber: string) => {
    setSelectedItems((items) => items.map((item) => item.lineId === lineId ? { ...item, batch_number: batchNumber } : item));
  };

  const handleRemoveItem = (lineId: string) => {
    setSelectedItems((items) => items.filter((item) => item.lineId !== lineId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!supplierId) {
      toast.error('Vui lòng chọn nhà cung cấp');
      return;
    }
    if (selectedItems.length === 0) {
      toast.error('Vui lòng thêm ít nhất một sản phẩm vào phiếu nhập');
      return;
    }

    const incompleteLine = selectedItems.find((item) => !item.batch_number.trim() || !item.expiry_date || item.expiry_date < today || item.quantity <= 0);
    if (incompleteLine) {
      toast.error('Vui lòng nhập số lô và HSD hợp lệ cho từng dòng hàng');
      return;
    }

    setSubmitLoading(true);
    try {
      const payload = {
        supplier_id: supplierId,
        note: note.trim() || null,
        paid_amount: Number(paidAmount || 0),
        items: selectedItems.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          expiry_date: item.expiry_date,
          batch_number: item.batch_number.trim(),
        })),
      };

      await goodsReceiptAPI.create(payload);
      toast.success('Lưu phiếu nhập kho và cập nhật tồn kho thành công!');
      navigate('/stock?tab=receipts');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi tạo phiếu nhập kho');
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-5 animate-fadeIn pb-10">
      {/* Header */}
      <header className="flex items-start gap-4 border-b border-slate-200 pb-4">
        <button
          onClick={() => navigate('/stock?tab=receipts')}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition"
        >
          <FiArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl sm:text-[30px] font-black tracking-tight text-slate-950">Tạo phiếu nhập kho</h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500">
            Ghi nhận hàng nhập theo từng lô để tồn kho và cảnh báo HSD luôn chính xác.
          </p>
        </div>
      </header>

      {loading ? (
        <div className="py-20 text-center text-slate-400 font-bold">
          <FiLoader className="inline animate-spin mr-2" size={20} />
          Đang tải dữ liệu khởi tạo...
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          {/* Left Panel: Product Selection & Cart Table */}
          <div className="space-y-6">
            {/* Search Input Card */}
            <div className="border border-slate-300 bg-white p-5 shadow-sm space-y-4 relative">
              <div className="flex justify-between items-center">
                <span className="text-sm font-black text-slate-700">Tìm sản phẩm nhập kho</span>
                {isScannerConnected ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-black text-emerald-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Quét ĐT: Bật
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 border border-slate-200 px-2.5 py-0.5 text-[10px] font-black text-slate-400" title="Quét mã QR ghép đôi trên trang POS hoặc cài đặt">
                    Ghép ĐT ({pairingCode})
                  </span>
                )}
              </div>
              <label className="block">
                <div className="relative">
                  <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Nhập tên, mã vạch (barcode) hoặc SKU sản phẩm..."
                    className="w-full h-11 rounded-xl border border-slate-200 pl-11 pr-4 text-sm font-semibold outline-none focus:border-slate-400 bg-slate-50/50"
                  />
                  {searchLoading && (
                    <FiLoader className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" size={16} />
                  )}
                </div>
              </label>

              {/* Autocomplete Dropdown */}
              {showDropdown && searchProducts.length > 0 && (
                <div
                  ref={dropdownRef}
                  className="absolute left-5 right-5 top-full mt-1 z-30 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg divide-y divide-slate-100"
                >
                  {searchProducts.map((prod) => (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => handleAddItem(prod)}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 transition flex items-center justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-800 text-sm truncate">{prod.name}</p>
                        <p className="text-xs font-semibold text-slate-400 mt-0.5">
                          SKU: {prod.sku} {prod.barcode ? `| Barcode: ${prod.barcode}` : ''}
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-xs font-bold text-slate-500">Tồn: {prod.stock_quantity} {prod.unit}</p>
                        <p className="text-xs font-black text-blue-600 mt-0.5">{formatCurrency(prod.cost_price)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Items Table Card */}
            <div className="border border-slate-300 bg-white p-5 shadow-sm space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">Hàng hóa nhập kho</h3>
                  <p className="mt-1 text-xs font-medium text-slate-500">Mỗi dòng là một lô. Cùng sản phẩm có thể nhập nhiều HSD khác nhau.</p>
                </div>
                <span className="border border-blue-100 bg-blue-50 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-blue-700">{selectedItems.length} dòng lô</span>
              </div>
              {hasIncompleteLot && selectedItems.length > 0 && (
                <div className="border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                  Bổ sung số lô và HSD cho tất cả dòng hàng trước khi xác nhận.
                </div>
              )}

              {selectedItems.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-bold border-2 border-dashed border-slate-100 rounded-xl">
                  Chưa có sản phẩm nào được chọn. Hãy dùng ô tìm kiếm ở trên.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[800px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-black uppercase text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3">Sản phẩm / SKU</th>
                        <th className="px-4 py-3 text-right">Giá nhập cũ</th>
                        <th className="px-4 py-3 text-center" style={{ width: '90px' }}>Số lượng</th>
                        <th className="px-4 py-3 text-center" style={{ width: '130px' }}>Giá nhập mới</th>
                        <th className="px-4 py-3 text-center" style={{ width: '130px' }}>Số lô nhập</th>
                        <th className="px-4 py-3 text-center" style={{ width: '160px' }}>Hạn sử dụng</th>
                        <th className="px-4 py-3 text-right">Thành tiền</th>
                        <th className="px-4 py-3 text-center">Xóa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                        {selectedItems.map((item) => (
                        <tr key={item.lineId} className="hover:bg-blue-50/30 transition">
                          <td className="px-4 py-3">
                            <p className="font-bold text-slate-900 line-clamp-1">{item.product.name}</p>
                            <p className="text-[10px] font-semibold text-slate-400">SKU: {item.product.sku}</p>
                          </td>
                          <td className="px-4 py-3 text-right text-slate-400">{formatCurrency(item.product.cost_price)}</td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) => handleUpdateQty(item.lineId, parseInt(e.target.value) || 0)}
                              className="w-16 h-9 rounded-lg border border-slate-200 text-center font-bold text-slate-700 outline-none focus:border-slate-400"
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="number"
                              min={0}
                              value={item.unit_price}
                              onChange={(e) => handleUpdatePrice(item.lineId, parseFloat(e.target.value) || 0)}
                              className="w-24 h-9 rounded-lg border border-slate-200 text-right pr-2 font-bold text-slate-700 outline-none focus:border-slate-400"
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="text"
                              required
                              placeholder="Số lô"
                              value={item.batch_number || ''}
                              onChange={(e) => handleUpdateBatch(item.lineId, e.target.value)}
                              className="w-28 h-9 rounded-lg border border-slate-200 px-2 font-bold text-slate-700 outline-none focus:border-slate-400 text-center"
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="date"
                              required
                              min={today}
                              value={item.expiry_date || ''}
                              onChange={(e) => handleUpdateExpiry(item.lineId, e.target.value)}
                              className="w-36 h-9 rounded-lg border border-slate-200 px-2 text-center font-bold text-slate-700 outline-none focus:border-slate-400 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3 text-right text-slate-900 font-black">
                            {formatCurrency(item.quantity * item.unit_price)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.lineId)}
                              className="text-red-500 hover:text-red-700 transition"
                            >
                              <FiTrash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Receipt Info & Submitting */}
          <div className="space-y-6">
            {/* Info and payment */}
            <div className="border border-slate-300 bg-white p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-black uppercase text-slate-700 pb-2 border-b border-slate-100">Thông tin phiếu</h3>

              {/* Supplier Dropdown */}
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase text-slate-400">Nhà cung cấp *</span>
                <div className="relative">
                  <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <select
                    required
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full h-10 rounded-xl border border-slate-200 pl-9 pr-3 text-sm font-semibold outline-none focus:border-slate-400 bg-white"
                  >
                    <option value="">Chọn nhà cung cấp</option>
                    {suppliers.map((sup) => (
                      <option key={sup.id} value={sup.id}>
                        {sup.name}
                      </option>
                    ))}
                  </select>
                </div>
              </label>

              {/* Note input */}
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase text-slate-400">Ghi chú phiếu</span>
                <div className="relative">
                  <FiFileText className="absolute left-3 top-3 text-slate-400" size={15} />
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    placeholder="Lý do nhập hàng, đợt khuyến mãi..."
                    className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-sm font-semibold outline-none focus:border-slate-400"
                  />
                </div>
              </label>

              {/* Paid Amount */}
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase text-slate-400">Đã trả trước (VND)</span>
                <div className="relative">
                  <FiDollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <input
                    type="number"
                    min={0}
                    value={paidAmount || ''}
                    onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full h-10 rounded-xl border border-slate-200 pl-9 pr-3 text-sm font-bold text-slate-700 outline-none focus:border-slate-400"
                  />
                </div>
              </label>

              <button
                type="button"
                onClick={handlePayInFull}
                disabled={totalAmount <= 0}
                className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-slate-600 hover:bg-slate-100 transition disabled:opacity-50"
              >
                Trả đủ toàn bộ
              </button>
            </div>

            {/* Sumary values */}
            <div className="border border-slate-300 bg-white p-5 shadow-sm space-y-3">
              <div className="flex justify-between items-center text-sm font-bold text-slate-500">
                <span>Tổng tiền hàng:</span>
                <span className="text-slate-800 font-black">{formatCurrency(totalAmount)}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-bold text-slate-500">
                <span>Đã thanh toán:</span>
                <span className="text-emerald-600 font-black">{formatCurrency(paidAmount)}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-bold text-slate-500 border-t border-dashed border-slate-100 pt-3">
                <span>Còn nợ nhà cung cấp:</span>
                <span className={`font-black ${remainingAmount > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                  {formatCurrency(remainingAmount)}
                </span>
              </div>

              {/* Status Alert Badge */}
              <div className="pt-2">
                <div className={`rounded-xl border p-3 flex gap-2.5 items-start ${
                  totalAmount <= 0 ? 'bg-slate-50 border-slate-200 text-slate-500' :
                  remainingAmount === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                  paidAmount > 0 ? 'bg-amber-50 border-amber-200 text-amber-700' :
                  'bg-red-50 border-red-200 text-red-700'
                }`}>
                  <FiInfo className="shrink-0 mt-0.5" size={16} />
                  <div className="text-xs font-semibold leading-relaxed">
                    {totalAmount <= 0 ? 'Chưa chọn sản phẩm nhập hàng.' :
                     remainingAmount === 0 ? 'Tạo phiếu & cập nhật thanh toán: Giao dịch thanh toán đầy đủ cho nhà cung cấp.' :
                     paidAmount > 0 ? `Đã trả trước một phần. Hệ thống sẽ ghi nhận công nợ ${formatCurrency(remainingAmount)} với đối tác.` :
                     `Chưa trả tiền. Hệ thống sẽ ghi nợ toàn bộ ${formatCurrency(totalAmount)} vào tài khoản nhà cung cấp.`
                    }
                  </div>
                </div>
              </div>
            </div>

            {/* Submit buttons */}
            <div className="flex flex-col gap-2">
              <button
                type="submit"
                disabled={submitLoading || selectedItems.length === 0 || hasIncompleteLot}
                className="w-full h-11 rounded-xl bg-blue-600 text-sm font-black text-white hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitLoading ? (
                  <>
                    <FiLoader className="animate-spin" size={16} />
                    Đang xử lý lưu phiếu...
                  </>
                ) : (
                  <>
                    <FiCheck size={16} />
                    Xác nhận nhập kho
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => navigate('/stock?tab=receipts')}
                className="w-full h-10 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                Hủy bỏ
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
