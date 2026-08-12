import api from './api';
import { ApiResponse } from '../types/user.type';
import { queryCache } from '../utils/queryCache';
import { z } from 'zod';

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

const operationSettingsSchema = z.object({
  storeName: z.string().trim().min(1),
  branchName: z.string().trim().default(''),
  taxCode: z.string().trim().default(''),
  address: z.string().trim().default(''),
  hotline: z.string().trim().default(''),
  businessHours: z.string().trim().default(''),
  currency: z.string().trim().min(1).default('VND'),
  locale: z.string().trim().min(1).default('vi-VN'),
  defaultPaymentMethod: z.enum(['cash', 'transfer', 'card']).default('cash'),
  allowDiscount: z.boolean().default(true),
  maxDiscountPercent: z.coerce.number().min(0).max(100).default(20),
  requireCustomerPhone: z.boolean().default(false),
  autoPrintReceipt: z.boolean().default(true),
  receiptPaperSize: z.enum(['k80', 'a5']).default('k80'),
  receiptCopies: z.coerce.number().int().min(1).max(5).default(1),
  receiptFooter: z.string().trim().default(''),
  lowStockWarning: z.boolean().default(true),
  defaultMinStockLevel: z.coerce.number().int().min(0).max(9999).default(10),
  allowSellOutOfStock: z.boolean().default(false),
  barcodeAutoAdd: z.boolean().default(true),
  productPageSize: z.coerce.number().int().min(8).max(100).default(20),
  confirmBeforeCheckout: z.boolean().default(false),
  sessionLockMinutes: z.coerce.number().int().min(5).max(240).default(30),
  compactMode: z.boolean().default(false),
  bankBin: z.string().trim().default(''),
  bankAccountNumber: z.string().trim().default(''),
  bankAccountName: z.string().trim().default(''),
});

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

export const normalizeOperationSettings = (value: unknown): OperationSettings =>
  operationSettingsSchema.parse({
    ...defaultOperationSettings,
    ...(typeof value === 'object' && value ? value : {}),
  });

const SETTINGS_CACHE_KEY = 'settings:operation';

export const OPERATION_SETTINGS_UPDATED_EVENT = 'sora:operation-settings-updated';

type SettingsListener = (settings: OperationSettings) => void;
const settingsListeners = new Set<SettingsListener>();
let settingsChannel: BroadcastChannel | null = null;

const cacheOperationSettings = (
  settings: OperationSettings,
  updatedAt: string | null = null,
  updatedBy: string | null = null
) => {
  queryCache.set<ApiResponse<OperationSettingsResponse>>(
    SETTINGS_CACHE_KEY,
    {
      success: true,
      message: 'Operation settings cached locally',
      data: {
        settings,
        updated_at: updatedAt,
        updated_by: updatedBy,
      },
    },
    5 * 60 * 1000
  );
};

const ensureSettingsChannel = () => {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
  if (!settingsChannel) {
    settingsChannel = new BroadcastChannel('sora-pos-operation-settings');
    settingsChannel.onmessage = (event) => {
      try {
        const nextSettings = normalizeOperationSettings(event.data);
        cacheOperationSettings(nextSettings);
        settingsListeners.forEach((listener) => listener(nextSettings));
      } catch {
        // Ignore malformed cross-tab messages. The active tab keeps its current settings.
      }
    };
  }
  return settingsChannel;
};

export const publishOperationSettings = (
  settings: OperationSettings,
  metadata?: { updatedAt?: string | null; updatedBy?: string | null }
) => {
  const nextSettings = normalizeOperationSettings(settings);
  cacheOperationSettings(nextSettings, metadata?.updatedAt ?? null, metadata?.updatedBy ?? null);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<OperationSettings>(OPERATION_SETTINGS_UPDATED_EVENT, {
        detail: nextSettings,
      })
    );
    ensureSettingsChannel()?.postMessage(nextSettings);
  }
};

export const subscribeOperationSettings = (listener: SettingsListener) => {
  if (typeof window === 'undefined') return () => undefined;

  const handleWindowEvent = (event: Event) => {
    try {
      const nextSettings = normalizeOperationSettings(
        (event as CustomEvent<OperationSettings>).detail
      );
      listener(nextSettings);
    } catch {
      // Ignore malformed in-app messages.
    }
  };

  settingsListeners.add(listener);
  window.addEventListener(OPERATION_SETTINGS_UPDATED_EVENT, handleWindowEvent);
  ensureSettingsChannel();

  return () => {
    settingsListeners.delete(listener);
    window.removeEventListener(OPERATION_SETTINGS_UPDATED_EVENT, handleWindowEvent);
    if (settingsListeners.size === 0 && settingsChannel) {
      settingsChannel.close();
      settingsChannel = null;
    }
  };
};

export const settingsAPI = {
  getOperation: async () => {
    const cached = queryCache.get<ApiResponse<OperationSettingsResponse>>(SETTINGS_CACHE_KEY);
    if (cached) {
      return {
        data: {
          ...cached,
          data: {
            ...cached.data,
            settings: normalizeOperationSettings(cached.data.settings),
          },
        },
      } as any;
    }

    const res = await api.get<ApiResponse<OperationSettingsResponse>>('/settings/operation');
    res.data.data.settings = normalizeOperationSettings(res.data.data.settings);
    queryCache.set(SETTINGS_CACHE_KEY, res.data, 5 * 60 * 1000); // Cache 5 min
    return res;
  },
  updateOperation: async (settings: OperationSettings) => {
    const submittedSettings = normalizeOperationSettings(settings);
    const res = await api.put<ApiResponse<OperationSettingsResponse>>(
      '/settings/operation',
      submittedSettings
    );

    // Demo mode intentionally intercepts write requests and returns a minimal
    // mock payload. Keep the submitted values in the current session instead
    // of interpreting that payload as the default settings.
    const responseData =
      res.data.data && typeof res.data.data === 'object' && !Array.isArray(res.data.data)
        ? (res.data.data as Partial<OperationSettingsResponse> & Record<string, unknown>)
        : {};
    const appliedSettings = normalizeOperationSettings(responseData.settings ?? submittedSettings);
    res.data.data = {
      ...responseData,
      settings: appliedSettings,
      updated_at: responseData.updated_at ?? new Date().toISOString(),
      updated_by: responseData.updated_by ?? null,
    };

    publishOperationSettings(appliedSettings, {
      updatedAt: res.data.data.updated_at,
      updatedBy: res.data.data.updated_by,
    });
    return res;
  },
  defaults: () => api.get<ApiResponse<OperationSettings>>('/settings/operation/defaults'),
};

