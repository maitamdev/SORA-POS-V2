import api from './api';
import { ApiResponse } from '../types/user.type';
import { queryCache } from '../utils/queryCache';

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

const SETTINGS_CACHE_KEY = 'settings:operation';

export const settingsAPI = {
  getOperation: async () => {
    const cached = queryCache.get<ApiResponse<OperationSettingsResponse>>(SETTINGS_CACHE_KEY);
    if (cached) return { data: cached } as any;

    const res = await api.get<ApiResponse<OperationSettingsResponse>>('/settings/operation');
    queryCache.set(SETTINGS_CACHE_KEY, res.data, 5 * 60 * 1000); // Cache 5 min
    return res;
  },
  updateOperation: async (settings: OperationSettings) => {
    const res = await api.put<ApiResponse<OperationSettingsResponse>>('/settings/operation', settings);
    queryCache.invalidatePrefix('settings:');
    return res;
  },
  defaults: () => api.get<ApiResponse<OperationSettings>>('/settings/operation/defaults'),
};

