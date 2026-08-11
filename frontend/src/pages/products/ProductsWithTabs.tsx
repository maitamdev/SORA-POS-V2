import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { HiOutlineCube } from 'react-icons/hi';
import { FiGift } from 'react-icons/fi';
import { catalogAPI } from '../../services/catalog.api';
import { Category } from '../../types/domain.type';
import PromotionsTab from './PromotionsTab';

// Lazy import the original Products content
import ProductsPage from './ProductsPage';

/**
 * Wrapper component that adds sub-tab navigation (Products | Promotions)
 * on top of the existing ProductsPage.
 */
const ProductsWithTabs = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');

  const [activeTab, setActiveTab] = useState<'products' | 'promotions'>(
    tabParam === 'promotions' ? 'promotions' : 'products'
  );

  const [categories, setCategories] = useState<Category[]>([]);

  // Sync tab with URL
  useEffect(() => {
    const current = searchParams.get('tab');
    if (activeTab === 'promotions' && current !== 'promotions') {
      setSearchParams({ tab: 'promotions' }, { replace: true });
    } else if (activeTab === 'products' && current === 'promotions') {
      searchParams.delete('tab');
      setSearchParams(searchParams, { replace: true });
    }
  }, [activeTab]);

  // Load categories for PromotionsTab
  useEffect(() => {
    if (activeTab === 'promotions' && categories.length === 0) {
      catalogAPI.categories.list({ limit: 100, is_active: true })
        .then((res) => setCategories(res.data.data.items))
        .catch(() => {});
    }
  }, [activeTab]);

  return (
    <div className="space-y-5">
      {/* Sub-Tab Navigation */}
      <div className="border-b border-slate-200">
        <div className="flex gap-7">
          <button
            onClick={() => setActiveTab('products')}
            className={`relative flex items-center gap-2 px-1 pb-3 pt-1 text-sm font-black transition ${
              activeTab === 'products'
                ? 'text-blue-700'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <HiOutlineCube size={16} />
            Sản phẩm
            {activeTab === 'products' && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-blue-600" />}
          </button>
          <button
            onClick={() => setActiveTab('promotions')}
            className={`relative flex items-center gap-2 px-1 pb-3 pt-1 text-sm font-black transition ${
              activeTab === 'promotions'
                ? 'text-blue-700'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FiGift size={16} />
            Khuyến mãi
            {activeTab === 'promotions' && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-blue-600" />}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'products' && <ProductsPage />}
      {activeTab === 'promotions' && <PromotionsTab categories={categories} />}
    </div>
  );
};

export default ProductsWithTabs;
