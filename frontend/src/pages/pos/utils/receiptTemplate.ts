import { Product, Customer } from '../../../types/domain.type';
import { OperationSettings } from '../../../services/settings.api';

interface CartItem {
  product: Product;
  quantity: number;
}

interface ReceiptData {
  orderNumber: string;
  cart: CartItem[];
  total: number;
  finalAmount: number;
  discountAmount: number;
  change: number;
  paymentMethod: string;
  receivedAmount: number;
  customerName: string;
  customerPhone: string;
  cashierName: string;
  date: string;
  pointsBefore?: number;
  pointsUsed?: number;
  pointsEarned?: number;
  pointsAfter?: number;
}

const money = (value: number, currency = 'VND', locale = 'vi-VN') => {
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

const escapeHtml = (value: unknown) =>
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

export const buildReceiptHtml = (
  data: ReceiptData,
  operationSettings: OperationSettings
): string => {
  const storeName = operationSettings.storeName || 'SORA MART';
  const safeStoreName = escapeHtml(storeName);
  const safeBranchName = escapeHtml(operationSettings.branchName || '');
  const safeAddress = escapeHtml(operationSettings.address || '');
  const safeHotline = escapeHtml(operationSettings.hotline || '');
  const safeTaxCode = escapeHtml(operationSettings.taxCode || '');
  const safeBusinessHours = escapeHtml(operationSettings.businessHours || '');
  const safeReceiptFooter = escapeHtml(operationSettings.receiptFooter || 'Cảm ơn quý khách đã mua sắm!');
  const paperWidth = operationSettings.receiptPaperSize === 'a5' ? '148mm' : '80mm';
  const copyCount = Math.max(1, Math.min(5, Number(operationSettings.receiptCopies) || 1));
  const nowStr = data.date || new Date().toLocaleString(operationSettings.locale || 'vi-VN');

  const cartRowsHtml = data.cart.map((item, idx) => `
    <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
      <td style="padding: 10px 14px; font-size: 13px; color: #334155;">
        <div style="font-weight: 600;">${escapeHtml(item.product.name)}</div>
        <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">${escapeHtml(item.product.sku || '')}</div>
      </td>
      <td style="text-align: center; padding: 10px 8px; font-size: 13px; color: #475569; font-weight: 600;">${item.quantity}</td>
      <td style="text-align: right; padding: 10px 8px; font-size: 13px; color: #475569;">${money(item.product.sell_price, operationSettings.currency, operationSettings.locale)}</td>
      <td style="text-align: right; padding: 10px 14px; font-size: 13px; font-weight: 700; color: #1e293b;">${money(Number(item.product.sell_price) * item.quantity, operationSettings.currency, operationSettings.locale)}</td>
    </tr>
  `).join('');

  const hasPointsInfo =
    data.customerName !== 'Khách lẻ' &&
    ((data.pointsBefore ?? 0) > 0 || (data.pointsUsed ?? 0) > 0 || (data.pointsEarned ?? 0) > 0);

  const html = `
    <html>
      <head>
        <title>Hóa đơn ${escapeHtml(data.orderNumber)} - ${safeStoreName}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            color: #1e293b;
            background: #ffffff;
            padding: 10px;
          }
          .invoice-container {
            max-width: ${paperWidth};
            margin: 0 auto;
            background: #ffffff;
            border: 1px solid #cbd5e1;
            padding: 15px;
          }
          .invoice-header {
            text-align: center;
            padding-bottom: 15px;
            border-bottom: 1px dashed #cbd5e1;
            margin-bottom: 15px;
          }
          .invoice-header h1 {
            font-size: 18px;
            font-weight: 850;
            color: #0f172a;
            text-transform: uppercase;
            margin-bottom: 5px;
          }
          .invoice-header p {
            font-size: 11px;
            color: #64748b;
            line-height: 1.4;
          }
          .invoice-title {
            text-align: center;
            font-size: 16px;
            font-weight: 800;
            margin: 12px 0 6px;
            letter-spacing: 0.5px;
          }
          .invoice-meta {
            font-size: 12px;
            color: #334155;
            margin-bottom: 12px;
            line-height: 1.5;
          }
          .invoice-meta div {
            display: flex;
            justify-content: space-between;
          }
          .invoice-meta span.label {
            color: #64748b;
            font-weight: 500;
          }
          .invoice-meta span.val {
            font-weight: 600;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
          }
          .items-table th {
            background: #f8fafc;
            padding: 8px 10px;
            font-size: 11px;
            font-weight: 700;
            color: #475569;
            text-transform: uppercase;
            border-bottom: 1px solid #cbd5e1;
            text-align: right;
          }
          .items-table th:first-child { text-align: left; }
          .items-table th:nth-child(2) { text-align: center; }
          .items-table tbody td {
            border-bottom: 1px solid #f1f5f9;
            padding: 8px 10px;
          }
          .totals-block {
            border-top: 1px dashed #cbd5e1;
            padding-top: 10px;
            margin-bottom: 15px;
          }
          .totals-row {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            padding: 3px 0;
          }
          .totals-row.grand-total {
            font-size: 15px;
            font-weight: 800;
            border-top: 1px solid #0f172a;
            margin-top: 5px;
            padding-top: 8px;
          }
          .loyalty-block {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 8px 12px;
            margin-bottom: 15px;
            font-size: 11px;
          }
          .loyalty-row {
            display: flex;
            justify-content: space-between;
            padding: 2px 0;
            color: #475569;
          }
          .invoice-footer {
            text-align: center;
            border-top: 1px dashed #cbd5e1;
            padding-top: 15px;
            margin-top: 15px;
            font-size: 11px;
            color: #64748b;
          }
          .invoice-footer .thank-you {
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 3px;
          }
          @media print {
            body { padding: 0; }
            .receipt-copy { break-after: page; page-break-after: always; }
            .receipt-copy:last-of-type { break-after: auto; page-break-after: auto; }
            .invoice-container { border: none; width: ${paperWidth}; max-width: ${paperWidth}; padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <div class="invoice-header">
            <h1>${safeStoreName}</h1>
            ${safeBranchName ? `<p>${safeBranchName}</p>` : ''}
            ${safeAddress ? `<p>${safeAddress}</p>` : ''}
            ${safeHotline ? `<p>Hotline: ${safeHotline}</p>` : ''}
            ${safeTaxCode ? `<p>MST: ${safeTaxCode}</p>` : ''}
            ${safeBusinessHours ? `<p>Giờ mở cửa: ${safeBusinessHours}</p>` : ''}
          </div>

          <div class="invoice-title">HÓA ĐƠN BÁN HÀNG</div>
          
          <div class="invoice-meta">
            <div>
              <span class="label">Mã hóa đơn:</span>
              <span class="val">${escapeHtml(data.orderNumber)}</span>
            </div>
            <div>
              <span class="label">Ngày giờ:</span>
              <span class="val">${nowStr}</span>
            </div>
            <div>
              <span class="label">Thu ngân:</span>
              <span class="val">${escapeHtml(data.cashierName)}</span>
            </div>
            <div>
              <span class="label">Khách hàng:</span>
              <span class="val">${escapeHtml(data.customerName)} ${data.customerPhone ? `(${escapeHtml(data.customerPhone)})` : ''}</span>
            </div>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 45%;">Sản phẩm</th>
                <th style="width: 12%; text-align: center;">SL</th>
                <th style="width: 21%;">Đơn giá</th>
                <th style="width: 22%;">T.Tiền</th>
              </tr>
            </thead>
            <tbody>
              ${cartRowsHtml}
            </tbody>
          </table>

          <div class="totals-block">
            <div class="totals-row">
              <span>Tạm tính:</span>
              <span>${money(data.total, operationSettings.currency, operationSettings.locale)}</span>
            </div>
            ${data.discountAmount > 0 ? `
              <div class="totals-row" style="color: #dc2626;">
                <span>Chiết khấu:</span>
                <span>-${money(data.discountAmount, operationSettings.currency, operationSettings.locale)}</span>
              </div>
            ` : ''}
            <div class="totals-row grand-total">
              <span>TỔNG CỘNG:</span>
              <span>${money(data.finalAmount, operationSettings.currency, operationSettings.locale)}</span>
            </div>
            <div class="totals-row" style="margin-top: 5px;">
              <span>Hình thức thanh toán:</span>
              <span>${data.paymentMethod === 'cash' ? 'Tiền mặt' : data.paymentMethod === 'transfer' ? 'Chuyển khoản QR' : 'Thẻ'}</span>
            </div>
            ${data.paymentMethod === 'cash' ? `
              <div class="totals-row">
                <span>Khách đưa:</span>
                <span>${money(data.receivedAmount, operationSettings.currency, operationSettings.locale)}</span>
              </div>
              <div class="totals-row" style="color: #047857; font-weight: 600;">
                <span>Tiền trả lại:</span>
                <span>${money(data.change, operationSettings.currency, operationSettings.locale)}</span>
              </div>
            ` : ''}
          </div>

          ${hasPointsInfo ? `
            <div class="loyalty-block">
              <div style="font-weight: 700; margin-bottom: 5px; color: #0f172a;">Thông tin điểm tích lũy</div>
              <div class="loyalty-row">
                <span>Số dư điểm cũ:</span>
                <span>${data.pointsBefore ?? 0} điểm</span>
              </div>
              ${(data.pointsUsed ?? 0) > 0 ? `
                <div class="loyalty-row" style="color: #dc2626;">
                  <span>Điểm đã dùng:</span>
                  <span>-${data.pointsUsed} điểm</span>
                </div>
              ` : ''}
              <div class="loyalty-row" style="color: #2563eb;">
                <span>Điểm tích mới:</span>
                <span>+${data.pointsEarned ?? 0} điểm</span>
              </div>
              <div class="loyalty-row" style="border-top: 1px dashed #cbd5e1; margin-top: 5px; padding-top: 5px; font-weight: 700; color: #0f172a;">
                <span>Số dư điểm mới:</span>
                <span>${data.pointsAfter ?? 0} điểm</span>
              </div>
            </div>
          ` : ''}

          <div class="invoice-footer">
            <div class="thank-you">${safeReceiptFooter}</div>
            <div>Hẹn gặp lại quý khách!</div>
            <div style="font-size: 8px; color: #cbd5e1; margin-top: 10px; letter-spacing: 0.5px;">POWERED BY SORA POS</div>
          </div>
        </div>
        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
    </html>
  `;

  if (copyCount === 1) return html;

  const bodyMatch = html.match(/<body>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) return html;

  const bodyContent = bodyMatch[1];
  const printScript = bodyContent.match(/<script>[\s\S]*?<\/script>/i)?.[0] || '';
  const invoiceContent = bodyContent.replace(printScript, '');
  const repeatedContent = Array.from({ length: copyCount }, () => `<div class="receipt-copy">${invoiceContent}</div>`).join('');

  return html.replace(bodyMatch[0], `<body>${repeatedContent}${printScript}</body>`);
};
