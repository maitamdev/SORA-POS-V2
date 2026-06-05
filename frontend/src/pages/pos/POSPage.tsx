import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  HiOutlineShoppingCart,
  HiOutlineSearch,
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlineCreditCard,
  HiOutlineXCircle,
  HiOutlineCheck,
  HiOutlineMenu,
  HiOutlineTag,
  HiOutlineDuplicate,
} from 'react-icons/hi';
import { catalogAPI } from '../../services/catalog.api';
import { orderAPI } from '../../services/order.api';
import { shiftAPI } from '../../services/shift.api';
import { defaultOperationSettings, OperationSettings, settingsAPI } from '../../services/settings.api';
import { useAuthStore } from '../../stores/auth.store';
import { Category, Customer, Product, ShiftSession } from '../../types/domain.type';
import { getRoleLabel, getUserInitials } from '../../utils/userDisplay';
import html2canvas from 'html2canvas-pro';
import { buildVietQR } from '../../utils/vietqr';
import { POPULAR_BANKS } from '../../utils/banks';
import QRCode from 'qrcode';

interface CartItem {
  product: Product;
  quantity: number;
}

const money = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;

// Custom Barcode icon svg
const BarcodeIcon = () => (
  <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h2M7 5h1M10 5h3M15 5h1M18 5h3M3 10h1M6 10h2M10 10h2M14 10h3M19 10h2M3 15h3M8 15h1M11 15h2M15 15h2M19 15h2M3 20h2M7 20h2M11 20h1M14 20h3M19 20h2" />
  </svg>
);

const getProductImage = (product: Product) => {
  return product.image_url || '/assets/product-placeholder.svg';
};

