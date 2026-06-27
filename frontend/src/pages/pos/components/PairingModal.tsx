import { useEffect, useRef } from 'react';
import { HiOutlineX } from 'react-icons/hi';
import { usePOSStore } from '../../../stores/pos.store';
import { useBarcodeScanner } from '../../../hooks/useBarcodeScanner';
import { getQRCode } from '../utils/posHelpers';

const PairingModal = () => {
  const showPairingModal = usePOSStore((s) => s.showPairingModal);
  const setShowPairingModal = usePOSStore((s) => s.setShowPairingModal);
  const { pairingCode } = useBarcodeScanner();
  const pairingQrCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (showPairingModal && pairingQrCanvasRef.current && pairingCode) {
      const pairingString = `sora-pos-scanner:pair:${pairingCode}|${import.meta.env.VITE_SUPABASE_URL || ''}|${import.meta.env.VITE_SUPABASE_ANON_KEY || ''}`;
      getQRCode().then((QR) => {
        if (!pairingQrCanvasRef.current) return;
        QR.toCanvas(
          pairingQrCanvasRef.current,
          pairingString,
          {
            width: 200,
            margin: 1.5,
            color: { dark: '#0f172a', light: '#ffffff' },
          },
          (err: Error | null | undefined) => {
            if (err) console.error('Lỗi tạo QR ghép đôi:', err);
          }
        );
      });
    }
  }, [showPairingModal, pairingCode]);

  if (!showPairingModal) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-[100] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-sm w-full text-white shadow-2xl flex flex-col items-center">
        <div className="flex justify-between items-center w-full mb-4">
          <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400">Kết nối máy quét ĐT</h3>
          <button
            onClick={() => setShowPairingModal(false)}
            className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition"
          >
            <HiOutlineX className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-white p-3 rounded-xl shadow-inner mb-4">
          <canvas ref={pairingQrCanvasRef}></canvas>
        </div>

        <p className="text-[11px] text-slate-400 text-center mb-4 leading-relaxed">
          Mở ứng dụng <strong className="text-white">Sora Scanner</strong> trên điện thoại và quét mã QR này để tự động thiết lập kết nối an toàn.
        </p>

        <div className="w-full bg-slate-950/50 border border-slate-800 p-3 rounded-xl flex flex-col items-center gap-1">
          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Mã Ghép Đôi</span>
          <span className="text-base font-black tracking-widest text-emerald-400 select-all">{pairingCode}</span>
        </div>
      </div>
    </div>
  );
};

export default PairingModal;
