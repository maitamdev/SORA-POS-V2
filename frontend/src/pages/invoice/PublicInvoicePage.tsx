import { useEffect, useRef, useState } from 'react';
import { FiDownload, FiFileText, FiPrinter, FiRefreshCw } from 'react-icons/fi';
import { useParams } from 'react-router-dom';
import { orderAPI, PublicReceiptOrder } from '../../services/order.api';
import { buildInvoiceQrDataUrl } from '../pos/utils/posHelpers';

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
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
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
  const [invoiceQrCode, setInvoiceQrCode] = useState('');
  const [invoiceQrReady, setInvoiceQrReady] = useState(false);
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
    if (!order || !invoiceQrReady || !invoiceSourceRef.current) return undefined;

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
  }, [order, invoiceQrCode, invoiceQrReady]);

  useEffect(() => {
    let cancelled = false;
    setInvoiceQrCode('');
    setInvoiceQrReady(false);

    if (!order?.public_receipt_token) {
      setInvoiceQrReady(true);
      return undefined;
    }

    buildInvoiceQrDataUrl({
      storeName: 'SORA MART',
      orderId: order.id,
      publicReceiptToken: order.public_receipt_token,
      orderNumber: order.order_number,
      total: Number(order.total_amount || 0),
      finalAmount: Number(order.final_amount || 0),
      date: formatDate(order.created_at),
    }).then((dataUrl) => {
      if (!cancelled) {
        setInvoiceQrCode(dataUrl);
        setInvoiceQrReady(true);
      }
    });

    return () => {
      cancelled = true;
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
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#edf2f8] px-4">
        <div className="flex items-center gap-3 border border-slate-300 bg-white px-5 py-4 text-sm font-bold text-slate-600 shadow-sm">
          <FiRefreshCw className="animate-spin text-blue-600" /> Đang tải hóa đơn...
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#edf2f8] px-4">
        <div className="w-full max-w-md border border-slate-300 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center bg-slate-100 text-slate-500">
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
  const discount = Number(order.discount_amount || 0);

  const invoicePaper = (
    <div
      ref={invoiceSourceRef}
      className="w-[480px] overflow-hidden border border-slate-300 bg-white text-slate-900"
      style={{ colorScheme: 'light' }}
    >
      <div className="px-5 pb-4 pt-5">
        <div className="flex items-start justify-between gap-5">
          <div className="min-w-0">
            <h1 className="text-[17px] font-black uppercase leading-none tracking-tight text-slate-900">SORA MART</h1>
            <div className="mt-2 space-y-0.5 text-[9px] font-semibold leading-tight text-slate-500">
              <p>SORA POS</p>
              <p>Hệ thống bán hàng</p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <h2 className="text-[17px] font-black uppercase leading-none tracking-wide text-slate-900">HÓA ĐƠN</h2>
            <p className="mt-2 font-mono text-[9px] font-bold text-slate-600">{order.order_number}</p>
          </div>
        </div>
      </div>

      <div className="mx-5 border-t border-slate-300" />

      <div className="mx-5 grid grid-cols-[1.25fr_1fr_1.35fr] gap-3 py-3">
        <div className="min-w-0">
          <p className="text-[8px] font-black uppercase tracking-wide text-slate-500">Khách hàng</p>
          <p className="mt-1 truncate text-[10px] font-black text-slate-800">{order.customers?.name || 'Khách lẻ'}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[8px] font-black uppercase tracking-wide text-slate-500">Thu ngân</p>
          <p className="mt-1 truncate text-[10px] font-black text-slate-800">Quầy bán hàng</p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-[8px] font-black uppercase tracking-wide text-slate-500">Ngày giờ</p>
          <p className="mt-1 text-[10px] font-black text-slate-800">{formatDate(order.created_at)}</p>
        </div>
      </div>

      <div className="border-y border-slate-300">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="w-[46%] px-5 py-2 text-left text-[8px] font-black uppercase tracking-wide text-slate-600">Sản phẩm</th>
              <th className="w-[12%] px-1 py-2 text-center text-[8px] font-black uppercase tracking-wide text-slate-600">SL</th>
              <th className="w-[21%] px-1 py-2 text-right text-[8px] font-black uppercase tracking-wide text-slate-600">Đơn giá</th>
              <th className="w-[21%] px-5 py-2 text-right text-[8px] font-black uppercase tracking-wide text-slate-600">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {details.map((detail, index) => (
              <tr key={detail.id} className={index % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}>
                <td className="border-t border-slate-100 px-5 py-3 align-top">
                  <p className="break-words text-[10px] font-bold leading-snug text-slate-800">{detail.product_name}</p>
                </td>
                <td className="border-t border-slate-100 px-1 py-3 text-center align-top text-[10px] font-bold text-slate-700">{detail.quantity}</td>
                <td className="border-t border-slate-100 px-1 py-3 text-right align-top text-[10px] text-slate-600">{formatMoney(detail.unit_price)}</td>
                <td className="border-t border-slate-100 px-5 py-3 text-right align-top text-[10px] font-black text-slate-900">{formatMoney(detail.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end px-5 py-4">
        <div className="w-[220px] space-y-2 text-[10px]">
          <div className="flex justify-between gap-4 text-slate-500">
            <span className="font-semibold">Tạm tính:</span>
            <span className="font-bold text-slate-700">{formatMoney(order.total_amount)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between gap-4 text-rose-600">
              <span className="font-semibold">Giảm giá:</span>
              <span className="font-bold">-{formatMoney(discount)}</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-4 border-t border-slate-300 pt-2.5 text-[13px]">
            <span className="font-black text-slate-900">Tổng cộng:</span>
            <span className="font-black text-slate-950">{formatMoney(order.final_amount)}</span>
          </div>
        </div>
      </div>

      <div className="mx-5 flex justify-between gap-4 border-t border-slate-300 py-3.5 text-[10px]">
        <span className="font-semibold text-slate-500">Phương thức thanh toán:</span>
        <span className="text-right font-black text-slate-800">{paymentLabel(payment?.method)}</span>
      </div>

      <div className="border-t border-slate-200 bg-slate-50/50 px-5 pb-5 pt-5 text-center">
        <div className="mx-auto w-[150px] border border-slate-200 bg-white p-2">
          {invoiceQrCode ? (
            <img src={invoiceQrCode} alt="Mã QR xem hóa đơn online" className="block h-[134px] w-[134px] [image-rendering:pixelated]" />
          ) : (
            <div className="flex h-[134px] w-[134px] items-center justify-center text-[8px] font-bold uppercase tracking-wide text-slate-400">
              Đang tạo mã QR
            </div>
          )}
        </div>
        <p className="mt-2 text-[9px] font-black text-slate-700">Quét QR để xem hóa đơn online</p>
        <p className="mt-0.5 text-[8px] font-semibold text-slate-500">Mã hóa đơn: {order.order_number}</p>
        <div className="mt-4 border-t border-slate-200 pt-4">
          <p className="text-[11px] font-black text-slate-700">Cảm ơn quý khách đã mua sắm!</p>
          <p className="mt-1 text-[9px] font-semibold text-slate-500">Hẹn gặp lại quý khách.</p>
          <p className="mt-3 text-[7px] font-black uppercase tracking-[0.18em] text-slate-400">Powered by Sora POS</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-[#edf2f8] px-3 py-5 sm:px-5 sm:py-8" style={{ colorScheme: 'light' }}>
      <main className="mx-auto flex w-full max-w-[520px] flex-col items-center">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`Ảnh hóa đơn ${order.order_number}`}
            className="block w-full border border-slate-300 bg-white shadow-[0_4px_14px_rgba(71,85,105,0.12)]"
          />
        ) : (
          <div className="w-full overflow-x-auto pb-1">{invoicePaper}</div>
        )}

        {imageLoading && (
          <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-500">
            <FiRefreshCw className="animate-spin text-blue-600" /> Đang tạo ảnh hóa đơn...
          </p>
        )}

        {imageUrl && (
          <div className="mt-5 flex w-full flex-col justify-center gap-2 sm:flex-row">
            <button
              type="button"
              onClick={downloadImage}
              className="inline-flex h-10 items-center justify-center gap-2 bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 active:translate-y-px"
            >
              <FiDownload size={15} /> Tải ảnh hóa đơn
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-10 items-center justify-center gap-2 border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 active:translate-y-px"
            >
              <FiPrinter size={15} /> In hóa đơn
            </button>
          </div>
        )}

      </main>
    </div>
  );
};

export default PublicInvoicePage;
