import { Product, Customer } from '../../../types/domain.type';
import { POPULAR_BANKS } from '../../../utils/banks';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface CheckoutSuccessInfo {
  orderId?: string;
  publicReceiptToken?: string | null;
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
}

/* ------------------------------------------------------------------ */
/*  Formatters                                                         */
/* ------------------------------------------------------------------ */

export const money = (
  value: number | string,
  currency = 'VND',
  locale = 'vi-VN'
) => {
  const numericValue = Number(value || 0);
  const safeCurrency = /^[A-Z]{3}$/.test(currency) ? currency : 'VND';

  try {
    return new Intl.NumberFormat(locale || 'vi-VN', {
      style: 'currency',
      currency: safeCurrency,
      currencyDisplay: 'symbol',
      maximumFractionDigits: safeCurrency === 'VND' ? 0 : 2,
    }).format(Number.isFinite(numericValue) ? numericValue : 0);
  } catch {
    return `${Number.isFinite(numericValue) ? numericValue.toLocaleString('vi-VN') : '0'} ${safeCurrency}`;
  }
};

export const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[char];
  });

/* ------------------------------------------------------------------ */
/*  Product Helpers                                                    */
/* ------------------------------------------------------------------ */

export const getProductImage = (product: Product) => {
  return product.image_url || '/assets/product-placeholder.svg';
};

/* ------------------------------------------------------------------ */
/*  Bank Helpers                                                       */
/* ------------------------------------------------------------------ */

const binToCode: Record<string, string> = {
  '970436': 'VCB',
  '970415': 'ICB',
  '970418': 'BIDV',
  '970405': 'VBA',
  '970407': 'TCB',
  '970422': 'MB',
  '970416': 'ACB',
  '970403': 'STB',
  '970432': 'VPB',
  '970437': 'HDB',
  '970423': 'TPB',
  '970441': 'VIB',
  '970426': 'MSB',
  '970443': 'SHB',
  '970448': 'OCB',
  '970431': 'EIB',
  '970454': 'BVB',
  '970428': 'NAB',
  '970430': 'PGB',
  '970400': 'SGB',
  '970452': 'KLB',
  '970425': 'ABB',
  '970444': 'CBB',
  '970421': 'VRB',
  '970457': 'WVN',
  '970439': 'PBVN',
  '970424': 'SHBVN',
  '970410': 'SCVN',
  '970434': 'IVB',
  '970442': 'HLBVN',
  '458761': 'HSBC',
  '970446': 'COOPBANK',
};

export const getBankLogoUrl = (bin: string): string | null => {
  if (!bin) return null;
  const code = binToCode[bin];
  if (!code) return null;
  return `https://api.vietqr.io/img/${code}.png`;
};

export const getActiveBank = (bankBin: string) => {
  if (!bankBin) return null;
  return POPULAR_BANKS.find((b) => b.bin === bankBin) || null;
};

/* ------------------------------------------------------------------ */
/*  Clipboard                                                          */
/* ------------------------------------------------------------------ */

export const copyToClipboard = (text: string, label: string) => {
  navigator.clipboard.writeText(text);
  // Toast is handled by caller
  return label;
};

/* ------------------------------------------------------------------ */
/*  Lazy QRCode loader                                                 */
/* ------------------------------------------------------------------ */

let _QRCode: any = null;
export const getQRCode = async () => {
  if (!_QRCode) {
    const mod = await import('qrcode');
    _QRCode = mod.default || mod;
  }
  return _QRCode;
};

export interface InvoiceQrData {
  storeName: string;
  orderNumber: string;
  total: number;
  finalAmount: number;
  date: string;
  currency?: string;
  locale?: string;
  orderId?: string;
  publicReceiptToken?: string | null;
}

/**
 * The online QR opens the public invoice page. Offline receipts do not show
 * a QR because there is no server-side invoice page to open yet.
 */
export const buildInvoiceQrText = (data: InvoiceQrData) => [
  'SORA POS - THONG TIN HOA DON',
  `Cua hang: ${data.storeName || 'SORA MART'}`,
  `Ma hoa don: ${data.orderNumber}`,
  `Tam tinh: ${money(data.total, data.currency, data.locale)}`,
  `Thanh toan: ${money(data.finalAmount, data.currency, data.locale)}`,
  `Ngay: ${data.date}`,
].join('\n');

export const buildInvoiceQrUrl = (data: InvoiceQrData) => {
  if (typeof window === 'undefined' || !data.orderId || !data.publicReceiptToken) return '';

  return `${window.location.origin}/invoice/${encodeURIComponent(data.orderId)}?token=${encodeURIComponent(data.publicReceiptToken)}`;
};

export const buildInvoiceQrDataUrl = async (data: InvoiceQrData): Promise<string> => {
  try {
    const publicReceiptUrl = buildInvoiceQrUrl(data);
    if (!publicReceiptUrl) return '';

    const QR = await getQRCode();
    return await QR.toDataURL(publicReceiptUrl, {
      width: 180,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' },
    });
  } catch (error) {
    console.warn('[Receipt QR] Khong the tao QR hoa don:', error);
    return '';
  }
};
