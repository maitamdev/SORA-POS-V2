import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { catalogAPI } from '../../../services/catalog.api';
import { usePOSStore } from '../../../stores/pos.store';
import { getProductByBarcodeOffline } from '../../../services/offlineDB';
import { Product } from '../../../types/domain.type';

/**
 * Hook that handles barcode scanning (input field + auto-submit timer).
 * Returns submitBarcode function for external callers (hotkeys, scanner hook).
 */
export const usePOSBarcode = () => {
  const barcodeAutoSubmitTimerRef = useRef<number | null>(null);
  const barcodeSubmittingRef = useRef(false);

  const {
    products,
    barcodeSearch,
    operationSettings,
    activeShift,
    setBarcodeSearch,
    setSearch,
    setPage,
    addToCart,
  } = usePOSStore();

  const user = usePOSStore((s) => s.activeShift); // for role check we need auth store
  // Note: user role is checked via useAuthStore in POSPage

  const focusBarcodeInput = () => {
    window.setTimeout(() => document.getElementById('barcode-search-input')?.focus(), 0);
  };

  const submitBarcode = async (rawCode: string) => {
    const query = rawCode.trim();
    if (!query) return;
    if (barcodeSubmittingRef.current) return;
    barcodeSubmittingRef.current = true;
    if (barcodeAutoSubmitTimerRef.current) {
      window.clearTimeout(barcodeAutoSubmitTimerRef.current);
      barcodeAutoSubmitTimerRef.current = null;
    }

    // Shift check is done in POSPage level

    const addOrSelectProduct = (product: Product) => {
      if (!operationSettings.barcodeAutoAdd) {
        setSearch(query);
        setPage(1);
        toast.success(`Đã tìm thấy ${product.name}`);
        return;
      }

      // Check stock before adding
      const allowOutOfStock = operationSettings.allowSellOutOfStock ?? false;
      if (!allowOutOfStock && Number(product.stock_quantity) <= 0) {
        toast.error('Sản phẩm đã hết hàng');
        return;
      }
      if (
        operationSettings.lowStockWarning &&
        Number(product.stock_quantity) > 0 &&
        Number(product.stock_quantity) <= Number(product.min_stock_level)
      ) {
        toast.error('Sản phẩm đang tồn thấp, cần kiểm tra kho');
      }

      addToCart(product);
      toast.success(`Đã thêm ${product.name} vào giỏ hàng`);
    };

    try {
      const localMatch = products.find(
        (product) => product.barcode === query || product.sku === query
      );
      if (localMatch) {
        addOrSelectProduct(localMatch);
        return;
      }

      // Offline: search IndexedDB
      if (!navigator.onLine) {
        const offlineMatch = await getProductByBarcodeOffline(query);
        if (offlineMatch) {
          addOrSelectProduct(offlineMatch);
        } else {
          toast.error(`Không tìm thấy sản phẩm có mã/SKU: ${query} (offline)`);
        }
        return;
      }

      // Online: Single API lookup
      const lookupRes = await catalogAPI.products.lookup(query);
      const dbMatch = lookupRes.data.data || undefined;

      if (dbMatch) {
        addOrSelectProduct(dbMatch);
      } else {
        toast.error(`Không tìm thấy sản phẩm có mã/SKU: ${query}`);
      }
    } catch {
      try {
        const offlineMatch = await getProductByBarcodeOffline(query);
        if (offlineMatch) {
          addOrSelectProduct(offlineMatch);
          return;
        }
      } catch {}
      toast.error('Lỗi khi quét mã vạch');
    } finally {
      barcodeSubmittingRef.current = false;
      setBarcodeSearch('');
      focusBarcodeInput();
    }
  };

  const handleBarcodeSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (barcodeAutoSubmitTimerRef.current) {
      window.clearTimeout(barcodeAutoSubmitTimerRef.current);
      barcodeAutoSubmitTimerRef.current = null;
    }
    submitBarcode(barcodeSearch);
  };

  // Auto-submit after 220ms when barcode is >= 6 chars
  useEffect(() => {
    const code = barcodeSearch.trim();
    if (!code || code.length < 6) return;

    if (barcodeAutoSubmitTimerRef.current) {
      window.clearTimeout(barcodeAutoSubmitTimerRef.current);
    }

    barcodeAutoSubmitTimerRef.current = window.setTimeout(() => {
      submitBarcode(code);
    }, 220);

    return () => {
      if (barcodeAutoSubmitTimerRef.current) {
        window.clearTimeout(barcodeAutoSubmitTimerRef.current);
        barcodeAutoSubmitTimerRef.current = null;
      }
    };
  }, [barcodeSearch]);

  return { submitBarcode, handleBarcodeSubmit, focusBarcodeInput };
};
