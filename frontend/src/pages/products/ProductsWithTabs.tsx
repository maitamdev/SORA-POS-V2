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
    <div className="space-y-6">
      {/* Sub-Tab Navigation */}
      <div className="flex justify-start">
        <div className="inline-flex p-1 bg-slate-200/50 border border-slate-300 rounded-2xl shadow-sm">
          <button
            onClick={() => setActiveTab('products')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${
              activeTab === 'products'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-300/70'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <HiOutlineCube size={15} className="stroke-[2.5]" />
            Sản phẩm
          </button>
          <button
            onClick={() => setActiveTab('promotions')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${
              activeTab === 'promotions'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-300/70'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FiGift size={15} className="stroke-[2.5]" />
            Khuyến mãi
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
