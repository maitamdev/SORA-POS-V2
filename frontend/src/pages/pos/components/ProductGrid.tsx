import { memo } from 'react';
import {
  HiOutlineShoppingCart,
  HiOutlinePlus,
  HiOutlineMenu,
} from 'react-icons/hi';
import { usePOSStore, usePOSSortedProducts } from '../../../stores/pos.store';
import { money, getProductImage } from '../utils/posHelpers';
import { Product } from '../../../types/domain.type';

interface ProductItemProps {
  product: Product;
  operationSettings: any;
  onAddToCart: (product: Product) => void;
}

const ProductGridCard = memo(({ product, operationSettings, onAddToCart }: ProductItemProps) => {
  const isLowStock = product.stock_quantity <= product.min_stock_level;
  const isOutOfStock = product.stock_quantity <= 0;

  return (
    <div className="bg-white border border-slate-200/60 rounded-lg p-2.5 flex flex-col justify-between hover:shadow-md hover:border-blue-400 transition relative overflow-hidden group">
      <span className={`absolute top-2.5 right-2.5 z-10 px-2 py-0.5 text-[9px] font-black rounded-full border shadow-sm ${
        isOutOfStock
          ? 'bg-red-100 text-red-700 border-red-200'
          : isLowStock
          ? 'bg-amber-50 text-amber-700 border-amber-200'
          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
      }`}>
        Tồn: {product.stock_quantity} {isLowStock && !isOutOfStock && '(Thấp)'} {isOutOfStock && 'Hết'}
      </span>

      <div className="h-40 flex items-center justify-center mb-2 bg-slate-50/50 rounded-lg p-1.5 overflow-hidden flex-shrink-0">
        <img
          src={getProductImage(product)}
          alt={product.name}
          className="h-full w-full scale-[1.2] object-contain group-hover:scale-[1.28] transition duration-300"
          loading="lazy"
        />
      </div>

      <div className="flex-1 flex flex-col">
        <h3 className="text-[13px] font-black text-slate-800 line-clamp-2 mt-1 min-h-[34px]">
          {product.name}
        </h3>
        <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5 tracking-wider">
          {product.sku}
        </p>
      </div>

      <div className="mt-3">
        <span className="text-base font-black text-blue-600 block">{money(product.sell_price)}</span>
        <button
          onClick={() => onAddToCart(product)}
          disabled={!product.is_active || (!operationSettings.allowSellOutOfStock && isOutOfStock)}
          className="w-full mt-2.5 flex h-8 items-center justify-center gap-1 border border-blue-600 text-blue-600 text-[11px] font-black rounded-lg hover:bg-blue-600 hover:text-white transition disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-blue-600"
        >
          <HiOutlinePlus className="w-3.5 h-3.5" />
          <span>Thêm</span>
        </button>
      </div>
    </div>
  );
});

const ProductRowItem = memo(({ product, operationSettings, onAddToCart }: ProductItemProps) => {
  const isLowStock = product.stock_quantity <= product.min_stock_level;
  const isOutOfStock = product.stock_quantity <= 0;

  return (
    <div className="p-3 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition">
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
          onClick={() => onAddToCart(product)}
          disabled={!product.is_active || (!operationSettings.allowSellOutOfStock && isOutOfStock)}
          className="p-1 px-3 border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
        >
          + Thêm
        </button>
      </div>
    </div>
  );
});

const ProductGrid = () => {
  const categories = usePOSStore((s) => s.categories);
  const selectedCategoryId = usePOSStore((s) => s.selectedCategoryId);
  const sortBy = usePOSStore((s) => s.sortBy);
  const viewMode = usePOSStore((s) => s.viewMode);
  const page = usePOSStore((s) => s.page);
  const pagination = usePOSStore((s) => s.pagination);
  const products = usePOSStore((s) => s.products);
  const operationSettings = usePOSStore((s) => s.operationSettings);

  const setSelectedCategoryId = usePOSStore((s) => s.setSelectedCategoryId);
  const setSortBy = usePOSStore((s) => s.setSortBy);
  const setViewMode = usePOSStore((s) => s.setViewMode);
  const setPage = usePOSStore((s) => s.setPage);
  const addToCart = usePOSStore((s) => s.addToCart);

  const sortedProducts = usePOSSortedProducts();

  const itemsStart = (pagination.page - 1) * pagination.limit + 1;
  const itemsEnd = Math.min(pagination.page * pagination.limit, pagination.total);

  const handleAddToCart = (product: Product) => {
    import('react-hot-toast').then(({ default: toast }) => {
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
      addToCart(product);
    });
  };

  return (
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

      {/* Subfilters Row */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3 rounded-xl border border-slate-200/60 shadow-sm">
        <p className="w-full sm:w-auto text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Danh sách sản phẩm
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

      {/* Product Grid / List */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-1">
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 bg-white rounded-2xl border border-dashed border-slate-350 p-10 text-center text-slate-400">
            <HiOutlineShoppingCart className="w-12 h-12 text-slate-300 mb-2" />
            <p className="font-extrabold text-slate-500">Chưa có sản phẩm nào được hiển thị</p>
            <p className="text-xs text-slate-400 mt-1">Vui lòng điều chỉnh lại bộ lọc tìm kiếm sản phẩm.</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            {sortedProducts.map((product) => (
              <ProductGridCard
                key={product.id}
                product={product}
                operationSettings={operationSettings}
                onAddToCart={handleAddToCart}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2 bg-white rounded-xl border border-slate-200/60 overflow-hidden divide-y divide-slate-100 shadow-sm">
            {sortedProducts.map((product) => (
              <ProductRowItem
                key={product.id}
                product={product}
                operationSettings={operationSettings}
                onAddToCart={handleAddToCart}
              />
            ))}
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
            onClick={() => setPage((p: number) => Math.max(1, p - 1))}
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
            onClick={() => setPage((p: number) => Math.min(Math.ceil(pagination.total / pagination.limit), p + 1))}
            disabled={page >= Math.ceil(pagination.total / pagination.limit)}
            className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition"
          >
            ›
          </button>
        </div>
      </footer>
    </section>
  );
};

export default ProductGrid;