const POSPage = () => {
  const { user } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Filtering & Sorting
  const [search, setSearch] = useState('');
  const [barcodeSearch, setBarcodeSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [sortBy, setSortBy] = useState('default');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Checkout details
  const [customerId, setCustomerId] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [matchedCustomer, setMatchedCustomer] = useState<Customer | null>(null);
  const [newCustName, setNewCustName] = useState('');
  const [usedPoints, setUsedPoints] = useState(0);
  const [isRedeemingPoints, setIsRedeemingPoints] = useState(false);
  const [discountType, setDiscountType] = useState<'percent' | 'value'>('value');
  const [discountValue, setDiscountValue] = useState(0);
  const [voucherCode, setVoucherCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'card'>('cash');
  const [receivedAmount, setReceivedAmount] = useState(0);
  const [showCashPayment, setShowCashPayment] = useState(false);
  const [showTransferPayment, setShowTransferPayment] = useState(false);
  const [showCheckoutConfirm, setShowCheckoutConfirm] = useState(false);
  const [showClearCartConfirm, setShowClearCartConfirm] = useState(false);
  const [transferMemo, setTransferMemo] = useState('');
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(false);
  const [operationSettings, setOperationSettings] = useState<OperationSettings>(defaultOperationSettings);
  const [activeShift, setActiveShift] = useState<ShiftSession | null>(null);
  const [shiftLoading, setShiftLoading] = useState(false);
  const [openingCash, setOpeningCash] = useState('');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: defaultOperationSettings.productPageSize, total: 0 });

  const [checkoutSuccessInfo, setCheckoutSuccessInfo] = useState<{
    orderNumber: string;
    finalAmount: number;
    total: number;
    discountAmount: number;
    change: number;
    paymentMethod: string;
    receivedAmount: number;
    cart: CartItem[];
    customerName: string;
    customerPhone: string;
    cashierName: string;
    date: string;
    pointsBefore?: number;
    pointsUsed?: number;
    pointsEarned?: number;
    pointsAfter?: number;
  } | null>(null);
  const scannerBufferRef = useRef('');
  const scannerLastKeyAtRef = useRef(0);
  const scannerTimerRef = useRef<number | null>(null);
  const barcodeAutoSubmitTimerRef = useRef<number | null>(null);
  const barcodeSubmittingRef = useRef(false);

  const focusBarcodeInput = () => {
    window.setTimeout(() => document.getElementById('barcode-search-input')?.focus(), 0);
  };

  const loadData = async () => {
    const params: Record<string, unknown> = {
      search,
      is_active: true,
      limit: operationSettings.productPageSize,
      page,
    };
    if (selectedCategoryId !== 'all') {
      params.category_id = selectedCategoryId;
    }

    const [productRes, categoryRes, customerRes] = await Promise.all([
      catalogAPI.products.list(params),
      catalogAPI.categories.list({ is_active: true, limit: 100 }),
      catalogAPI.customers.list({ is_active: true, limit: 100 }),
    ]);

    setProducts(productRes.data.data.items);
    setPagination(productRes.data.data.pagination);
    setCategories(categoryRes.data.data.items);
    setCustomers(customerRes.data.data.items);
  };

  useEffect(() => {
    loadData().catch(() => toast.error('Không tải được dữ liệu POS'));
  }, [page, selectedCategoryId, search, operationSettings.productPageSize]);

  useEffect(() => {
    settingsAPI
      .getOperation()
      .then((response) => {
        const nextSettings = { ...defaultOperationSettings, ...response.data.data.settings };
        setOperationSettings(nextSettings);
        setPaymentMethod(nextSettings.defaultPaymentMethod);
      })
      .catch(() => {
        setOperationSettings(defaultOperationSettings);
      });
  }, []);

  const loadActiveShift = async () => {
    if (user?.role !== 'cashier') return;
    setShiftLoading(true);
    try {
      const response = await shiftAPI.active();
      setActiveShift(response.data.data);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Không tải được ca làm hiện tại');
      setActiveShift(null);
    } finally {
      setShiftLoading(false);
    }
  };

  useEffect(() => {
    loadActiveShift();
  }, [user?.role]);

  useEffect(() => {
    if (user?.role !== 'cashier' || activeShift?.status === 'checked_in') {
      focusBarcodeInput();
    }
  }, [user?.role, activeShift?.status]);

  const handleCheckInShift = async () => {
    const cash = Number(openingCash || 0);
    if (!Number.isFinite(cash) || cash < 0) {
      toast.error('Tiền đầu ca không hợp lệ');
      return;
    }

    setShiftLoading(true);
    try {
      const response = await shiftAPI.checkIn(cash);
      setActiveShift(response.data.data);
      toast.success('Đã nhận ca, có thể bán hàng');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Nhận ca thất bại');
    } finally {
      setShiftLoading(false);
    }
  };

  const handlePhoneChange = async (value: string) => {
    setCustomerPhone(value);
    const normalized = value.trim().replace(/[\s.-]/g, '');

    // Reset các state tích điểm nếu xóa số điện thoại
    if (!normalized) {
      setMatchedCustomer(null);
      setCustomerId('');
      setNewCustName('');
      setUsedPoints(0);
      setIsRedeemingPoints(false);
      return;
    }

    // 1. Tìm kiếm trong danh sách customers có sẵn ở local
    const localMatch = customers.find(c => {
      const p = (c.phone || '').trim().replace(/[\s.-]/g, '');
      return p === normalized;
    });

    if (localMatch) {
      setMatchedCustomer(localMatch);
      setCustomerId(localMatch.id);
      setNewCustName('');
      setUsedPoints(0);
      setIsRedeemingPoints(false);
      return;
    }

    // 2. Nếu không thấy ở local và độ dài >= 9 số, gọi API tìm kiếm dưới DB
    if (normalized.length >= 9) {
      try {
        const res = await catalogAPI.customers.list({ search: value, limit: 1 });
        const matched = res.data.data.items[0];
        const dbPhone = (matched?.phone || '').trim().replace(/[\s.-]/g, '');
        if (matched && dbPhone === normalized) {
          setCustomers(prev => {
            if (prev.some(c => c.id === matched.id)) return prev;
            return [matched, ...prev];
          });
          setMatchedCustomer(matched);
          setCustomerId(matched.id);
          setNewCustName('');
        } else {
          setMatchedCustomer(null);
          setCustomerId('');
        }
        setUsedPoints(0);
        setIsRedeemingPoints(false);
      } catch (err) {
        console.error('Lỗi khi tìm kiếm khách hàng bằng SĐT:', err);
        setMatchedCustomer(null);
        setCustomerId('');
      }
    } else {
      setMatchedCustomer(null);
      setCustomerId('');
    }
  };



  const total = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.product.sell_price) * item.quantity, 0),
    [cart]
  );

  const discountAmount = useMemo(() => {
    const safeDiscountValue =
      discountType === 'percent'
        ? Math.min(discountValue, operationSettings.maxDiscountPercent)
        : discountValue;
    if (discountType === 'percent') {
      return Math.floor((total * safeDiscountValue) / 100);
    }
    return safeDiscountValue;
  }, [total, discountType, discountValue, operationSettings.maxDiscountPercent]);

  const pointsDiscount = useMemo(() => {
    return isRedeemingPoints ? usedPoints * 1000 : 0;
  }, [isRedeemingPoints, usedPoints]);

  const finalAmount = useMemo(() => Math.max(total - discountAmount - pointsDiscount, 0), [total, discountAmount, pointsDiscount]);

  const activeBank = useMemo(() => {
    if (!operationSettings.bankBin) return null;
    return POPULAR_BANKS.find((b) => b.bin === operationSettings.bankBin) || null;
  }, [operationSettings.bankBin]);

  useEffect(() => {
    if (paymentMethod !== 'cash') {
      setReceivedAmount(finalAmount);
    }
  }, [finalAmount, paymentMethod]);

  const changeAmount = useMemo(() => {
    if (paymentMethod !== 'cash') return 0;
    return Math.max(receivedAmount - finalAmount, 0);
  }, [receivedAmount, finalAmount, paymentMethod]);

  const cashSuggestions = useMemo(() => {
    const rounded10k = Math.ceil(finalAmount / 10000) * 10000;
    const rounded50k = Math.ceil(finalAmount / 50000) * 50000;
    const rounded100k = Math.ceil(finalAmount / 100000) * 100000;

    return Array.from(
      new Set([finalAmount, rounded10k, rounded50k, rounded100k].filter((amount) => amount > 0))
    );
  }, [finalAmount]);

  const sortedProducts = useMemo(() => {
    const items = [...products];
    if (sortBy === 'price-asc') {
      items.sort((a, b) => Number(a.sell_price) - Number(b.sell_price));
    } else if (sortBy === 'price-desc') {
      items.sort((a, b) => Number(b.sell_price) - Number(a.sell_price));
    } else if (sortBy === 'name-asc') {
      items.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    } else if (sortBy === 'name-desc') {
      items.sort((a, b) => b.name.localeCompare(a.name, 'vi'));
    }
    return items;
  }, [products, sortBy]);

  const submitBarcode = async (rawCode: string) => {
    const query = rawCode.trim();
    if (!query) return;
    if (barcodeSubmittingRef.current) return;
    barcodeSubmittingRef.current = true;
    if (barcodeAutoSubmitTimerRef.current) {
      window.clearTimeout(barcodeAutoSubmitTimerRef.current);
      barcodeAutoSubmitTimerRef.current = null;
    }

    if (user?.role === 'cashier' && activeShift?.status !== 'checked_in') {
      toast.error('Vui lòng nhận ca trước khi quét bán hàng');
      setBarcodeSearch('');
      focusBarcodeInput();
      barcodeSubmittingRef.current = false;
      return;
    }

    const addOrSelectProduct = (product: Product) => {
      if (!operationSettings.barcodeAutoAdd) {
        setSearch(query);
        setPage(1);
        toast.success(`Đã tìm thấy ${product.name}`);
        return;
      }

      addToCart(product);
      toast.success(`Đã thêm ${product.name} vào giỏ hàng`);
    };

    try {
      const localMatch = products.find((product) => product.barcode === query || product.sku === query);
      if (localMatch) {
        addOrSelectProduct(localMatch);
        return;
      }

      const response = await catalogAPI.products.list({ search: query, is_active: true, limit: 5 });
      const dbMatch = response.data.data.items.find((product) => product.barcode === query || product.sku === query);

      if (dbMatch) {
        addOrSelectProduct(dbMatch);
      } else {
        toast.error(`Không tìm thấy sản phẩm có mã/SKU: ${query}`);
      }
    } catch {
      toast.error('Lỗi khi quét mã vạch');
    } finally {
      barcodeSubmittingRef.current = false;
      setBarcodeSearch('');
      focusBarcodeInput();
    }
  };

  // Barcode search submission
  const handleBarcodeSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (barcodeAutoSubmitTimerRef.current) {
      window.clearTimeout(barcodeAutoSubmitTimerRef.current);
      barcodeAutoSubmitTimerRef.current = null;
    }
    submitBarcode(barcodeSearch);
  };

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

  // Stepper cart modifications
  const addToCart = (product: Product) => {
    if (!operationSettings.allowSellOutOfStock && Number(product.stock_quantity) <= 0) {
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
    setCart((items) => {
      const existing = items.find((item) => item.product.id === product.id);
      if (existing) {
        if (!operationSettings.allowSellOutOfStock && existing.quantity >= Number(product.stock_quantity)) {
          toast.error('Không đủ tồn kho');
          return items;
        }
        return items.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...items, { product, quantity: 1 }];
    });
  };

  const updateQty = (productId: string, quantity: number) => {
    setCart((items) =>
      items
        .map((item) => {
          if (item.product.id !== productId) return item;
          const maxQuantity = operationSettings.allowSellOutOfStock
            ? quantity
            : Math.min(quantity, Number(item.product.stock_quantity));
          const nextQuantity = Math.max(0, maxQuantity);
          return { ...item, quantity: nextQuantity };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  // Draw QR Code to canvas
  useEffect(() => {
    if (showTransferPayment && qrCanvasRef.current) {
      const qrString = buildVietQR({
        bankBin: operationSettings.bankBin || '970416', // Fallback to ACB BIN (demo)
        bankNumber: operationSettings.bankAccountNumber || '257678859', // Fallback to ACB STK (demo)
        amount: String(finalAmount),
        purpose: transferMemo,
      });

      QRCode.toCanvas(
        qrCanvasRef.current,
        qrString,
        {
          width: 240,
          margin: 1.5,
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
        },
        (err) => {
          if (err) {
            console.error('Lỗi tạo QR VietQR:', err);
            toast.error('Không thể tạo mã QR thanh toán');
          }
        }
      );
    }
  }, [showTransferPayment, operationSettings, finalAmount, transferMemo]);

  // Keyboard hotkey implementation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const activeInputId = target?.id || '';
      const isEditableTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;
      const isBarcodeInput = activeInputId === 'barcode-search-input';

      if (event.key === 'Enter' && scannerBufferRef.current && !isBarcodeInput) {
        const scannedCode = scannerBufferRef.current;
        scannerBufferRef.current = '';
        if (scannerTimerRef.current) window.clearTimeout(scannerTimerRef.current);
        if (scannedCode.length >= 4) {
          event.preventDefault();
          submitBarcode(scannedCode);
          return;
        }
      }

      if (
        event.key.length === 1 &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey &&
        !isBarcodeInput &&
        !isEditableTarget
      ) {
        const now = Date.now();
        if (now - scannerLastKeyAtRef.current > 120) {
          scannerBufferRef.current = '';
        }
        scannerLastKeyAtRef.current = now;
        scannerBufferRef.current += event.key;
        if (scannerTimerRef.current) window.clearTimeout(scannerTimerRef.current);
        scannerTimerRef.current = window.setTimeout(() => {
          scannerBufferRef.current = '';
        }, 180);
        return;
      }

      if (event.key === 'F2') {
        event.preventDefault();
        focusBarcodeInput();
      } else if (event.key === 'F3') {
        event.preventDefault();
        document.getElementById('product-search-input')?.focus();
      } else if (event.key === 'F9') {
        event.preventDefault();
        if (paymentMethod === 'transfer' && showTransferPayment) {
          checkout(true, true);
        } else if (showCheckoutConfirm) {
          checkout(false, true);
        } else {
          checkout(false, false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (scannerTimerRef.current) window.clearTimeout(scannerTimerRef.current);
    };
  }, [cart, customerId, discountAmount, finalAmount, paymentMethod, receivedAmount, showTransferPayment, transferMemo, showCheckoutConfirm, barcodeSearch, products, operationSettings, activeShift]);

  // Order Operations
  const handleClearCart = () => {
    if (cart.length === 0) return;
    setShowClearCartConfirm(true);
  };

  const handlePrintInvoice = (orderNumber?: string, savedCart?: CartItem[]) => {
    if (!orderNumber) {
      toast.error('Thanh toán xong mới có mã hóa đơn để in');
      return;
    }

    const itemsToRender = savedCart || cart;
    if (itemsToRender.length === 0) {
      toast.error('Không có dữ liệu sản phẩm để in hóa đơn!');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Vui lòng cho phép mở popup trên trình duyệt để in hóa đơn.');
      return;
    }

    const customerName = checkoutSuccessInfo?.customerName ?? (customers.find(c => c.id === customerId)?.name || 'Khách lẻ');
    const customerPhoneStr = checkoutSuccessInfo?.customerPhone ?? (customerPhone || customers.find(c => c.id === customerId)?.phone || '');

    const printPointsBefore = checkoutSuccessInfo?.pointsBefore ?? 0;
    const printPointsUsed = checkoutSuccessInfo?.pointsUsed ?? 0;
    const printPointsEarned = checkoutSuccessInfo?.pointsEarned ?? 0;
    const printPointsAfter = checkoutSuccessInfo?.pointsAfter ?? 0;
    const hasPointsInfo = customerName !== 'Khách lẻ' && (printPointsBefore > 0 || printPointsUsed > 0 || printPointsEarned > 0);

    const printTotal = itemsToRender.reduce((s, i) => s + Number(i.product.sell_price) * i.quantity, 0);
    const printFinal = checkoutSuccessInfo?.finalAmount ?? finalAmount;
    const printDiscount = printTotal - printFinal > 0 ? printTotal - printFinal : 0;
    const printPaymentMethod = checkoutSuccessInfo?.paymentMethod ?? paymentMethod;
    const printChange = checkoutSuccessInfo?.change ?? Math.max((receivedAmount || printFinal) - printFinal, 0);

    const cartRowsHtml = itemsToRender.map((item, idx) => `
      <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding: 10px 14px; font-size: 13px; color: #334155;">
          <div style="font-weight: 600;">${item.product.name}</div>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">${item.product.sku || ''}</div>
        </td>
        <td style="text-align: center; padding: 10px 8px; font-size: 13px; color: #475569; font-weight: 600;">${item.quantity}</td>
        <td style="text-align: right; padding: 10px 8px; font-size: 13px; color: #475569;">${money(item.product.sell_price)}</td>
        <td style="text-align: right; padding: 10px 14px; font-size: 13px; font-weight: 700; color: #1e293b;">${money(Number(item.product.sell_price) * item.quantity)}</td>
      </tr>
    `).join('');

    const storeName = operationSettings.storeName || 'SORA MART';
    const nowStr = new Date().toLocaleString('vi-VN');
    const dateStr = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

    printWindow.document.write(`
      <html>
        <head>
          <title>Hóa đơn ${orderNumber} - ${storeName}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              color: #1e293b;
              background: #f1f5f9;
              padding: 20px;
            }
            .invoice-container {
              max-width: 680px;
              margin: 0 auto;
              background: #ffffff;
              border-radius: 4px;
              border: 1px solid #cbd5e1;
              box-shadow: 0 1px 3px rgba(0,0,0,0.05);
              overflow: hidden;
            }
            /* ── Header ── */
            .invoice-header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              padding: 28px 28px 20px;
              border-bottom: 1px solid #cbd5e1;
            }
            .store-info h1 {
              font-size: 20px;
              font-weight: 700;
              color: #0f172a;
              text-transform: uppercase;
              letter-spacing: -0.2px;
              margin-bottom: 4px;
            }
            .store-info p {
              font-size: 11px;
              color: #64748b;
              line-height: 1.6;
              font-weight: 500;
            }
            .invoice-number-block {
              text-align: right;
            }
            .invoice-number-block h2 {
              font-size: 24px;
              font-weight: 700;
              color: #0f172a;
              letter-spacing: 0.5px;
              text-transform: uppercase;
            }
            .invoice-number-block .order-code {
              font-size: 13px;
              font-weight: 700;
              color: #1e293b;
              margin-top: 2px;
            }
            .invoice-number-block .order-date {
              font-size: 11px;
              color: #64748b;
              margin-top: 4px;
              font-weight: 500;
            }

            /* ── Billing Info ── */
            .billing-section {
              display: flex;
              justify-content: space-between;
              padding: 16px 28px;
              gap: 24px;
              background: #f8fafc;
              border-bottom: 1px solid #cbd5e1;
            }
            .billing-block { flex: 1; }
            .billing-block .label {
              font-size: 10px;
              font-weight: 700;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-bottom: 4px;
            }
            .billing-block .value {
              font-size: 13px;
              font-weight: 700;
              color: #1e293b;
              line-height: 1.5;
            }

            /* ── Items Table ── */
            .items-section { padding: 0; }
            .items-table {
              width: 100%;
              border-collapse: collapse;
            }
            .items-table thead th {
              background: #f8fafc;
              padding: 10px 14px;
              font-size: 10px;
              font-weight: 700;
              color: #334155;
              text-transform: uppercase;
              letter-spacing: 0.8px;
              border-bottom: 1px solid #cbd5e1;
            }
            .items-table thead th:first-child { text-align: left; }
            .items-table thead th:nth-child(2) { text-align: center; }
            .items-table thead th:nth-child(3) { text-align: right; }
            .items-table thead th:last-child { text-align: right; }
            .items-table tbody td {
              border-bottom: 1px solid #f1f5f9;
            }

            /* ── Totals ── */
            .totals-section {
              padding: 16px 28px 20px;
              display: flex;
              justify-content: flex-end;
            }
            .totals-table {
              width: 260px;
            }
            .totals-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 5px 0;
              font-size: 13px;
            }
            .totals-row .label { color: #64748b; font-weight: 600; }
            .totals-row .value { font-weight: 700; color: #334155; }
            .totals-row.discount .value { color: #dc2626; }
            .totals-row.grand-total {
              border-top: 1px solid #0f172a;
              margin-top: 6px;
              padding-top: 10px;
              font-size: 16px;
            }
            .totals-row.grand-total .label { font-weight: 700; color: #0f172a; }
            .totals-row.grand-total .value { font-weight: 800; color: #0f172a; }

            /* ── Payment Info ── */
            .payment-section {
              padding: 14px 28px;
              background: #f8fafc;
              border-top: 1px solid #cbd5e1;
            }
            .payment-row {
              display: flex;
              justify-content: space-between;
              font-size: 12px;
              padding: 4px 0;
            }
            .payment-row .label { color: #64748b; font-weight: 600; }
            .payment-row .value { color: #334155; font-weight: 700; }
            .payment-row.change .value { color: #047857; font-weight: 700; }

            /* ── Footer ── */
            .invoice-footer {
              text-align: center;
              padding: 20px 28px;
              border-top: 1px solid #cbd5e1;
            }
            .invoice-footer .thank-you {
              font-size: 13px;
              font-weight: 700;
              color: #1e293b;
              margin-bottom: 4px;
            }
            .invoice-footer .sub {
              font-size: 11px;
              color: #64748b;
              font-weight: 500;
            }
            .invoice-footer .powered {
              font-size: 8px;
              color: #94a3b8;
              margin-top: 10px;
              font-weight: 700;
              letter-spacing: 1px;
              text-transform: uppercase;
            }

            @media print {
              body { background: #fff; padding: 0; }
              .invoice-container { box-shadow: none; border-radius: 0; border: none; }
            }
          </style>
        </head>
        <body>
          <div class="invoice-container">
            <!-- Header -->
            <div class="invoice-header">
              <div class="store-info">
                <h1>${storeName}</h1>
                ${operationSettings.branchName ? `<p>${operationSettings.branchName}</p>` : ''}
                ${operationSettings.address ? `<p>${operationSettings.address}</p>` : ''}
                ${operationSettings.hotline ? `<p>SĐT: ${operationSettings.hotline}</p>` : ''}
                ${operationSettings.taxCode ? `<p>MST: ${operationSettings.taxCode}</p>` : ''}
              </div>
              <div class="invoice-number-block">
                <h2>HÓA ĐƠN</h2>
                <div class="order-code">${orderNumber}</div>
                <div class="order-date">${dateStr}</div>
              </div>
            </div>

            <!-- Billing -->
            <div class="billing-section">
              <div class="billing-block">
                <div class="label">Khách hàng</div>
                <div class="value">
                  ${customerName}
                  ${customerPhoneStr ? `<br/>${customerPhoneStr}` : ''}
                </div>
              </div>
              <div class="billing-block">
                <div class="label">Thu ngân</div>
                <div class="value">${user?.full_name || 'Nhân viên'}</div>
              </div>
              <div class="billing-block" style="text-align: right;">
                <div class="label">Ngày giờ</div>
                <div class="value">${nowStr}</div>
              </div>
            </div>

            <!-- Items Table -->
            <div class="items-section">
              <table class="items-table">
                <thead>
                  <tr>
                    <th style="width: 44%;">Sản phẩm</th>
                    <th style="width: 12%;">SL</th>
                    <th style="width: 22%;">Đơn giá</th>
                    <th style="width: 22%;">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  ${cartRowsHtml}
                </tbody>
              </table>
            </div>

            <!-- Totals -->
            <div class="totals-section">
              <div class="totals-table">
                <div class="totals-row">
                  <span class="label">Tạm tính:</span>
                  <span class="value">${money(printTotal)}</span>
                </div>
                ${printDiscount > 0 ? `
                  <div class="totals-row discount">
                    <span class="label">Chiết khấu:</span>
                    <span class="value">-${money(printDiscount)}</span>
                  </div>
                ` : ''}
                <div class="totals-row grand-total">
                  <span class="label">Tổng cộng:</span>
                  <span class="value">${money(printFinal)}</span>
                </div>
              </div>
            </div>

            <!-- Payment -->
            <div class="payment-section">
              <div class="payment-row">
                <span class="label">Phương thức thanh toán:</span>
                <span class="value">${printPaymentMethod === 'cash' ? 'Tiền mặt' : printPaymentMethod === 'transfer' ? 'Chuyển khoản QR' : 'Thẻ ngân hàng'}</span>
              </div>
              ${printPaymentMethod === 'cash' ? `
                <div class="payment-row">
                  <span class="label">Khách đưa:</span>
                  <span class="value">${money(receivedAmount || printFinal)}</span>
                </div>
                <div class="payment-row change">
                  <span class="label">Tiền thừa:</span>
                  <span class="value">${money(printChange)}</span>
                </div>
              ` : ''}
            </div>

            ${hasPointsInfo ? `
              <!-- Điểm tích lũy CGV -->
              <div class="payment-section" style="border-top: none; padding-top: 0;">
                <div class="payment-row">
                  <span class="label">Điểm tích lũy trước:</span>
                  <span class="value">${printPointsBefore}đp</span>
                </div>
                ${printPointsUsed > 0 ? `
                  <div class="payment-row">
                    <span class="label">Điểm đã sử dụng:</span>
                    <span class="value" style="color: #dc2626;">-${printPointsUsed}đp</span>
                  </div>
                ` : ''}
                <div class="payment-row">
                  <span class="label">Điểm tích lũy mới:</span>
                  <span class="value" style="color: #2563eb;">+${printPointsEarned}đp</span>
                </div>
                <div class="payment-row" style="border-top: 1px dashed #e2e8f0; margin-top: 4px; padding-top: 6px;">
                  <span class="label">Số dư điểm hiện tại:</span>
                  <span class="value" style="font-weight: 800; color: #0f172a;">${printPointsAfter}đp</span>
                </div>
              </div>
            ` : ''}

            <!-- Footer -->
            <div class="invoice-footer">
              <div class="thank-you">${operationSettings.receiptFooter || 'Cảm ơn quý khách đã mua sắm!'}</div>
              <div class="sub">Hẹn gặp lại quý khách!</div>
              <div class="powered">Powered by Sora POS</div>
            </div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Đã sao chép ${label}`);
  };

  const checkout = async (isTransferConfirmed = false, isCheckoutConfirmed = false) => {
    if (cart.length === 0) {
      toast.error('Giỏ hàng đang trống');
      return;
    }
    if (user?.role === 'cashier' && activeShift?.status !== 'checked_in') {
      toast.error('Vui lòng nhận ca và nhập tiền đầu ca trước khi bán hàng');
      return;
    }
    if (operationSettings.requireCustomerPhone && !customerPhone.trim()) {
      toast.error('Vui lòng nhập số điện thoại khách hàng');
      return;
    }
    
    if (operationSettings.confirmBeforeCheckout && !isCheckoutConfirmed) {
      setShowCheckoutConfirm(true);
      return;
    }

    if (paymentMethod === 'cash' && receivedAmount > 0 && receivedAmount < finalAmount) {
      toast.error('Tiền khách đưa chưa đủ để thanh toán');
      return;
    }

    if (paymentMethod === 'transfer' && !isTransferConfirmed) {
      // Generate a unique memo for this transaction
      const datePart = new Date().toLocaleDateString('vi-VN', { month: '2-digit', day: '2-digit' }).replace(/\//g, '');
      const timePart = new Date().toLocaleTimeString('vi-VN', { hour12: false }).replace(/:/g, '').slice(0, 4);
      setTransferMemo(`SORA${datePart}${timePart}`);
      setShowTransferPayment(true);
      return;
    }

    setLoading(true);
    try {
      let finalCustomerId = matchedCustomer?.id || null;

      // Tự động tạo khách hàng mới nếu nhập SĐT chưa đăng ký
      if (customerPhone.trim() && !matchedCustomer) {
        if (!newCustName.trim()) {
          toast.error('Vui lòng nhập Họ và tên khách hàng mới để đăng ký tích điểm');
          setLoading(false);
          return;
        }
        try {
          const custRes = await catalogAPI.customers.create({
            name: newCustName.trim(),
            phone: customerPhone.trim(),
            is_active: true,
          });
          const newCust = custRes.data.data;
          setCustomers((prev) => [newCust, ...prev]);
          setMatchedCustomer(newCust);
          finalCustomerId = newCust.id;
          toast.success(`Đã tự động tạo tài khoản tích điểm cho khách hàng ${newCust.name}`);
        } catch (err) {
          console.error(err);
          toast.error('Không thể tạo tài khoản khách hàng mới');
          setLoading(false);
          return;
        }
      }

      const response = await orderAPI.create({
        customer_id: finalCustomerId,
        discount_amount: discountAmount + pointsDiscount,
        used_points: isRedeemingPoints ? usedPoints : 0,
        note: null,
        payment: {
          method: paymentMethod,
          received_amount: paymentMethod === 'cash' ? (receivedAmount || finalAmount) : finalAmount,
        },
        items: cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
        })),
      });

      const orderNumber = response.data.data.order_number;
      
      const customerObj = finalCustomerId
        ? (customers.find(c => c.id === finalCustomerId) || { name: newCustName, phone: customerPhone })
        : null;

      const pBefore = matchedCustomer ? matchedCustomer.points : 0;
      const pUsed = isRedeemingPoints ? usedPoints : 0;
      const pEarned = Math.floor(finalAmount / 10000);
      const pAfter = Math.max(0, pBefore - pUsed + pEarned);

      setCheckoutSuccessInfo({
        orderNumber,
        finalAmount,
        total,
        discountAmount: discountAmount + pointsDiscount,
        change: paymentMethod === 'cash' ? Math.max((receivedAmount || finalAmount) - finalAmount, 0) : 0,
        paymentMethod,
        receivedAmount: paymentMethod === 'cash' ? (receivedAmount || finalAmount) : finalAmount,
        cart: [...cart],
        customerName: customerObj?.name || 'Khách lẻ',
        customerPhone: customerPhone || customerObj?.phone || '',
        cashierName: user?.full_name || 'Nhân viên',
        date: new Date().toLocaleString('vi-VN'),
        pointsBefore: pBefore,
        pointsUsed: pUsed,
        pointsEarned: pEarned,
        pointsAfter: pAfter,
      });

      setCart([]);
      setReceivedAmount(0);
      setShowCashPayment(false);
      setShowTransferPayment(false);
      setDiscountValue(0);
      setVoucherCode('');
      setCustomerPhone('');
      setMatchedCustomer(null);
      setNewCustName('');
      setUsedPoints(0);
      setIsRedeemingPoints(false);
      await loadData();
      await loadActiveShift();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Thanh toán thất bại');
    } finally {
      setLoading(false);
    }
  };



  // Calculate items bounds for pagination display
  const itemsStart = (pagination.page - 1) * pagination.limit + 1;
  const itemsEnd = Math.min(pagination.page * pagination.limit, pagination.total);
  const isCashierShiftRequired = user?.role === 'cashier';

  if (isCashierShiftRequired && shiftLoading && !activeShift) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 p-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-black uppercase text-slate-400">Đang kiểm tra ca làm</p>
          <p className="mt-2 text-slate-600">Vui lòng đợi trong giây lát...</p>
        </div>
      </div>
    );
  }

  if (isCashierShiftRequired && !activeShift) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-lg rounded-xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-black uppercase text-red-600">Chưa có ca được mở</p>
          <h1 className="mt-2 text-2xl font-black text-slate-900">Không thể bán hàng</h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            Quản lý cần mở ca hôm nay cho tài khoản của bạn. Sau đó đăng nhập lại để bắt đầu nhận ca.
          </p>
        </div>
      </div>
    );
  }

  if (isCashierShiftRequired && activeShift?.status === 'opened') {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase text-blue-600">Nhận ca bán hàng</p>
          <h1 className="mt-2 text-2xl font-black text-slate-900">Nhập tiền đầu ca</h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            Ca hôm nay đã được quản lý mở. Hãy đếm tiền ban đầu trong ngăn kéo trước khi bán hàng.
          </p>

          <label className="mt-6 block">
            <span className="mb-2 block text-xs font-black uppercase text-slate-500">Tiền nhận ca ban đầu</span>
            <input
              type="number"
              min="0"
              value={openingCash}
              onChange={(event) => setOpeningCash(event.target.value)}
              placeholder="VD: 500000"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-lg font-black outline-none focus:border-blue-500"
            />
          </label>

          <button
            onClick={handleCheckInShift}
            disabled={shiftLoading}
            className="mt-5 w-full rounded-xl bg-blue-600 py-3 text-sm font-black uppercase text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {shiftLoading ? 'Đang nhận ca...' : 'Nhận ca và bắt đầu bán hàng'}
          </button>
        </div>
      </div>
    );
  }

  if (isCashierShiftRequired && activeShift?.status === 'closed') {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-2xl rounded-xl border border-emerald-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase text-emerald-600">Đã chốt ca</p>
          <h1 className="mt-2 text-2xl font-black text-slate-900">Báo cáo đã gửi quản lý</h1>
          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase text-slate-400">Doanh thu</p>
              <p className="text-xl font-black text-slate-900">{money(activeShift.summary?.revenue || 0)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase text-slate-400">Số đơn</p>
              <p className="text-xl font-black text-slate-900">{activeShift.summary?.order_count || 0}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase text-slate-400">Tiền cần có</p>
              <p className="text-xl font-black text-slate-900">{money(activeShift.expected_cash || 0)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase text-slate-400">Lệch tiền</p>
              <p className="text-xl font-black text-slate-900">{money(activeShift.cash_difference || 0)}</p>
            </div>
          </div>
          <p className="mt-5 text-sm font-semibold text-slate-500">
            Nếu cần bán tiếp, quản lý hãy mở ca mới cho nhân viên.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 font-sans antialiased text-slate-800">
      
      {/* 1. TOP HEADER SECTION */}
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
              placeholder="Tìm sản phẩm (F3)"
              className="w-60 lg:w-80 pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 bg-slate-50 transition"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600">✕</button>
            )}
          </div>

          {/* F2 Barcode Scanner Input */}
          <form onSubmit={handleBarcodeSubmit} className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
              <BarcodeIcon />
            </div>
            <input
              id="barcode-search-input"
              value={barcodeSearch}
              onChange={(e) => setBarcodeSearch(e.target.value)}
              placeholder="Quét mã vạch (F2)"
              className="w-48 lg:w-56 pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 bg-slate-50 transition"
            />
            <button type="submit" className="hidden">Submit</button>
          </form>
          <div className="hidden xl:flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] font-black text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Máy quét sẵn sàng
          </div>
        </div>

        {/* Right Info Widgets */}
        <div className="hidden sm:flex items-center gap-2 sm:gap-4">
          {/* User profile */}
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

      {/* 2. MAIN LAYOUT CONTAINER */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_420px] overflow-hidden">
        
        {/* LEFT CATALOG PANEL */}
        <section className="flex flex-col h-full min-h-0 overflow-hidden p-3 sm:p-4 space-y-3 sm:space-y-4 bg-slate-50/50">

          {/* Category Horizontal Filter Row */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            <button
              onClick={() => {
                setSelectedCategoryId('all');
                setPage(1);
              }}
              className={`px-4 py-2 text-xs font-black rounded-xl border whitespace-nowrap transition-all ${
                selectedCategoryId === 'all'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/10'
                  : 'bg-white text-slate-600 border-slate-200/60 hover:bg-slate-100'
              }`}
            >
              Tất cả
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategoryId(cat.id);
                  setPage(1);
                }}
                className={`px-4 py-2 text-xs font-black rounded-xl border whitespace-nowrap transition-all ${
                  selectedCategoryId === cat.id
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200/60 hover:bg-slate-100'
                }`}
              >
                {cat.name}
              </button>
            ))}
            <button className="p-2 bg-white border border-slate-200/60 text-slate-600 hover:bg-slate-100 rounded-xl flex-shrink-0 ml-auto">
              <HiOutlineMenu className="w-4 h-4" />
            </button>
          </div>

          {/* Subfilters Row (sort + view toggle) */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3 rounded-xl border border-slate-200/60 shadow-sm">
            <p className="w-full sm:w-auto text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {pagination.total > 0
                ? `Hiển thị ${itemsStart}-${itemsEnd} / ${pagination.total} sản phẩm`
                : 'Chưa có sản phẩm phù hợp'}
            </p>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 bg-white outline-none"
              >
                <option value="default">Sắp xếp: Mặc định</option>
                <option value="price-asc">Giá: Thấp đến Cao</option>
                <option value="price-desc">Giá: Cao đến Thấp</option>
                <option value="name-asc">Tên: A-Z</option>
                <option value="name-desc">Tên: Z-A</option>
              </select>

              {/* View switches */}
              <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 transition ${viewMode === 'grid' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <svg className="w-4.5 h-4.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 transition ${viewMode === 'list' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Product Grid Catalog */}
          <div className="flex-1 overflow-y-auto min-h-0 pr-1">
            {products.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 bg-white rounded-2xl border border-dashed border-slate-350 p-10 text-center text-slate-400">
                <HiOutlineShoppingCart className="w-12 h-12 text-slate-300 mb-2" />
                <p className="font-extrabold text-slate-500">Chưa có sản phẩm nào được hiển thị</p>
                <p className="text-xs text-slate-400 mt-1">Vui lòng điều chỉnh lại bộ lọc tìm kiếm sản phẩm.</p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {sortedProducts.map((product) => {
                  const isLowStock = product.stock_quantity <= product.min_stock_level;
                  const isOutOfStock = product.stock_quantity <= 0;
                  return (
                    <div
                      key={product.id}
                      className="bg-white border border-slate-200/60 rounded-xl p-3 flex flex-col justify-between hover:shadow-md hover:border-blue-400 transition relative overflow-hidden group"
                    >
                      {/* Stock badge label */}
                      <span className={`absolute top-2.5 right-2.5 px-2 py-0.5 text-[9px] font-black rounded-full border ${
                        isOutOfStock
                          ? 'bg-red-100 text-red-700 border-red-200'
                          : isLowStock
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        Tồn: {product.stock_quantity} {isLowStock && !isOutOfStock && '⚠️'} {isOutOfStock && 'Hết'}
                      </span>

                      {/* Product Thumbnail image */}
                      <div className="h-28 flex items-center justify-center mb-2 bg-slate-50/50 rounded-lg p-2 overflow-hidden flex-shrink-0">
                        <img
                          src={getProductImage(product)}
                          alt={product.name}
                          className="max-h-full max-w-full object-contain group-hover:scale-105 transition duration-300"
                          loading="lazy"
                        />
                      </div>

                      {/* Details */}
                      <div className="flex-1 flex flex-col">
                        <h3 className="text-xs font-black text-slate-800 line-clamp-2 mt-1 min-h-[32px]">
                          {product.name}
                        </h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 tracking-wider">
                          {product.sku}
                        </p>
                      </div>

                      <div className="mt-3">
                        <span className="text-sm font-black text-blue-600 block">{money(product.sell_price)}</span>
                        
                          <button
                          onClick={() => addToCart(product)}
                          disabled={!product.is_active || (!operationSettings.allowSellOutOfStock && isOutOfStock)}
                          className="w-full mt-2.5 flex items-center justify-center gap-1 py-1.5 border border-blue-600 text-blue-600 text-[11px] font-black rounded-lg hover:bg-blue-600 hover:text-white transition disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-blue-600"
                        >
                          <HiOutlinePlus className="w-3.5 h-3.5" />
                          <span>Thêm (F4)</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              // List View Mode
              <div className="space-y-2 bg-white rounded-xl border border-slate-200/60 overflow-hidden divide-y divide-slate-100 shadow-sm">
                {sortedProducts.map((product) => {
                  const isLowStock = product.stock_quantity <= product.min_stock_level;
                  const isOutOfStock = product.stock_quantity <= 0;
                  return (
                    <div key={product.id} className="p-3 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition">
                      <div className="flex items-center gap-3 min-w-0">
                        <img src={getProductImage(product)} alt={product.name} className="w-10 h-10 object-contain bg-slate-50 rounded p-1 flex-shrink-0" />
                        <div className="min-w-0 leading-tight">
                          <h4 className="text-xs font-black text-slate-800 truncate">{product.name}</h4>
                          <span className="text-[10px] text-slate-400 font-bold uppercase">{product.sku}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <span className={`px-2 py-0.5 text-[9px] font-black rounded-full border ${
                          isOutOfStock ? 'bg-red-100 text-red-700 border-red-200' : isLowStock ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          Tồn: {product.stock_quantity}
                        </span>
                        <span className="text-xs font-black text-slate-800 w-20 text-right">{money(product.sell_price)}</span>
                        <button
                          onClick={() => addToCart(product)}
                          disabled={!product.is_active || (!operationSettings.allowSellOutOfStock && isOutOfStock)}
                          className="p-1 px-3 border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
                        >
                          + Thêm
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pagination Footer */}
          <footer className="flex items-center justify-between border-t border-slate-200/60 pt-3 flex-shrink-0">
            <span className="text-[11px] font-bold text-slate-500">
              Hiển thị {pagination.total === 0 ? 0 : itemsStart} - {itemsEnd} trên {pagination.total} sản phẩm
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition"
              >
                ‹
              </button>
              {Array.from({ length: Math.ceil(pagination.total / pagination.limit) }).map((_, index) => {
                const pNum = index + 1;
                if (Math.abs(pNum - page) <= 2 || pNum === 1 || pNum === Math.ceil(pagination.total / pagination.limit)) {
                  return (
                    <button
                      key={pNum}
                      onClick={() => setPage(pNum)}
                      className={`w-8 h-8 rounded-lg text-xs font-black transition ${
                        page === pNum
                          ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/10'
                          : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {pNum}
                    </button>
                  );
                }
                if (pNum === 2 || pNum === Math.ceil(pagination.total / pagination.limit) - 1) {
                  return <span key={pNum} className="text-xs text-slate-400 font-bold px-1">...</span>;
                }
                return null;
              })}
              <button
                onClick={() => setPage(p => Math.min(Math.ceil(pagination.total / pagination.limit), p + 1))}
                disabled={page >= Math.ceil(pagination.total / pagination.limit)}
                className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition"
              >
                ›
              </button>
            </div>
          </footer>
        </section>

        {/* RIGHT CHECKOUT SIDEBAR PANEL */}
        <aside className="flex flex-col h-full min-h-0 bg-white border-l border-slate-200/60 shadow-lg">
          
          {/* Cart Header Section */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
            <h2 className="text-sm font-black text-slate-800 flex items-center gap-1.5 uppercase">
              <HiOutlineShoppingCart className="w-5 h-5 text-blue-600" />
              <span>Giỏ hàng ({cart.reduce((s, i) => s + i.quantity, 0)})</span>
            </h2>
            {cart.length > 0 && (
              <button
                onClick={handleClearCart}
                className="flex items-center gap-1 text-[11px] font-bold text-red-500 hover:text-red-750 transition"
              >
                <HiOutlineTrash className="w-4 h-4" />
                <span>Xóa giỏ hàng</span>
              </button>
            )}
          </div>

          {/* Cart Items List Area */}
          <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100 min-h-0 bg-slate-50/20">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center text-slate-400 py-10">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-350 mb-2">
                  📭
                </div>
                <p className="text-xs font-black text-slate-500 uppercase">Giỏ hàng trống</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Chọn sản phẩm bên trái hoặc quét mã vạch.</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.product.id} className="py-3 flex items-start justify-between gap-3 group">
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Thumbnail */}
                    <img
                      src={getProductImage(item.product)}
                      alt={item.product.name}
                      className="w-11 h-11 rounded-lg border border-slate-200/60 object-contain flex-shrink-0 bg-white p-0.5"
                    />
                    
                    <div className="min-w-0 leading-tight">
                      <p className="text-xs font-black text-slate-800 truncate" title={item.product.name}>
                        {item.product.name}
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{item.product.sku}</p>
                      
                      {/* Quantity control steppers */}
                      <div className="flex items-center gap-1 mt-2">
                        <button
                          onClick={() => updateQty(item.product.id, item.quantity - 1)}
                          className="w-5.5 h-5.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-extrabold"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateQty(item.product.id, Number(e.target.value))}
                          className="w-10 h-5.5 border border-slate-200 text-center text-xs font-black text-slate-800 outline-none rounded"
                        />
                        <button
                          onClick={() => updateQty(item.product.id, item.quantity + 1)}
                          className="w-5.5 h-5.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-extrabold"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className="text-xs font-black text-slate-800">
                      {money(Number(item.product.sell_price) * item.quantity)}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      {money(item.product.sell_price)}
                    </span>
                    <button
                      onClick={() => updateQty(item.product.id, 0)}
                      className="text-xs font-bold text-slate-350 hover:text-red-500 opacity-0 group-hover:opacity-100 transition duration-150 self-end mt-1"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Customer & Notes Panel */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-3 flex-shrink-0">
            {/* Customer & Loyalty Points Section */}
            <div className="space-y-2 border-b border-slate-100 pb-3">
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Số điện thoại khách hàng</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none text-xs">
                    📞
                  </span>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="Nhập SĐT để tích/tiêu điểm"
                    className="w-full bg-white border border-slate-200 pl-8 pr-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition"
                  />
                </div>
              </div>

              {customerPhone.trim() && (
                matchedCustomer ? (
                  /* Khách hàng thành viên đã đăng ký */
                  <div className="bg-blue-50/40 border border-blue-100 rounded-xl p-3 space-y-2.5">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Thành viên Sora</p>
                        <h4 className="text-xs font-black text-slate-800 mt-0.5">{matchedCustomer.name}</h4>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Điểm tích lũy</p>
                        <p className="text-xs font-black text-blue-600 mt-0.5">{matchedCustomer.points}đp</p>
                      </div>
                    </div>

                    <div className="border-t border-blue-100/50 pt-2 flex flex-col gap-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isRedeemingPoints}
                          onChange={(e) => {
                            setIsRedeemingPoints(e.target.checked);
                            setUsedPoints(0);
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                        />
                        <span className="text-[11px] font-bold text-slate-600">Đổi điểm thanh toán (1 điểm = 1.000đ)</span>
                      </label>

                      {isRedeemingPoints && (
                        <div className="flex items-center gap-2 pl-5.5">
                          <span className="text-[11px] text-slate-400 font-semibold">Đổi</span>
                          <input
                            type="number"
                            min={0}
                            max={Math.min(matchedCustomer.points, Math.floor((total - discountAmount) / 1000))}
                            value={usedPoints || ''}
                            onChange={(e) => {
                              const points = Math.max(0, parseInt(e.target.value, 10) || 0);
                              const maxPoints = Math.min(matchedCustomer.points, Math.floor((total - discountAmount) / 1000));
                              setUsedPoints(Math.min(points, maxPoints));
                            }}
                            placeholder="0"
                            className="w-20 bg-white border border-slate-200 px-2 py-1 rounded text-xs font-bold text-slate-800 text-center outline-none focus:border-blue-500"
                          />
                          <span className="text-[11px] text-slate-600 font-bold">
                            điểm = -{money((usedPoints || 0) * 1000)}
                          </span>
                        </div>
                      )}

                      <div className="text-[10px] font-bold text-emerald-600 flex items-center justify-between mt-1 bg-emerald-50/50 px-2.5 py-1 rounded-lg">
                        <span>Đơn hàng này tích lũy thêm:</span>
                        <span>+{Math.floor(finalAmount / 10000)} điểm ↗</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Đăng ký khách hàng mới nhanh */
                  <div className="bg-amber-50/40 border border-amber-100 rounded-xl p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded uppercase tracking-wider">Khách hàng mới</span>
                      <span className="text-[9px] font-semibold text-slate-400">SĐT chưa đăng ký tích điểm</span>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Họ và tên khách mới *</label>
                      <input
                        type="text"
                        value={newCustName}
                        onChange={(e) => setNewCustName(e.target.value)}
                        placeholder="Nhập tên khách để tự động tạo TK"
                        className="w-full bg-white border border-amber-200 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition"
                      />
                    </div>
                  </div>
                )
              )}
            </div>

            {/* Discount and Voucher Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Chiết khấu đơn</label>
                <div className="flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden w-full">
                  <input
                    type="number"
                    value={discountValue || ''}
                    disabled={!operationSettings.allowDiscount}
                    max={discountType === 'percent' ? operationSettings.maxDiscountPercent : undefined}
                    onChange={(e) => {
                      const nextValue = Number(e.target.value);
                      setDiscountValue(
                        discountType === 'percent'
                          ? Math.min(nextValue, operationSettings.maxDiscountPercent)
                          : nextValue
                      );
                    }}
                    placeholder="0"
                    className="flex-1 w-full px-2.5 py-1.5 text-xs font-semibold outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  />
                  <button
                    disabled={!operationSettings.allowDiscount}
                    onClick={() => {
                      setDiscountType(discountType === 'percent' ? 'value' : 'percent');
                      setDiscountValue(0);
                    }}
                    className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 border-l border-slate-200 text-xs font-black text-slate-600 transition disabled:opacity-50"
                  >
                    {discountType === 'percent' ? '%' : 'đ'}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Mã giảm giá (Voucher)</label>
                <div className="flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden w-full px-2">
                  <HiOutlineTag className="text-slate-400 w-4 h-4 flex-shrink-0" />
                  <input
                    type="text"
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value)}
                    placeholder="Chọn hoặc nhập mã"
                    className="flex-1 w-full px-1.5 py-1.5 text-xs font-semibold outline-none"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Pricing calculations & checkout actions */}
          <div className="p-4 bg-white border-t border-slate-100 space-y-4 flex-shrink-0">
            {/* Calculation details */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                <span>Tạm tính</span>
                <span>{money(total)}</span>
              </div>
              
              {discountAmount > 0 && (
                <div className="flex justify-between items-center text-xs font-bold text-red-500">
                  <span>Chiết khấu</span>
                  <span>-{money(discountAmount)}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                <span>Tổng tiền hàng</span>
                <span>{money(total)}</span>
              </div>

              <div className="flex justify-between items-center border-t border-slate-100 pt-2 text-sm font-extrabold text-slate-800">
                <span>Thành tiền</span>
                <span className="text-xl font-black text-blue-600">{money(finalAmount)}</span>
              </div>
            </div>

            {/* Payment Method Selector Tab Row */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Phương thức thanh toán</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    setPaymentMethod('cash');
                    setShowCashPayment(true);
                  }}
                  className={`flex flex-col items-center justify-center py-2.5 rounded-xl border text-[11px] font-black gap-1.5 transition ${
                    paymentMethod === 'cash'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20'
                      : 'bg-slate-50 border-slate-200/60 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-base">💵</span>
                  <span>Tiền mặt</span>
                </button>

                <button
                  onClick={() => {
                    setPaymentMethod('transfer');
                    setReceivedAmount(finalAmount);
                    setShowCashPayment(false);
                  }}
                  className={`flex flex-col items-center justify-center py-2.5 rounded-xl border text-[11px] font-black gap-1.5 transition ${
                    paymentMethod === 'transfer'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20'
                      : 'bg-slate-50 border-slate-200/60 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-base">📲</span>
                  <span>Chuyển khoản QR</span>
                </button>

                <button
                  onClick={() => {
                    setPaymentMethod('card');
                    setReceivedAmount(finalAmount);
                    setShowCashPayment(false);
                  }}
                  className={`flex flex-col items-center justify-center py-2.5 rounded-xl border text-[11px] font-black gap-1.5 transition ${
                    paymentMethod === 'card'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20'
                      : 'bg-slate-50 border-slate-200/60 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <HiOutlineCreditCard className="w-5 h-5 text-current" />
                  <span>Thẻ</span>
                </button>
              </div>
            </div>

            {/* CTA action button */}
            <div>
              <button
                onClick={() => checkout(false)}
                disabled={loading || cart.length === 0}
                className="w-full py-3 bg-blue-600 text-white hover:bg-blue-700 text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition disabled:opacity-60 disabled:shadow-none"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Đang thanh toán...</span>
                  </>
                ) : (
                  <>
                    <HiOutlineCheck className="w-4.5 h-4.5 stroke-[3]" />
                    <span>Thanh toán (F9)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* 3. CASH PAYMENT MODAL */}
      {showCashPayment && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Thanh toán tiền mặt</h3>
                <p className="text-xs font-semibold text-slate-400 mt-0.5">Nhập số tiền khách đưa hoặc chọn nhanh mệnh giá.</p>
              </div>
              <button
                onClick={() => setShowCashPayment(false)}
                className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 flex items-center justify-center transition"
                aria-label="Thoát"
              >
                <HiOutlineXCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-blue-500">Cần thu</p>
                  <p className="text-2xl font-black text-blue-700 mt-1">{money(finalAmount)}</p>
                </div>
                <div className={`rounded-xl border p-3 ${receivedAmount >= finalAmount ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
                  <p className={`text-[10px] font-black uppercase tracking-wider ${receivedAmount >= finalAmount ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {receivedAmount >= finalAmount ? 'Tiền trả lại' : 'Còn thiếu'}
                  </p>
                  <p className={`text-2xl font-black mt-1 ${receivedAmount >= finalAmount ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {money(receivedAmount >= finalAmount ? changeAmount : Math.max(finalAmount - receivedAmount, 0))}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Tiền khách đưa</label>
                <input
                  type="number"
                  value={receivedAmount || ''}
                  onChange={(e) => setReceivedAmount(Number(e.target.value))}
                  placeholder={String(finalAmount)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-lg font-black text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Chọn nhanh</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {cashSuggestions.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setReceivedAmount(amount)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:border-blue-400 hover:bg-blue-50 transition"
                    >
                      {amount === finalAmount ? 'Đủ tiền' : money(amount)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Cộng mệnh giá</p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {[10000, 20000, 50000, 100000, 200000, 500000].map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setReceivedAmount((prev) => prev + amount)}
                      className="rounded-xl bg-slate-100 px-2 py-2 text-[11px] font-black text-slate-600 hover:bg-slate-200 transition"
                    >
                      +{amount / 1000}K
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 p-5 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => setShowCashPayment(false)}
                className="py-2.5 border border-slate-200 bg-white text-slate-600 text-xs font-black rounded-xl hover:bg-slate-100 transition"
              >
                Thoát
              </button>
              <button
                onClick={() => setReceivedAmount(0)}
                className="py-2.5 border border-slate-200 bg-white text-slate-600 text-xs font-black rounded-xl hover:bg-slate-100 transition"
              >
                Xóa tiền
              </button>
              <button
                onClick={() => checkout(false)}
                disabled={loading || cart.length === 0 || (receivedAmount > 0 && receivedAmount < finalAmount)}
                className="py-2.5 bg-blue-600 text-white text-xs font-black rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
              >
                Thanh toán
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3.1. VIETQR TRANSFER MODAL */}
      {showTransferPayment && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden animate-fadeIn">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Thanh toán chuyển khoản VietQR</h3>
                <p className="text-xs font-semibold text-slate-400 mt-0.5">Khách hàng quét mã QR dưới đây bằng ứng dụng Ngân hàng để thanh toán.</p>
              </div>
              <button
                onClick={() => setShowTransferPayment(false)}
                className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 flex items-center justify-center transition"
                aria-label="Thoát"
              >
                <HiOutlineXCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              {/* Left Column: QR Code canvas */}
              <div className="flex flex-col items-center justify-center bg-slate-50 p-4 rounded-xl border border-slate-100 relative">
                {/* Fallback warning if store hasn't configured bank details */}
                {(!operationSettings.bankBin || !operationSettings.bankAccountNumber) && (
                  <div className="absolute top-2 left-2 right-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-2 text-[10px] font-bold text-center leading-tight">
                    ⚠️ Chưa cấu hình ngân hàng. Đang hiển thị tài khoản demo!
                  </div>
                )}
                <div className="bg-white p-2.5 rounded-xl shadow-sm border border-slate-200/60 flex items-center justify-center mt-6">
                  <canvas ref={qrCanvasRef} className="w-[240px] h-[240px]" />
                </div>
                <div className="mt-3 flex items-center gap-1.5 bg-blue-50 border border-blue-100 px-3 py-1 rounded-full text-[10px] font-black text-blue-700 uppercase tracking-wider">
                  <span>VietQR / Napas 247</span>
                </div>
              </div>

              {/* Right Column: Account Details Text */}
              <div className="space-y-4">
                {/* Store active bank details */}
                <div className="space-y-3.5 divide-y divide-slate-100 text-sm">
                  <div className="pb-2.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Ngân hàng thụ hưởng</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-extrabold text-slate-800">
                        {activeBank ? `${activeBank.shortName} - ${activeBank.name}` : 'Ngân hàng TMCP Á Châu (ACB) [Demo]'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2.5 pb-2.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Số tài khoản</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-mono font-black text-slate-900 text-base">
                        {operationSettings.bankAccountNumber || '257678859'}
                      </span>
                      <button
                        onClick={() => copyToClipboard(operationSettings.bankAccountNumber || '257678859', 'Số tài khoản')}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded transition"
                        title="Sao chép số tài khoản"
                      >
                        <HiOutlineDuplicate className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="pt-2.5 pb-2.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Chủ tài khoản</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-black text-slate-800 uppercase">
                        {operationSettings.bankAccountName || 'NGUYEN XUAN NGHIA'}
                      </span>
                      <button
                        onClick={() => copyToClipboard(operationSettings.bankAccountName || 'NGUYEN XUAN NGHIA', 'Tên chủ tài khoản')}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded transition"
                        title="Sao chép tên chủ tài khoản"
                      >
                        <HiOutlineDuplicate className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="pt-2.5 pb-2.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Số tiền thanh toán</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-black text-blue-600 text-xl">
                        {money(finalAmount)}
                      </span>
                      <button
                        onClick={() => copyToClipboard(String(finalAmount), 'Số tiền')}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded transition"
                        title="Sao chép số tiền"
                      >
                        <HiOutlineDuplicate className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="pt-2.5 pb-1">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Nội dung chuyển khoản (Memo)</p>
                    <div className="flex items-center justify-between mt-1 bg-amber-50/50 border border-amber-100 rounded-lg p-2.5">
                      <span className="font-mono font-black text-amber-800">
                        {transferMemo}
                      </span>
                      <button
                        onClick={() => copyToClipboard(transferMemo, 'Nội dung chuyển khoản')}
                        className="p-1 text-amber-700 hover:bg-amber-100/50 rounded transition"
                        title="Sao chép nội dung"
                      >
                        <HiOutlineDuplicate className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="grid grid-cols-2 gap-3 p-5 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => setShowTransferPayment(false)}
                className="py-2.5 border border-slate-200 bg-white text-slate-600 text-xs font-black rounded-xl hover:bg-slate-100 transition"
              >
                Quay lại
              </button>
              <button
                onClick={() => checkout(true, true)}
                disabled={loading}
                className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl flex items-center justify-center gap-1.5 transition disabled:opacity-50"
              >
                <HiOutlineCheck className="w-4 h-4 stroke-[3]" />
                <span>Xác nhận đã nhận tiền (F9)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3.2. CUSTOM CHECKOUT CONFIRMATION MODAL */}
      {showCheckoutConfirm && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-fadeIn">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Xác nhận thanh toán</h3>
              <p className="text-xs font-semibold text-slate-400 mt-0.5">Vui lòng kiểm tra lại thông tin đơn hàng trước khi hoàn tất.</p>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <p className="text-sm font-semibold text-slate-600">
                Bạn có chắc chắn muốn tiến hành thanh toán cho đơn hàng này không?
              </p>

              {/* Order Summary Box */}
              <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 space-y-2.5 text-xs font-bold text-slate-600">
                <div className="flex justify-between items-center">
                  <span>Số lượng sản phẩm:</span>
                  <span className="text-slate-800 font-extrabold">{cart.reduce((s, i) => s + i.quantity, 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Tạm tính:</span>
                  <span className="text-slate-800">{money(total)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between items-center text-red-500">
                    <span>Chiết khấu:</span>
                    <span>-{money(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center border-t border-slate-200 pt-2.5 text-sm font-extrabold text-slate-800">
                  <span>Tổng tiền thanh toán:</span>
                  <span className="text-lg font-black text-blue-600">{money(finalAmount)}</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="grid grid-cols-2 gap-3 p-5 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => setShowCheckoutConfirm(false)}
                className="py-2.5 border border-slate-200 bg-white text-slate-600 text-xs font-black rounded-xl hover:bg-slate-100 transition"
              >
                Quay lại
              </button>
              <button
                onClick={() => {
                  setShowCheckoutConfirm(false);
                  checkout(false, true);
                }}
                className="py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl flex items-center justify-center gap-1.5 transition"
              >
                <HiOutlineCheck className="w-4 h-4 stroke-[3]" />
                <span>Xác nhận (F9)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3.3. CUSTOM CLEAR CART CONFIRMATION MODAL */}
      {showClearCartConfirm && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-fadeIn">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 bg-red-50/30">
              <h3 className="text-base font-black text-red-700 uppercase tracking-tight">Xóa giỏ hàng</h3>
              <p className="text-xs font-semibold text-slate-400 mt-0.5">Thao tác này sẽ dọn trống toàn bộ sản phẩm hiện tại.</p>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <p className="text-sm font-semibold text-slate-600">
                Bạn có chắc chắn muốn xóa toàn bộ sản phẩm trong giỏ hàng không? Hành động này không thể khôi phục lại.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="grid grid-cols-2 gap-3 p-5 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => setShowClearCartConfirm(false)}
                className="py-2.5 border border-slate-200 bg-white text-slate-600 text-xs font-black rounded-xl hover:bg-slate-100 transition"
              >
                Hủy bỏ
              </button>
              <button
                onClick={() => {
                  setCart([]);
                  setReceivedAmount(0);
                  setShowCashPayment(false);
                  setDiscountValue(0);
                  setVoucherCode('');
                  setShowClearCartConfirm(false);
                  toast.success('Đã xóa giỏ hàng');
                }}
                className="py-2.5 bg-red-650 hover:bg-red-700 text-white text-xs font-black rounded-xl flex items-center justify-center gap-1.5 transition"
              >
                <HiOutlineTrash className="w-4 h-4" />
                <span>Xóa sạch</span>
              </button>
            </div>
          </div>
        </div>
      )}



      {/* 4. SUCCESS — FULL INVOICE PREVIEW MODAL */}
      {checkoutSuccessInfo && (() => {
        const info = checkoutSuccessInfo;
        const storeName = operationSettings.storeName || 'SORA MART';

        const handleDownloadInvoice = async () => {
          const el = document.getElementById('invoice-preview-card');
          if (!el) return;
          try {
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
                  onClick={() => handlePrintInvoice(info.orderNumber, info.cart)}
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

            {/* Invoice Preview */}
            <div className="flex-1 overflow-y-auto p-5">
              <div id="invoice-preview-card" className="bg-white rounded border border-slate-300 shadow-sm overflow-hidden mx-auto max-w-[640px]">
                {/* ─── Invoice Header ─── */}
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

                {/* ─── Billing Info ─── */}
                <div className="mx-7 border-t border-b border-slate-300 py-3 grid grid-cols-3 gap-5">
                  <div>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Khách hàng</p>
                    <p className="text-xs font-bold text-slate-800">{info.customerName}</p>
                    {info.customerPhone && <p className="text-[11px] text-slate-500 font-medium mt-0.5">{info.customerPhone}</p>}
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

                {/* ─── Items Table ─── */}
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
                      {info.cart.map((item, idx) => (
                        <tr key={idx} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'} border-b border-slate-100`}>
                          <td className="px-7 py-2.5">
                            <p className="text-[12px] font-semibold text-slate-800">{item.product.name}</p>
                            {item.product.sku && <p className="text-[9px] text-slate-400 font-medium mt-0.5">{item.product.sku}</p>}
                          </td>
                          <td className="text-center px-3 py-2.5 text-[12px] font-semibold text-slate-700">{item.quantity}</td>
                          <td className="text-right px-3 py-2.5 text-[12px] text-slate-600">{money(item.product.sell_price)}</td>
                          <td className="text-right px-7 py-2.5 text-[12px] font-bold text-slate-900">{money(Number(item.product.sell_price) * item.quantity)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* ─── Totals ─── */}
                <div className="flex justify-end px-7 py-4">
                  <div className="w-64 space-y-1.5">
                    <div className="flex justify-between text-[12px]">
                      <span className="text-slate-500 font-semibold">Tạm tính:</span>
                      <span className="font-bold text-slate-700">{money(info.cart.reduce((s, i) => s + Number(i.product.sell_price) * i.quantity, 0))}</span>
                    </div>
                    {info.discountAmount > 0 && (
                      <div className="flex justify-between text-[12px]">
                        <span className="text-slate-500 font-semibold">Chiết khấu:</span>
                        <span className="font-bold text-red-600">-{money(info.discountAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center border-t border-slate-300 pt-2 mt-1">
                      <span className="text-sm font-bold text-slate-900">Tổng cộng:</span>
                      <span className="text-base font-bold text-slate-900">{money(info.finalAmount)}</span>
                    </div>
                  </div>
                </div>

                {/* ─── Payment Info ─── */}
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
                        <span className="font-bold text-slate-800">{money(info.receivedAmount)}</span>
                      </div>
                      {info.change > 0 && (
                        <div className="flex justify-between text-[12px]">
                          <span className="text-slate-500 font-semibold">Tiền thừa:</span>
                          <span className="font-bold text-emerald-700">{money(info.change)}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* ─── Loyalty Points Info (CGV Style) ─── */}
                {info.customerName !== 'Khách lẻ' && info.pointsBefore !== undefined && (
                  <div className="mx-7 border-t border-slate-200 py-3.5 space-y-1.5 bg-blue-50/20 px-4 rounded-xl border border-blue-100/50 mb-3">
                    <div className="flex justify-between text-[12px]">
                      <span className="text-blue-600/70 font-semibold">Điểm tích lũy trước:</span>
                      <span className="font-bold text-slate-700">{info.pointsBefore} đp</span>
                    </div>
                    {info.pointsUsed !== undefined && info.pointsUsed > 0 && (
                      <div className="flex justify-between text-[12px]">
                        <span className="text-red-500 font-semibold">Điểm đã sử dụng:</span>
                        <span className="font-bold text-red-650">-{info.pointsUsed} đp</span>
                      </div>
                    )}
                    <div className="flex justify-between text-[12px]">
                      <span className="text-emerald-600 font-semibold">Điểm tích lũy mới:</span>
                      <span className="font-bold text-emerald-600">+{info.pointsEarned} đp</span>
                    </div>
                    <div className="flex justify-between text-[12px] border-t border-slate-200/60 pt-1.5 mt-1 font-black">
                      <span className="text-slate-800">Số dư điểm hiện tại:</span>
                      <span className="text-blue-600">{info.pointsAfter} đp</span>
                    </div>
                  </div>
                )}

                {/* ─── Footer ─── */}
                <div className="text-center py-5 bg-slate-50/60 border-t border-slate-200">
                  <p className="text-xs font-bold text-slate-700">{operationSettings.receiptFooter || 'Cảm ơn quý khách đã mua sắm!'}</p>
                  <p className="text-[10px] text-slate-500 font-medium mt-0.5">Hẹn gặp lại quý khách!</p>
                  <p className="text-[8px] text-slate-400 font-bold mt-3 uppercase tracking-wider">Powered by Sora POS</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

    </div>
  );
};

export default POSPage;
