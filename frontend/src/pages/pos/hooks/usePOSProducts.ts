import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { catalogAPI } from '../../../services/catalog.api';
import {
  defaultOperationSettings,
  normalizeOperationSettings,
  settingsAPI,
  subscribeOperationSettings,
} from '../../../services/settings.api';
import { usePOSStore } from '../../../stores/pos.store';
import { useAuthStore } from '../../../stores/auth.store';
import {
  getProductsOffline,
  getCategoriesOffline,
  getCustomersOffline,
} from '../../../services/offlineDB';

/**
 * Hook that handles loading products, categories, customers, and settings.
 * Connects to the Zustand POS store.
 */
export const usePOSProducts = () => {
  const {
    search,
    selectedCategoryId,
    page,
    operationSettings,
    setProducts,
    setPagination,
    setCategories,
    setCustomers,
    setOperationSettings,
    setPaymentMethod,
  } = usePOSStore();
  const user = useAuthStore((state) => state.user);
  const canManageCustomerData = user?.role === 'admin' || user?.role === 'manager';

  // Load products with Stale-While-Revalidate (IndexedDB first -> network sync)
  const loadProducts = async () => {
    const categoryIdFilter = selectedCategoryId !== 'all' ? selectedCategoryId : undefined;

    // 1. Stale-While-Revalidate: Try IndexedDB first for instant 0ms load
    try {
      const { items: offlineItems, total: offlineTotal } = await getProductsOffline(
        search,
        categoryIdFilter,
        page,
        operationSettings.productPageSize
      );
      if (offlineItems && offlineItems.length > 0) {
        setProducts(offlineItems);
        setPagination({ page, limit: operationSettings.productPageSize, total: offlineTotal });
      }
    } catch (err) {
      console.warn('[POS Offline] Lỗi đọc dữ liệu offline:', err);
    }

    // 2. Fetch fresh data from Server if online
    if (!navigator.onLine) return;

    try {
      const params: Record<string, unknown> = {
        search,
        is_active: true,
        limit: operationSettings.productPageSize,
        page,
      };
      if (selectedCategoryId !== 'all') {
        params.category_id = selectedCategoryId;
      }

      const productRes = await catalogAPI.products.list(params);
      setProducts(productRes.data.data.items);
      setPagination(productRes.data.data.pagination);
    } catch (err) {
      console.warn('[POS Network] Lỗi fetch sản phẩm từ server:', err);
    }
  };

  // Load categories & customers with Stale-While-Revalidate
  const loadCategoriesAndCustomers = async () => {
    // 1. Fast boot from IndexedDB
    try {
      const offlineCategories = await getCategoriesOffline();
      if (offlineCategories.length > 0) setCategories(offlineCategories);
      if (canManageCustomerData) {
        const offlineCustomers = await getCustomersOffline();
        if (offlineCustomers.length > 0) setCustomers(offlineCustomers);
      } else {
        setCustomers([]);
      }
    } catch (err) {
      console.warn('[POS Offline] Lỗi đọc danh mục/khách hàng offline:', err);
    }

    // 2. Refresh from Server if online
    if (!navigator.onLine) return;

    try {
      const categoryRes = await catalogAPI.categories.list({ is_active: true, limit: 100 });
      setCategories(categoryRes.data.data.items);
      if (canManageCustomerData) {
        const customerRes = await catalogAPI.customers.list({ is_active: true, limit: 100 });
        setCustomers(customerRes.data.data.items);
      } else {
        setCustomers([]);
      }
    } catch (err) {
      console.warn('[POS Network] Lỗi fetch danh mục/khách hàng từ server:', err);
    }
  };

  // Effects
  useEffect(() => {
    loadCategoriesAndCustomers().catch(() =>
      toast.error('Không tải được danh mục và khách hàng')
    );
  }, [canManageCustomerData]);

  useEffect(() => {
    loadProducts().catch(() => toast.error('Không tải được dữ liệu POS'));
  }, [page, selectedCategoryId, search, operationSettings.productPageSize]);

  // Load operation settings on mount
  useEffect(() => {
    const applySettings = (value: unknown) => {
      const nextSettings = normalizeOperationSettings(value);
      setOperationSettings(nextSettings);
      setPaymentMethod(nextSettings.defaultPaymentMethod as 'cash' | 'transfer' | 'card');
    };

    const unsubscribe = subscribeOperationSettings(applySettings);

    settingsAPI
      .getOperation()
      .then((response) => {
        applySettings(response.data.data.settings);
      })
      .catch(() => {
        applySettings(defaultOperationSettings);
      });

    return unsubscribe;
  }, [setOperationSettings, setPaymentMethod]);

  return { loadProducts, loadCategoriesAndCustomers };
};
