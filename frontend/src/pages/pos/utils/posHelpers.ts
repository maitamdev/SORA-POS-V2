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

export const money = (value: number | string) =>
  `${Number(value || 0).toLocaleString('vi-VN')}đ`;

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
