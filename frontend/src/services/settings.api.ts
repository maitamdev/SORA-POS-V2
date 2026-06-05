import api from './api';
import { ApiResponse } from '../types/user.type';

export interface OperationSettings {
  storeName: string;
  branchName: string;
  taxCode: string;
  address: string;
  hotline: string;
  businessHours: string;
  currency: string;
  locale: string;
  defaultPaymentMethod: 'cash' | 'transfer' | 'card';
  allowDiscount: boolean;
  maxDiscountPercent: number;
  requireCustomerPhone: boolean;
  autoPrintReceipt: boolean;
  receiptPaperSize: 'k80' | 'a5';
  receiptCopies: number;
  receiptFooter: string;
  lowStockWarning: boolean;
  defaultMinStockLevel: number;
  allowSellOutOfStock: boolean;
  barcodeAutoAdd: boolean;
  productPageSize: number;
  confirmBeforeCheckout: boolean;
  sessionLockMinutes: number;
  compactMode: boolean;
  bankBin: string;
  bankAccountNumber: string;
  bankAccountName: string;
}

export interface OperationSettingsResponse {
  settings: OperationSettings;
  updated_at: string | null;
  updated_by: string | null;
}

export const defaultOperationSettings: OperationSettings = {
  storeName: 'SORA MART',
  branchName: '',
  taxCode: '',
  address: '',
  hotline: '',
  businessHours: '08:00 - 22:00',
  currency: 'VND',
  locale: 'vi-VN',
  defaultPaymentMethod: 'cash',
  allowDiscount: true,
  maxDiscountPercent: 20,
  requireCustomerPhone: false,
  autoPrintReceipt: true,
  receiptPaperSize: 'k80',
  receiptCopies: 1,
  receiptFooter: 'Cảm ơn quý khách đã mua sắm!',
  lowStockWarning: true,
  defaultMinStockLevel: 10,
  allowSellOutOfStock: false,
  barcodeAutoAdd: true,
  productPageSize: 20,
  confirmBeforeCheckout: false,
  sessionLockMinutes: 30,
  compactMode: false,
  bankBin: '',
  bankAccountNumber: '',
  bankAccountName: '',
};

export const settingsAPI = {
  getOperation: () => api.get<ApiResponse<OperationSettingsResponse>>('/settings/operation'),
  updateOperation: (settings: OperationSettings) =>
    api.put<ApiResponse<OperationSettingsResponse>>('/settings/operation', settings),
  defaults: () => api.get<ApiResponse<OperationSettings>>('/settings/operation/defaults'),
};
