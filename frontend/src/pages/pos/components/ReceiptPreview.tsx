import { useEffect, useRef, useState } from 'react';
import { HiOutlineCheck } from 'react-icons/hi';
import toast from 'react-hot-toast';
import { usePOSStore } from '../../../stores/pos.store';
import { orderAPI } from '../../../services/order.api';
import { money, CartItem, buildInvoiceQrDataUrl } from '../utils/posHelpers';

interface ReceiptPreviewProps {
  onPrintInvoice: (orderNumber?: string, savedCart?: CartItem[]) => void;
}

const ReceiptPreview = ({ onPrintInvoice }: ReceiptPreviewProps) => {
  const checkoutSuccessInfo = usePOSStore((s) => s.checkoutSuccessInfo);
  const operationSettings = usePOSStore((s) => s.operationSettings);
  const customerEmail = usePOSStore((s) => s.customerEmail);
  const isSendingEmail = usePOSStore((s) => s.isSendingEmail);
  const setCheckoutSuccessInfo = usePOSStore((s) => s.setCheckoutSuccessInfo);
  const setCustomerEmail = usePOSStore((s) => s.setCustomerEmail);
  const setIsSendingEmail = usePOSStore((s) => s.setIsSendingEmail);
  const autoPrintedOrderRef = useRef<string | null>(null);
  const [invoiceQrCode, setInvoiceQrCode] = useState('');

  useEffect(() => {
    if (!checkoutSuccessInfo || !operationSettings.autoPrintReceipt) return undefined;
    if (autoPrintedOrderRef.current === checkoutSuccessInfo.orderNumber) return undefined;

    autoPrintedOrderRef.current = checkoutSuccessInfo.orderNumber;
    const timer = window.setTimeout(() => {
      const savedCart = Array.isArray(checkoutSuccessInfo.cart) ? checkoutSuccessInfo.cart : [];
      onPrintInvoice(checkoutSuccessInfo.orderNumber, savedCart);
    }, 200);

    return () => window.clearTimeout(timer);
  }, [checkoutSuccessInfo, onPrintInvoice, operationSettings.autoPrintReceipt]);

  useEffect(() => {
    let cancelled = false;
    setInvoiceQrCode('');

    if (!checkoutSuccessInfo) return () => { cancelled = true; };

    buildInvoiceQrDataUrl({
      storeName: operationSettings.storeName,
      orderNumber: checkoutSuccessInfo.orderNumber,
      total: checkoutSuccessInfo.total,
      finalAmount: checkoutSuccessInfo.finalAmount,
      date: checkoutSuccessInfo.date,
      currency: operationSettings.currency,
      locale: operationSettings.locale,
    }).then((dataUrl) => {
      if (!cancelled) setInvoiceQrCode(dataUrl);
    });

    return () => { cancelled = true; };
  }, [
    checkoutSuccessInfo?.orderNumber,
    checkoutSuccessInfo?.total,
    checkoutSuccessInfo?.finalAmount,
    checkoutSuccessInfo?.date,
    operationSettings.storeName,
    operationSettings.currency,
    operationSettings.locale,
  ]);

  if (!checkoutSuccessInfo) return null;

  const info = checkoutSuccessInfo;
  const cart = Array.isArray(info.cart) ? info.cart : [];
  const storeName = operationSettings.storeName || 'SORA MART';

  const handleDownloadInvoice = async () => {
    const el = document.getElementById('invoice-preview-card');
    if (!el) return;
    try {
      const { default: html2canvas } = await import('html2canvas-pro');
      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      });
      const link = document.createElement('a');
      link.download = `${info.orderNumber}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('Đã tải hóa đơn!');
    } catch {
      toast.error('Lỗi khi tải hóa đơn');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
      <div className="bg-slate-100 rounded-md max-w-[700px] w-full max-h-[92vh] flex flex-col shadow-xl overflow-hidden border border-slate-200">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-300">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-emerald-600 rounded flex items-center justify-center shadow-sm">
              <HiOutlineCheck className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 uppercase tracking-wider">Thanh toán thành công</p>
              <p className="text-[10px] font-semibold text-slate-500 mt-0.5">{info.orderNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadInvoice}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded shadow-sm transition uppercase tracking-wider"
            >
              Tải xuống
            </button>
            <button
              onClick={() => onPrintInvoice(info.orderNumber, cart)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold rounded shadow-sm transition uppercase tracking-wider"
            >
              In hóa đơn
            </button>
            <button
              onClick={() => setCheckoutSuccessInfo(null)}
              className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold rounded border border-slate-300 transition uppercase tracking-wider"
            >
              Đơn mới
            </button>
          </div>
        </div>

        {/* Email form */}
        {info.orderId && (
          <div className="px-5 py-3 bg-blue-50/50 border-b border-slate-300 flex items-center gap-3">
            <p className="text-[11px] font-bold text-slate-700 whitespace-nowrap">Gửi email hóa đơn:</p>
            <input
              type="email"
              placeholder="Nhập email nhận hóa đơn..."
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={async () => {
                if (!customerEmail.trim()) {
                  toast.error('Vui lòng nhập địa chỉ email');
                  return;
                }
                setIsSendingEmail(true);
                try {
                  await orderAPI.sendInvoiceEmail(info.orderId!, customerEmail);
                  toast.success('Đã gửi email hóa đơn thành công!');
                } catch (err: any) {
                  toast.error(err.response?.data?.message || 'Gửi email thất bại');
                } finally {
                  setIsSendingEmail(false);
                }
              }}
              disabled={isSendingEmail}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded shadow-sm transition disabled:opacity-50"
            >
              {isSendingEmail ? 'Đang gửi...' : 'Gửi'}
            </button>
          </div>
        )}

        {/* Invoice Preview */}
        <div className="flex-1 overflow-y-auto p-5">
          <div id="invoice-preview-card" className="bg-white rounded border border-slate-300 shadow-sm overflow-hidden mx-auto max-w-[640px]">
            {/* Invoice Header */}
            <div className="p-7 pb-6">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight uppercase leading-none">{storeName}</h1>
                  <div className="mt-2 space-y-0.5">
                    {operationSettings.branchName && <p className="text-[11px] text-slate-500 font-medium">{operationSettings.branchName}</p>}
                    {operationSettings.address && <p className="text-[11px] text-slate-500 font-medium">{operationSettings.address}</p>}
                    {operationSettings.hotline && <p className="text-[11px] text-slate-500 font-medium">SĐT: {operationSettings.hotline}</p>}
                    {operationSettings.taxCode && <p className="text-[11px] text-slate-500 font-medium">MST: {operationSettings.taxCode}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <h2 className="text-xl font-bold text-slate-900 tracking-wider uppercase leading-none">HÓA ĐƠN</h2>
                  <p className="text-xs font-semibold text-slate-700 mt-1">{info.orderNumber}</p>
                </div>
              </div>
            </div>

            {/* Billing Info */}
            <div className="mx-7 border-t border-b border-slate-300 py-3 grid grid-cols-3 gap-5">
              <div>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Khách hàng</p>
                <p className="text-xs font-bold text-slate-800">{info.customerName}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Thu ngân</p>
                <p className="text-xs font-bold text-slate-800">{info.cashierName}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Ngày giờ</p>
                <p className="text-xs font-bold text-slate-800">{info.date}</p>
              </div>
            </div>

            {/* Items Table */}
            <div className="mt-1">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-300">
                    <th className="text-left px-7 py-2.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider bg-slate-50" style={{width: '44%'}}>Sản phẩm</th>
                    <th className="text-center px-3 py-2.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider bg-slate-50" style={{width: '12%'}}>SL</th>
                    <th className="text-right px-3 py-2.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider bg-slate-50" style={{width: '22%'}}>Đơn giá</th>
                    <th className="text-right px-7 py-2.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider bg-slate-50" style={{width: '22%'}}>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item, idx) => (
                    <tr key={idx} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'} border-b border-slate-100`}>
                      <td className="px-7 py-2.5">
                        <p className="text-[12px] font-semibold text-slate-800">{item.product.name}</p>
                        {item.product.sku && <p className="text-[9px] text-slate-400 font-medium mt-0.5">{item.product.sku}</p>}
                      </td>
                      <td className="text-center px-3 py-2.5 text-[12px] font-semibold text-slate-700">{item.quantity}</td>
                      <td className="text-right px-3 py-2.5 text-[12px] text-slate-600">{money(item.product.sell_price, operationSettings.currency, operationSettings.locale)}</td>
                      <td className="text-right px-7 py-2.5 text-[12px] font-bold text-slate-900">{money(Number(item.product.sell_price) * item.quantity, operationSettings.currency, operationSettings.locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end px-7 py-4">
              <div className="w-64 space-y-1.5">
                <div className="flex justify-between text-[12px]">
                  <span className="text-slate-500 font-semibold">Tạm tính:</span>
                  <span className="font-bold text-slate-700">{money(cart.reduce((s, i) => s + Number(i.product.sell_price) * i.quantity, 0), operationSettings.currency, operationSettings.locale)}</span>
                </div>
                {info.discountAmount > 0 && (
                  <div className="flex justify-between text-[12px]">
                    <span className="text-slate-500 font-semibold">Chiết khấu:</span>
                    <span className="font-bold text-red-600">-{money(info.discountAmount, operationSettings.currency, operationSettings.locale)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center border-t border-slate-300 pt-2 mt-1">
                  <span className="text-sm font-bold text-slate-900">Tổng cộng:</span>
                  <span className="text-base font-bold text-slate-900">{money(info.finalAmount, operationSettings.currency, operationSettings.locale)}</span>
                </div>
              </div>
            </div>

            {/* Payment Info */}
            <div className="mx-7 border-t border-slate-300 py-3.5 space-y-1.5">
              <div className="flex justify-between text-[12px]">
                <span className="text-slate-500 font-semibold">Phương thức thanh toán:</span>
                <span className="font-bold text-slate-800">
                  {info.paymentMethod === 'cash' ? 'Tiền mặt' : info.paymentMethod === 'transfer' ? 'Chuyển khoản QR' : 'Thẻ ngân hàng'}
                </span>
              </div>
              {info.paymentMethod === 'cash' && (
                <>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-slate-500 font-semibold">Khách đưa:</span>
                    <span className="font-bold text-slate-800">{money(info.receivedAmount, operationSettings.currency, operationSettings.locale)}</span>
                  </div>
                  {info.change > 0 && (
                    <div className="flex justify-between text-[12px]">
                      <span className="text-slate-500 font-semibold">Tiền thừa:</span>
                      <span className="font-bold text-emerald-700">{money(info.change, operationSettings.currency, operationSettings.locale)}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Loyalty Points */}
            {info.customerName !== 'Khách lẻ' && info.pointsBefore !== undefined && (
              <div className="mx-7 border-t border-slate-200 py-3.5 space-y-1.5 bg-blue-50/20 px-4 rounded-xl border border-blue-100/50 mb-3">
                <div className="flex justify-between text-[12px]">
                  <span className="text-blue-600/70 font-semibold">Điểm tích lũy trước:</span>
                  <span className="font-bold text-slate-700">{info.pointsBefore} điểm</span>
                </div>
                {info.pointsUsed !== undefined && info.pointsUsed > 0 && (
                  <div className="flex justify-between text-[12px]">
                    <span className="text-red-500 font-semibold">Điểm đã sử dụng:</span>
                  <span className="font-bold text-red-600">-{info.pointsUsed} điểm</span>
                  </div>
                )}
                <div className="flex justify-between text-[12px]">
                  <span className="text-emerald-600 font-semibold">Điểm tích lũy mới:</span>
                  <span className="font-bold text-emerald-600">+{info.pointsEarned} điểm</span>
                </div>
                <div className="flex justify-between text-[12px] border-t border-slate-200/60 pt-1.5 mt-1 font-black">
                  <span className="text-slate-800">Số dư điểm hiện tại:</span>
                  <span className="text-blue-600">{info.pointsAfter} điểm</span>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="text-center py-5 bg-slate-50/60 border-t border-slate-200">
              {invoiceQrCode && (
                <div className="mx-auto mb-4 border-t border-slate-200 pt-4">
                  <img
                    src={invoiceQrCode}
                    alt="QR thông tin hóa đơn"
                    className="mx-auto h-32 w-32 [image-rendering:pixelated]"
                  />
                  <p className="mt-1 text-[10px] font-bold text-slate-700">Quét QR để xem thông tin hóa đơn</p>
                  <p className="mt-0.5 text-[9px] text-slate-500">Mã hóa đơn: {info.orderNumber}</p>
                </div>
              )}
              <p className="text-xs font-bold text-slate-700">{operationSettings.receiptFooter || 'Cảm ơn quý khách đã mua sắm!'}</p>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">Hẹn gặp lại quý khách!</p>
              <p className="text-[8px] text-slate-400 font-bold mt-3 uppercase tracking-wider">Powered by Sora POS</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReceiptPreview;
