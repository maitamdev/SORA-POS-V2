import { useEffect, useRef, useState, useCallback } from 'react';
import {
  HiOutlineShieldCheck,
  HiOutlineUser,
  HiOutlineCreditCard,
  HiOutlineDocumentText,
  HiOutlineDuplicate,
  HiOutlineArrowLeft,
  HiOutlineCheck,
  HiOutlineX,
} from 'react-icons/hi';
import toast from 'react-hot-toast';
import { usePOSStore, usePOSFinalAmount } from '../../../stores/pos.store';
import { money, getActiveBank, getBankLogoUrl, getQRCode, copyToClipboard } from '../utils/posHelpers';
import { buildVietQR } from '../../../utils/vietqr';
import api from '../../../services/api';

// Custom QrScanIcon
const QrScanIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7V5a2 2 0 012-2h2m10 0h2a2 2 0 012 2v2m0 10v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 12h10" />
  </svg>
);

// Animated check icon for success
const AnimatedCheck = () => (
  <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto animate-bounce">
    <HiOutlineCheck className="w-10 h-10 text-emerald-600 stroke-[3]" />
  </div>
);

interface TransferPaymentModalProps {
  onCheckout: (isTransferConfirmed?: boolean, isCheckoutConfirmed?: boolean) => void;
}

