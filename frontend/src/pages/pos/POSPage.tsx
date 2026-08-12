import { useEffect } from 'react';
import { useAuthStore } from '../../stores/auth.store';
import { usePOSStore } from '../../stores/pos.store';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';

// Hooks
import { usePOSProducts } from './hooks/usePOSProducts';
import { usePOSBarcode } from './hooks/usePOSBarcode';
import { usePOSCheckout } from './hooks/usePOSCheckout';
import { usePOSHotkeys } from './hooks/usePOSHotkeys';

// Components
import ShiftGuard from './components/ShiftGuard';
import POSHeader from './components/POSHeader';
import ProductGrid from './components/ProductGrid';
import CartPanel from './components/CartPanel';
import CheckoutFooter from './components/CheckoutFooter';
import CashPaymentModal from './components/CashPaymentModal';
import TransferPaymentModal from './components/TransferPaymentModal';
import CheckoutConfirmModal from './components/CheckoutConfirmModal';
import ClearCartModal from './components/ClearCartModal';
import ReceiptPreview from './components/ReceiptPreview';
import PairingModal from './components/PairingModal';

const POSPage = () => {
  const { user } = useAuthStore();
  const { scannedBarcode } = useBarcodeScanner();

  // Store selectors
  const activeShift = usePOSStore((s) => s.activeShift);
  const shiftLoading = usePOSStore((s) => s.shiftLoading);
  const openingCash = usePOSStore((s) => s.openingCash);
  const operationSettings = usePOSStore((s) => s.operationSettings);
  const showTransferPayment = usePOSStore((s) => s.showTransferPayment);
  const showCheckoutConfirm = usePOSStore((s) => s.showCheckoutConfirm);
  const paymentMethod = usePOSStore((s) => s.paymentMethod);
  const setOpeningCash = usePOSStore((s) => s.setOpeningCash);

  const isCashierShiftRequired = user?.role === 'cashier';

  // ── Initialize hooks ──
  const { loadProducts } = usePOSProducts();
  const { submitBarcode, handleBarcodeSubmit, focusBarcodeInput } = usePOSBarcode();
  const {
    checkout,
    handlePhoneChange,
    handleClearCart,
    handlePrintInvoice,
    handleCheckInShift,
    loadActiveShift,
  } = usePOSCheckout(loadProducts);

  // ── Load active shift on mount ──
  useEffect(() => {
    loadActiveShift();
  }, [user?.role]);

  // ── Focus barcode input when ready ──
  useEffect(() => {
    if (user?.role !== 'cashier' || activeShift?.status === 'checked_in') {
      focusBarcodeInput();
    }
  }, [user?.role, activeShift?.status]);

  // ── Handle scanned barcode from phone scanner ──
  useEffect(() => {
    if (scannedBarcode) {
      // Shift check before processing
      if (user?.role === 'cashier' && activeShift?.status !== 'checked_in') {
        import('react-hot-toast').then(({ default: toast }) => {
          toast.error('Vui lòng nhận ca trước khi quét bán hàng');
        });
        return;
      }
      submitBarcode(scannedBarcode);
    }
  }, [scannedBarcode]);

  // ── Sync receivedAmount for non-cash payments ──
  useEffect(() => {
    if (paymentMethod !== 'cash') {
      usePOSStore.getState().setReceivedAmount(
        usePOSStore.getState().cart.reduce(
          (sum, item) => sum + Number(item.product.sell_price) * item.quantity, 0
        )
      );
    }
  }, [paymentMethod]);

  // ── Keyboard hotkeys ──
  usePOSHotkeys({
    submitBarcode,
    onCheckout: () => {
      if (paymentMethod === 'transfer' && showTransferPayment) {
        checkout(true, true);
      } else if (showCheckoutConfirm) {
        checkout(false, true);
      } else {
        checkout(false, false);
      }
    },
    focusBarcodeInput,
  });

  // ── Logo error reset on bank change ──
  useEffect(() => {
    usePOSStore.getState().setLogoError(false);
  }, [operationSettings.bankBin]);

  // ── Shift Guard (early return screens) ──
  const shiftGuard = (
    <ShiftGuard
      activeShift={activeShift}
      shiftLoading={shiftLoading}
      isCashierShiftRequired={isCashierShiftRequired}
      openingCash={openingCash}
      onOpeningCashChange={setOpeningCash}
      onCheckIn={handleCheckInShift}
    />
  );

  if (shiftGuard.props.isCashierShiftRequired) {
    // Check if shift guard should render instead of main UI
    if (shiftLoading && !activeShift) return shiftGuard;
    if (!activeShift) return shiftGuard;
    if (activeShift.status === 'opened') return shiftGuard;
    if (activeShift.status === 'closed') return shiftGuard;
  }

  // ── Main POS UI ──
  return (
    <div className={`pos-shell flex flex-col h-screen overflow-hidden bg-slate-50 font-sans antialiased text-slate-800 ${operationSettings.compactMode ? 'pos-shell-compact' : ''}`}>
      {/* 1. TOP HEADER */}
      <POSHeader onBarcodeSubmit={handleBarcodeSubmit} />

      {/* 2. MAIN LAYOUT */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_420px] overflow-hidden">
        {/* LEFT: Product Catalog */}
        <ProductGrid />

        {/* RIGHT: Cart Sidebar */}
        <aside className="pos-cart-shell flex flex-col h-full min-h-0 bg-white border-l border-slate-200/60 shadow-lg">
          <CartPanel
            onClearCart={handleClearCart}
            onPhoneChange={handlePhoneChange}
          />
          <CheckoutFooter onCheckout={checkout} />
        </aside>
      </div>

      {/* 3. MODALS */}
      <CashPaymentModal onCheckout={checkout} />
      <TransferPaymentModal onCheckout={checkout} />
      <CheckoutConfirmModal onCheckout={checkout} />
      <ClearCartModal />
      <ReceiptPreview onPrintInvoice={handlePrintInvoice} />
      <PairingModal />
    </div>
  );
};

export default POSPage;
