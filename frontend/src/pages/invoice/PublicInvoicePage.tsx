import { useEffect, useRef, useState } from 'react';
import { FiCheckCircle, FiDownload, FiFileText, FiPrinter, FiRefreshCw, FiShield } from 'react-icons/fi';
import { useParams } from 'react-router-dom';
import { orderAPI, PublicReceiptOrder } from '../../services/order.api';

const formatMoney = (value: number | string | null | undefined) => {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
};

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN');
};

const paymentLabel = (method?: string) => {
  switch (method) {
    case 'transfer':
      return 'Chuyển khoản QR';
    case 'card':
      return 'Thẻ ngân hàng';
    case 'momo':
      return 'Ví MoMo';
    case 'zalopay':
      return 'Ví ZaloPay';
    default:
      return 'Tiền mặt';
  }
};

const getErrorMessage = (error: unknown) => {
  const responseMessage = (error as { response?: { data?: { message?: string } } })
    ?.response?.data?.message;
  return responseMessage || 'Liên kết hóa đơn không hợp lệ hoặc đã hết hạn.';
};

const PublicInvoicePage = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const token = new URLSearchParams(window.location.search).get('token') || '';
  const invoiceSourceRef = useRef<HTMLDivElement>(null);
  const [order, setOrder] = useState<PublicReceiptOrder | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [imageLoading, setImageLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadInvoice = async () => {
      if (!orderId || !token) {
        setError('Thiếu mã truy cập hóa đơn. Vui lòng quét lại mã QR trên hóa đơn.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');
        const response = await orderAPI.getPublicReceipt(orderId, token);
        if (!cancelled) setOrder(response.data.data);
      } catch (requestError) {
        if (!cancelled) setError(getErrorMessage(requestError));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadInvoice();
    return () => {
      cancelled = true;
    };
  }, [orderId, token]);

  useEffect(() => {
    if (!order || !invoiceSourceRef.current) return undefined;

    let cancelled = false;
    setImageLoading(true);
    setImageUrl('');

    const timer = window.setTimeout(async () => {
      try {
        const { default: html2canvas } = await import('html2canvas-pro');
        const canvas = await html2canvas(invoiceSourceRef.current!, {
          scale: 2,
          backgroundColor: '#ffffff',
          useCORS: true,
        });
        if (!cancelled) setImageUrl(canvas.toDataURL('image/png'));
      } catch (captureError) {
        console.error('[PublicInvoice] Không thể tạo ảnh hóa đơn:', captureError);
      } finally {
        if (!cancelled) setImageLoading(false);
      }
    }, 150);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [order]);

  const downloadImage = () => {
    if (!imageUrl || !order) return;
    const link = document.createElement('a');
    link.download = `${order.order_number}.png`;
    link.href = imageUrl;
    link.click();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 text-sm font-bold text-slate-600 shadow-sm">
          <FiRefreshCw className="animate-spin text-blue-600" /> Đang tải hóa đơn...
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-md rounded-2xl border border-rose-100 bg-white p-8 text-center shadow-xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-500">
            <FiFileText size={25} />
          </div>
          <h1 className="mt-5 text-xl font-black text-slate-900">Không thể mở hóa đơn</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{error || 'Hóa đơn không tồn tại.'}</p>
          <p className="mt-6 text-xs font-semibold text-slate-400">Vui lòng quét lại mã QR trên hóa đơn gốc.</p>
        </div>
      </div>
    );
  }

  const details = Array.isArray(order.order_details) ? order.order_details : [];
  const payment = order.payments?.[0];
  const subtotal = details.reduce((sum, detail) => sum + Number(detail.unit_price || 0) * Number(detail.quantity || 0), 0);
  const discount = Number(order.discount_amount || 0);

  return (
    <div className="min-h-screen bg-[#eef3fb] px-4 py-6 sm:px-6 lg:py-10">
      <main className="mx-auto w-full max-w-2xl">
        <header className="mb-5 flex items-center justify-between gap-4 rounded-2xl bg-slate-950 px-5 py-4 text-white shadow-lg sm:px-7">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-300">SORA POS</p>
            <h1 className="mt-1 text-lg font-black sm:text-xl">Hóa đơn của bạn</h1>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-900/30">
            <FiCheckCircle size={22} />
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Đã thanh toán</p>
              <p className="mt-1 text-sm font-black text-slate-900">#{order.order_number}</p>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">
              <FiShield size={13} /> Hóa đơn hợp lệ
            </div>
          </div>

          {imageUrl ? (
            <img
              src={imageUrl}
              alt={`Ảnh hóa đơn ${order.order_number}`}
              className="mx-auto block w-full max-w-[720px] rounded-xl border border-slate-200 bg-white shadow-sm"
            />
          ) : (
            <div ref={invoiceSourceRef} className="mx-auto max-w-[720px] overflow-hidden border border-slate-200 bg-white text-slate-900 shadow-sm">
              <div className="bg-slate-950 px-7 py-7 text-center text-white sm:px-10">
                <p className="text-xl font-black tracking-wide">SORA MART</p>
                <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.28em] text-blue-300">Hóa đơn bán hàng</p>
                <p className="mt-4 text-xs font-bold text-slate-300">Mã hóa đơn: {order.order_number}</p>
              </div>

              <div className="p-7 sm:p-10">
                <div className="grid grid-cols-2 gap-5 border-b border-slate-200 pb-5 text-xs">
                  <div>
                    <p className="font-bold uppercase tracking-wide text-slate-400">Khách hàng</p>
                    <p className="mt-1 font-black text-slate-800">{order.customers?.name || 'Khách lẻ'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold uppercase tracking-wide text-slate-400">Ngày mua</p>
                    <p className="mt-1 font-black text-slate-800">{formatDate(order.created_at)}</p>
                  </div>
                </div>

                <table className="mt-5 w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] font-black uppercase tracking-wide text-slate-400">
                      <th className="pb-3 text-left">Sản phẩm</th>
                      <th className="pb-3 text-center">SL</th>
                      <th className="pb-3 text-right">Đơn giá</th>
                      <th className="pb-3 text-right">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.map((detail) => (
                      <tr key={detail.id} className="border-b border-slate-100">
                        <td className="py-3 pr-2 font-bold text-slate-800">{detail.product_name}</td>
                        <td className="py-3 text-center font-semibold text-slate-600">{detail.quantity}</td>
                        <td className="py-3 text-right text-slate-600">{formatMoney(detail.unit_price)}</td>
                        <td className="py-3 text-right font-black text-slate-900">{formatMoney(detail.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="ml-auto mt-6 w-full max-w-xs space-y-2 text-xs">
                  <div className="flex justify-between gap-4 text-slate-500"><span>Tạm tính</span><strong>{formatMoney(subtotal)}</strong></div>
                  {discount > 0 && <div className="flex justify-between gap-4 text-rose-600"><span>Giảm giá</span><strong>-{formatMoney(discount)}</strong></div>}
                  <div className="flex justify-between gap-4 border-t border-slate-300 pt-3 text-sm font-black text-slate-950"><span>Tổng thanh toán</span><strong>{formatMoney(order.final_amount)}</strong></div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-5 border-t border-slate-200 pt-5 text-xs">
                  <div><span className="text-slate-400">Thanh toán</span><p className="mt-1 font-black text-slate-800">{paymentLabel(payment?.method)}</p></div>
                  <div className="text-right"><span className="text-slate-400">Trạng thái</span><p className="mt-1 font-black text-emerald-600">Đã thanh toán</p></div>
                </div>

                {(Number(order.loyalty_points_earned || 0) > 0 || Number(order.loyalty_points_used || 0) > 0) && (
                  <div className="mt-5 rounded-lg bg-blue-50 px-4 py-3 text-xs font-bold text-blue-700">
                    Tích điểm: +{Number(order.loyalty_points_earned || 0)} điểm
                    {Number(order.loyalty_points_used || 0) > 0 && ` · Đã dùng ${Number(order.loyalty_points_used || 0)} điểm`}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 bg-slate-50 px-7 py-5 text-center sm:px-10">
                <p className="text-xs font-black text-slate-700">Cảm ơn quý khách đã mua sắm!</p>
                <p className="mt-1 text-[10px] font-semibold text-slate-400">Hẹn gặp lại quý khách.</p>
              </div>
            </div>
          )}

          {imageLoading && (
            <p className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold text-slate-400">
              <FiRefreshCw className="animate-spin" /> Đang tạo ảnh hóa đơn...
            </p>
          )}

          {imageUrl && (
            <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
              <button
                type="button"
                onClick={downloadImage}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700"
              >
                <FiDownload size={16} /> Tải ảnh hóa đơn
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                <FiPrinter size={16} /> In hóa đơn
              </button>
            </div>
          )}
        </section>

        <p className="mt-5 flex items-center justify-center gap-2 text-center text-[11px] font-semibold text-slate-400">
          <FiShield size={13} /> Trang xem hóa đơn an toàn · Số điện thoại khách hàng không được hiển thị
        </p>
      </main>
    </div>
  );
};

export default PublicInvoicePage;