const TransferPaymentModal = ({ onCheckout }: TransferPaymentModalProps) => {
  const showTransferPayment = usePOSStore((s) => s.showTransferPayment);
  const operationSettings = usePOSStore((s) => s.operationSettings);
  const transferMemo = usePOSStore((s) => s.transferMemo);
  const loading = usePOSStore((s) => s.loading);
  const setShowTransferPayment = usePOSStore((s) => s.setShowTransferPayment);

  const finalAmount = usePOSFinalAmount();
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [logoError, setLogoError] = useState(false);

  // PayOS states
  const [payosOrderCode, setPayosOrderCode] = useState<number | null>(null);
  const [payosQrString, setPayosQrString] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'waiting' | 'paid'>('idle');
  const [usePayos, setUsePayos] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoCheckoutRef = useRef(false);
  const payosCanvasRef = useRef<HTMLCanvasElement>(null);

  const hasBankConfig = Boolean(
    operationSettings.bankBin &&
    operationSettings.bankAccountNumber &&
    operationSettings.bankAccountName
  );
  const activeBank = getActiveBank(operationSettings.bankBin || '');
  const bankLogoUrl = operationSettings.bankBin ? getBankLogoUrl(operationSettings.bankBin) : '';

  useEffect(() => {
    setLogoError(false);
  }, [operationSettings.bankBin]);

  // ─── Tạo PayOS payment link khi mở modal ───
  useEffect(() => {
    if (!showTransferPayment) {
      // Reset khi đóng modal
      setPayosOrderCode(null);
      setPayosQrString(null);
      setPaymentStatus('idle');
      setUsePayos(false);
      autoCheckoutRef.current = false;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    // Thử tạo PayOS link
    const createPayosLink = async () => {
      try {
        const res = await api.post('/payos/create', {
          amount: finalAmount,
          description: transferMemo || 'SORA POS',
        });

        if (res.data?.success && res.data?.data) {
          const { orderCode, qrCode } = res.data.data;
          setPayosOrderCode(orderCode);
          setPayosQrString(qrCode);
          setUsePayos(true);
          setPaymentStatus('waiting');
        }
      } catch (err) {
        // PayOS không khả dụng → fallback QR VietQR tĩnh
        console.log('[PayOS] Không khả dụng, dùng QR VietQR tĩnh');
        setUsePayos(false);
      }
    };

    createPayosLink();
  }, [showTransferPayment, finalAmount, transferMemo]);

  // ─── Render PayOS QR trên canvas ───
  useEffect(() => {
    if (usePayos && payosQrString && payosCanvasRef.current) {
      getQRCode().then((QR) => {
        if (!payosCanvasRef.current) return;
        QR.toCanvas(
          payosCanvasRef.current,
          payosQrString,
          {
            width: 240,
            margin: 1.5,
            color: { dark: '#0f172a', light: '#ffffff' },
          },
          (err: Error | null | undefined) => {
            if (err) console.error('Lỗi tạo QR PayOS:', err);
          }
        );
      });
    }
  }, [usePayos, payosQrString]);

  // ─── Polling check trạng thái thanh toán ───
  useEffect(() => {
    if (!usePayos || !payosOrderCode || paymentStatus !== 'waiting') return;

    const checkStatus = async () => {
      try {
        const res = await api.get(`/payos/status/${payosOrderCode}`);
        if (res.data?.success && res.data?.data?.status === 'PAID') {
          setPaymentStatus('paid');
          
          // Tự động checkout sau 2 giây
          if (!autoCheckoutRef.current) {
            autoCheckoutRef.current = true;
            setTimeout(() => {
              onCheckout(true, true);
            }, 2000);
          }
        }
      } catch {
        // Ignore polling errors
      }
    };

    // Check ngay lập tức
    checkStatus();

    // Polling mỗi 3 giây
    pollingRef.current = setInterval(checkStatus, 3000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [usePayos, payosOrderCode, paymentStatus, onCheckout]);

  // ─── Fallback: Draw QR VietQR tĩnh khi PayOS không khả dụng ───
  useEffect(() => {
    if (showTransferPayment && !usePayos && qrCanvasRef.current && hasBankConfig) {
      const qrString = buildVietQR({
        bankBin: operationSettings.bankBin,
        bankNumber: operationSettings.bankAccountNumber,
        amount: String(finalAmount),
        purpose: transferMemo,
      });

      getQRCode().then((QR) => {
        if (!qrCanvasRef.current) return;
        QR.toCanvas(
          qrCanvasRef.current,
          qrString,
          {
            width: 240,
            margin: 1.5,
            color: { dark: '#0f172a', light: '#ffffff' },
          },
          (err: Error | null | undefined) => {
            if (err) {
              console.error('Lỗi tạo QR VietQR:', err);
              toast.error('Không thể tạo mã QR thanh toán');
            }
          }
        );
      });
    }
  }, [showTransferPayment, usePayos, hasBankConfig, operationSettings, finalAmount, transferMemo]);

  if (!showTransferPayment) return null;

  const handleCopy = (text: string, label: string) => {
    copyToClipboard(text, label);
    toast.success(`Đã sao chép ${label}`);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-[24px] max-w-4xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
        <div className="flex flex-col md:flex-row min-h-[500px]">
          {/* Left: QR Code */}
          <div className="w-full md:w-[42%] bg-[#f4f7fc] p-8 flex flex-col justify-between items-center border-r border-slate-100/60">
            <div className="flex gap-3 items-start w-full">
              <div className="w-10 h-10 rounded-full bg-blue-100/50 flex items-center justify-center text-blue-600 flex-shrink-0 shadow-inner">
                <HiOutlineShieldCheck className="w-6 h-6" />
              </div>
              <div className="space-y-1 text-left">
                <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Thanh toán chuyển khoản</h3>
                <p className="text-xs font-semibold text-slate-400 leading-snug">
                  {usePayos
                    ? 'Quét mã QR để thanh toán. Hệ thống sẽ tự động xác nhận khi nhận được tiền.'
                    : 'Quét mã QR hoặc chuyển khoản theo thông tin bên cạnh để thanh toán.'}
                </p>
              </div>
            </div>

            {/* Payment Success State */}
            {paymentStatus === 'paid' ? (
              <div className="my-8 flex flex-col items-center gap-4">
                <AnimatedCheck />
                <div className="text-center">
                  <p className="text-lg font-black text-emerald-700">Đã nhận thanh toán!</p>
                  <p className="text-xs font-semibold text-slate-400 mt-1">Đang hoàn tất đơn hàng...</p>
                </div>
              </div>
            ) : (
              <div className="my-8 flex justify-center w-full">
                <div className="relative bg-white p-6 rounded-[24px] shadow-sm border border-slate-200/50 flex flex-col items-center justify-center w-[250px]">
                  <div className={`absolute -top-3 ${usePayos ? 'bg-emerald-600' : 'bg-[#e11d48]'} text-white px-3.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shadow-sm border border-white`}>
                    {usePayos ? '✦ PAYOS AUTO' : 'VIETQR'}
                  </div>
                  {!usePayos && !hasBankConfig ? (
                    <div className="w-[180px] h-[180px] flex items-center justify-center text-center text-xs font-bold text-amber-700 leading-relaxed px-4">
                      Chưa cấu hình tài khoản ngân hàng
                    </div>
                  ) : (
                    <>
                      <div className="relative p-3">
                        <div className="absolute top-0 left-0 w-5 h-5 border-t-[3px] border-l-[3px] border-blue-600 rounded-tl-md"></div>
                        <div className="absolute top-0 right-0 w-5 h-5 border-t-[3px] border-r-[3px] border-blue-600 rounded-tr-md"></div>
                        <div className="absolute bottom-0 left-0 w-5 h-5 border-b-[3px] border-l-[3px] border-blue-600 rounded-bl-md"></div>
                        <div className="absolute bottom-0 right-0 w-5 h-5 border-b-[3px] border-r-[3px] border-blue-600 rounded-br-md"></div>

                        {usePayos && payosQrString ? (
                          <canvas ref={payosCanvasRef} className="w-[180px] h-[180px]" />
                        ) : (
                          <canvas ref={qrCanvasRef} className="w-[180px] h-[180px]" />
                        )}
                      </div>
                      <div className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
                        <QrScanIcon className="w-4 h-4 text-slate-400" />
                        <span>Quét mã để thanh toán</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Status indicator */}
            {usePayos && paymentStatus === 'waiting' ? (
              <div className="flex items-center justify-center gap-2 bg-emerald-50 border border-emerald-200/60 px-4 py-2 rounded-full text-[10px] font-black text-emerald-700 uppercase tracking-wider shadow-sm self-center">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span>Đang chờ thanh toán — Tự động xác nhận</span>
              </div>
            ) : !usePayos ? (
              <div className="flex items-center justify-center gap-1.5 bg-white border border-slate-200/60 px-4 py-1.5 rounded-full text-[10px] font-black text-blue-700 uppercase tracking-wider shadow-sm self-center">
                <HiOutlineShieldCheck className="w-4 h-4 text-green-500 fill-green-50" />
                <span>NAPAS 247</span>
              </div>
            ) : null}
          </div>

          {/* Right: Account Details */}
          <div className="w-full md:w-[58%] bg-white p-8 flex flex-col justify-between relative">
            <button
              onClick={() => setShowTransferPayment(false)}
              className="absolute top-6 right-6 w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 flex items-center justify-center transition"
              aria-label="Thoát"
            >
              <HiOutlineX className="w-4 h-4" />
            </button>

            <div className="space-y-4 pr-1 text-left">
              {/* Bank info */}
              <div className="flex items-center gap-3.5 pb-2 border-b border-slate-100">
                <div className="w-12 h-12 rounded-full border border-slate-200/60 flex items-center justify-center bg-white flex-shrink-0 shadow-sm overflow-hidden relative">
                  {bankLogoUrl && !logoError ? (
                    <img
                      src={bankLogoUrl}
                      alt={activeBank ? activeBank.shortName : 'Bank'}
                      className="w-full h-full object-contain p-2"
                      onError={() => setLogoError(true)}
                    />
                  ) : (
                    <div className="w-full h-full bg-blue-600 flex items-center justify-center text-white">
                      <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2a1.5 1.5 0 011.5 1.5V6a1.5 1.5 0 01-3 0V3.5A1.5 1.5 0 0112 2zm0 16a1.5 1.5 0 011.5 1.5v2.5a1.5 1.5 0 01-3 0V19.5A1.5 1.5 0 0112 18zm-8-7.5A1.5 1.5 0 015.5 9H8a1.5 1.5 0 010 3H5.5a1.5 1.5 0 01-1.5-1.5zm14 0a1.5 1.5 0 011.5-1.5h2.5a1.5 1.5 0 010 3H19.5A1.5 1.5 0 0118 10.5zM6.343 6.343a1.5 1.5 0 012.122 0l1.768 1.768a1.5 1.5 0 11-2.122 2.121L6.343 8.464a1.5 1.5 0 010-2.121zm9.9 9.9a1.5 1.5 0 012.12 0l1.769 1.768a1.5 1.5 0 11-2.121 2.122l-1.768-1.769a1.5 1.5 0 010-2.121zm-9.9 2.121a1.5 1.5 0 010 2.122l-1.768 1.768a1.5 1.5 0 11-2.122-2.121l1.768-1.768a1.5 1.5 0 012.122 0zm9.9-9.9a1.5 1.5 0 010 2.121l-1.768 1.769a1.5 1.5 0 11-2.121-2.122l1.768-1.768a1.5 1.5 0 012.121 0z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Ngân hàng thụ hưởng</p>
                  <span className="font-extrabold text-slate-800 text-sm mt-0.5 block">
                    {activeBank ? `${activeBank.shortName} - ${activeBank.name}` : 'Chưa cấu hình ngân hàng'}
                  </span>
                </div>
              </div>

              {/* Details cards */}
              <div className="space-y-3">
                {/* Account number */}
                <div className="bg-white border border-slate-200/50 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
                      <HiOutlineUser className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400">Số tài khoản</p>
                      <p className="font-mono font-black text-slate-800 text-sm mt-0.5">
                        {operationSettings.bankAccountNumber || 'Chưa cấu hình'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => operationSettings.bankAccountNumber && handleCopy(operationSettings.bankAccountNumber, 'Số tài khoản')}
                    disabled={!operationSettings.bankAccountNumber}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition"
                    title="Sao chép số tài khoản"
                  >
                    <HiOutlineDuplicate className="w-5 h-5" />
                  </button>
                </div>

                {/* Account name */}
                <div className="bg-white border border-slate-200/50 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
                      <HiOutlineUser className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400">Chủ tài khoản</p>
                      <p className="font-black text-slate-800 uppercase text-sm mt-0.5">
                        {operationSettings.bankAccountName || 'Chưa cấu hình'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => operationSettings.bankAccountName && handleCopy(operationSettings.bankAccountName, 'Tên chủ tài khoản')}
                    disabled={!operationSettings.bankAccountName}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition"
                  >
                    <HiOutlineDuplicate className="w-5 h-5" />
                  </button>
                </div>

                {/* Amount */}
                <div className="bg-white border border-slate-200/50 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
                      <HiOutlineCreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400">Số tiền thanh toán</p>
                      <p className="font-black text-blue-600 text-base mt-0.5">{money(finalAmount, operationSettings.currency, operationSettings.locale)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCopy(String(finalAmount), 'Số tiền')}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition"
                  >
                    <HiOutlineDuplicate className="w-5 h-5" />
                  </button>
                </div>

                {/* Memo */}
                <div className="bg-amber-50/40 border border-amber-200/60 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-full bg-amber-100/60 flex items-center justify-center text-amber-600 flex-shrink-0">
                      <HiOutlineDocumentText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-amber-600">Nội dung chuyển khoản (Memo)</p>
                      <p className="font-mono font-black text-slate-800 text-sm mt-0.5">{transferMemo}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCopy(transferMemo, 'Nội dung chuyển khoản')}
                    className="p-2 text-amber-500 hover:text-amber-700 hover:bg-amber-100 rounded-xl transition"
                  >
                    <HiOutlineDuplicate className="w-5 h-5 text-amber-600" />
                  </button>
                </div>
              </div>

              {/* Info banner */}
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-blue-50/70 border border-blue-100/50">
                <HiOutlineShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <p className="text-[11px] font-semibold text-blue-700 leading-relaxed">
                  {usePayos
                    ? 'Hệ thống PayOS sẽ tự động xác nhận khi nhận được chuyển khoản. Không cần bấm thủ công.'
                    : 'Vui lòng nhập đúng nội dung chuyển khoản để được xác nhận nhanh chóng.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row gap-3 p-6 border-t border-slate-200 bg-slate-50/80">
          <button
            onClick={() => setShowTransferPayment(false)}
            className="flex-1 py-4 bg-white border border-slate-200/80 hover:bg-slate-50 text-slate-700 text-sm font-black rounded-2xl flex items-center justify-center gap-2 shadow-sm transition"
          >
            <HiOutlineArrowLeft className="w-4.5 h-4.5 text-slate-500" />
            <span>Quay lại</span>
          </button>
          <button
            onClick={() => onCheckout(true, true)}
            disabled={loading || paymentStatus === 'paid' || (!usePayos && !hasBankConfig)}
            className={`flex-1 sm:flex-[1.8] flex flex-col items-center justify-center py-2.5 rounded-2xl shadow-md transition disabled:opacity-50 ${
              paymentStatus === 'paid'
                ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
            }`}
          >
            <div className="flex items-center gap-2">
              <HiOutlineCheck className="w-5 h-5 stroke-[3]" />
              <span className="text-sm font-black">
                {paymentStatus === 'paid' ? 'Đã xác nhận tự động ✓' : 'Tôi đã chuyển khoản'}
              </span>
            </div>
            <span className={`text-[10px] font-bold mt-0.5 ${
              paymentStatus === 'paid' ? 'text-emerald-200/90' : 'text-blue-200/90'
            }`}>
              {paymentStatus === 'paid' ? 'Đơn hàng đang được hoàn tất' : 'Nhấn F9 để xác nhận nhanh'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransferPaymentModal;
