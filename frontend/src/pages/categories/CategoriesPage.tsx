import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { catalogAPI } from '../../services/catalog.api';
import { Category, Product } from '../../types/domain.type';
import {
  HiOutlineFolder,
  HiOutlinePencil,
  HiOutlinePlus,
  HiOutlineRefresh,
  HiOutlineSearch,
  HiOutlineTrash,
} from 'react-icons/hi';

const getCategoryFallbackImage = (name: string): string => {
  const cleanName = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  if (
    cleanName.includes('nuoc') ||
    cleanName.includes('uong') ||
    cleanName.includes('beverage') ||
    cleanName.includes('drink') ||
    cleanName.includes('cafe') ||
    cleanName.includes('tra') ||
    cleanName.includes('bia') ||
    cleanName.includes('ruou')
  ) {
    // Drink/Beverage image
    return 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&q=80&w=400';
  }
  if (
    cleanName.includes('banh') ||
    cleanName.includes('keo') ||
    cleanName.includes('snack') ||
    cleanName.includes('ngot') ||
    cleanName.includes('candy')
  ) {
    // Bakery/sweets/snack image
    return 'https://images.unsplash.com/photo-1534432127792-7edd601532f3?auto=format&fit=crop&q=80&w=400';
  }
  if (
    cleanName.includes('sua') ||
    cleanName.includes('milk') ||
    cleanName.includes('dairy')
  ) {
    // Milk image
    return 'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&q=80&w=400';
  }
  if (
    cleanName.includes('gia dung') ||
    cleanName.includes('home') ||
    cleanName.includes('kitchen') ||
    cleanName.includes('chen') ||
    cleanName.includes('bat') ||
    cleanName.includes('do dung')
  ) {
    // Household items image
    return 'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?auto=format&fit=crop&q=80&w=400';
  }
  if (
    cleanName.includes('my pham') ||
    cleanName.includes('dau goi') ||
    cleanName.includes('sua tam') ||
    cleanName.includes('soap') ||
    cleanName.includes('shampoo') ||
    cleanName.includes('cosmetics')
  ) {
    // Cosmetics/beauty image
    return 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=400';
  }
  if (
    cleanName.includes('gia vi') ||
    cleanName.includes('sauce') ||
    cleanName.includes('condiment') ||
    cleanName.includes('dau an') ||
    cleanName.includes('mam') ||
    cleanName.includes('muoi')
  ) {
    // Spices image
    return 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&q=80&w=400';
  }
  if (
    cleanName.includes('thuoc') ||
    cleanName.includes('thuc pham chuc nang') ||
    cleanName.includes('y te') ||
    cleanName.includes('duoc') ||
    cleanName.includes('medicine') ||
    cleanName.includes('pharmacy') ||
    cleanName.includes('pill')
  ) {
    // Pharmacy/Medicine image
    return 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=400';
  }
  if (
    cleanName.includes('sach') ||
    cleanName.includes('van phong pham') ||
    cleanName.includes('book') ||
    cleanName.includes('stationery') ||
    cleanName.includes('but') ||
    cleanName.includes('vo')
  ) {
    // Books/Stationery image
    return 'https://images.unsplash.com/photo-1568205612837-017257d2310a?auto=format&fit=crop&q=80&w=400';
  }
  if (
    cleanName.includes('do choi') ||
    cleanName.includes('toy') ||
    cleanName.includes('kids') ||
    cleanName.includes('baby')
  ) {
    // Toys image
    return 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&q=80&w=400';
  }
  if (
    cleanName.includes('dien tu') ||
    cleanName.includes('cong nghe') ||
    cleanName.includes('tech') ||
    cleanName.includes('electronics') ||
    cleanName.includes('dien thoai') ||
    cleanName.includes('may tinh') ||
    cleanName.includes('phu kien')
  ) {
    // Electronics/Tech image
    return 'https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&q=80&w=400';
  }
  if (
    cleanName.includes('thoi trang') ||
    cleanName.includes('quan ao') ||
    cleanName.includes('fashion') ||
    cleanName.includes('clothing') ||
    cleanName.includes('giay') ||
    cleanName.includes('dep')
  ) {
    // Fashion/Clothing image
    return 'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&q=80&w=400';
  }
  if (
    cleanName.includes('an') ||
    cleanName.includes('thuc pham') ||
    cleanName.includes('mi') ||
    cleanName.includes('noodles') ||
    cleanName.includes('food') ||
    cleanName.includes('fastfood') ||
    cleanName.includes('salad')
  ) {
    // Food/Salad/Noodles image
    return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400';
  }
  
  // Default supermarket/grocery image
  return 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400';
};

const CategoriesPage = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Category | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [generatingImage, setGeneratingImage] = useState(false);

  const handleGenerateImage = async () => {
    if (!name.trim()) {
      toast.error('Vui lòng nhập tên danh mục trước khi dùng AI');
      return;
    }
    setGeneratingImage(true);
    try {
      const { aiAPI } = await import('../../services/ai.api');
      const res = await aiAPI.suggestCategoryImage(name.trim());
      if (res.data.data.imageUrl) {
        setImageUrl(res.data.data.imageUrl);
        toast.success('Đã tìm thấy ảnh minh họa phù hợp!');
      } else {
        toast.error('AI không tìm thấy ảnh phù hợp. Vui lòng tự nhập.');
      }
    } catch (error) {
      toast.error('Lỗi khi gọi AI gợi ý ảnh');
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleNameBlur = async () => {
    // Only auto-generate if name exists, image URL is empty, and we aren't editing an existing category (or if we are editing, we just cleared the image URL)
    if (!name.trim() || imageUrl.trim()) return;
    
    setGeneratingImage(true);
    try {
      const { aiAPI } = await import('../../services/ai.api');
      const res = await aiAPI.suggestCategoryImage(name.trim());
      if (res.data.data.imageUrl) {
        setImageUrl(res.data.data.imageUrl);
        toast.success('AI đã tự động tìm ảnh minh họa!');
      }
    } catch (error) {
      console.error('Lỗi khi auto-gọi AI gợi ý ảnh:', error);
    } finally {
      setGeneratingImage(false);
    }
  };

  // Products modal states
  const [selectedCategoryForProducts, setSelectedCategoryForProducts] = useState<Category | null>(null);
  const [categoryProducts, setCategoryProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const viewProductsOfCategory = async (category: Category) => {
    setSelectedCategoryForProducts(category);
    setLoadingProducts(true);
    setCategoryProducts([]);
    try {
      const res = await catalogAPI.products.list({ category_id: category.id, limit: 100 });
      setCategoryProducts(res.data.data.items);
    } catch (error) {
      toast.error('Không tải được danh sách sản phẩm');
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await catalogAPI.categories.list({ search, is_active: true });
      setCategories(res.data.data.items);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Không tải được danh mục');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [search]);

  const startEdit = (category: Category) => {
    setEditing(category);
    setName(category.name);
    setDescription(category.description || '');
    setImageUrl(category.image_url || '');
  };

  const resetForm = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setImageUrl('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Vui lòng nhập tên danh mục');
      return;
    }

    setSaving(true);
    const payload = {
      name: name.trim(),
      description: description.trim(),
      image_url: imageUrl.trim() || undefined,
    };

    try {
      if (editing) {
        await catalogAPI.categories.update(editing.id, payload);
        toast.success('Đã cập nhật danh mục thành công');
      } else {
        await catalogAPI.categories.create(payload);
        toast.success('Đã tạo danh mục mới thành công');
      }
      resetForm();
      fetchCategories();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Lưu danh mục thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn xóa danh mục "${name}"? Các sản phẩm thuộc danh mục này sẽ cần được phân loại lại.`
      )
    )
      return;
    try {
      await catalogAPI.categories.remove(id);
      toast.success('Đã xóa danh mục');
      fetchCategories();
      if (editing?.id === id) {
        resetForm();
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Xóa danh mục thất bại');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800">Danh mục</h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500">
            Quản lý nhóm sản phẩm dùng cho lọc hàng hóa và POS.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm kiếm danh mục..."
              className="w-full sm:w-64 rounded-xl border border-slate-200 bg-white pl-9 pr-4 py-2 text-sm font-semibold outline-none focus:border-blue-500 transition"
            />
            <HiOutlineSearch className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          </div>
          <button
            onClick={fetchCategories}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white whitespace-nowrap hover:bg-slate-800 transition"
          >
            <HiOutlineRefresh className="h-4 w-4" />
            Tải lại
          </button>
        </div>
      </header>

      {/* Main Grid Layout */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
        {/* Form Card */}
        <form
          onSubmit={handleSubmit}
          className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-700">
              {editing ? 'Cập nhật danh mục' : 'Tạo danh mục mới'}
            </h2>
            {editing && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-bold text-slate-500 hover:text-slate-900 transition"
              >
                Hủy bỏ
              </button>
            )}
          </div>

          <div className="space-y-4">
            {/* Name Input */}
            <label className="block space-y-1.5">
              <span className="block text-xs font-bold uppercase text-slate-500">
                Tên danh mục <span className="text-red-500">*</span>
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleNameBlur}
                placeholder="Ví dụ: Đồ uống, Fastfood..."
                required
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold outline-none focus:border-blue-500 transition"
              />
            </label>

            {/* Description Input */}
            <label className="block space-y-1.5">
              <span className="block text-xs font-bold uppercase text-slate-500">Mô tả</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Nhập mô tả ngắn gọn cho danh mục này..."
                rows={3}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold outline-none focus:border-blue-500 transition"
              />
            </label>

            {/* Image URL Input */}
            <label className="block space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="block text-xs font-bold uppercase text-slate-500">URL hình ảnh</span>
                <button
                  type="button"
                  onClick={handleGenerateImage}
                  disabled={generatingImage}
                  className="text-xs font-black text-blue-600 hover:text-blue-800 disabled:opacity-50 transition flex items-center gap-1"
                >
                  {generatingImage ? 'Đang tìm...' : '✨ AI Gợi ý ảnh'}
                </button>
              </div>
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold outline-none focus:border-blue-500 transition"
              />
            </label>

            {/* Image Preview Box */}
            <div className="space-y-1.5">
              <span className="block text-xs font-bold uppercase text-slate-500">
                Xem trước hình ảnh
              </span>
              <div className="h-40 w-full rounded-xl border border-dashed border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center">
                {imageUrl.trim() || name.trim() ? (
                  <img
                    src={imageUrl.trim() || getCategoryFallbackImage(name)}
                    alt="Preview"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = getCategoryFallbackImage(name);
                    }}
                  />
                ) : (
                  <div className="text-center text-slate-400 flex flex-col items-center">
                    <HiOutlineFolder className="h-8 w-8 stroke-[1.5]" />
                    <span className="text-xs font-semibold mt-1">Chưa có ảnh minh họa</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-60 transition shadow-sm hover:shadow flex items-center justify-center gap-1.5"
          >
            {!editing && <HiOutlinePlus className="h-4 w-4" />}
            {saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo danh mục'}
          </button>
        </form>

        {/* Categories Grid List */}
        <div>
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400 font-semibold shadow-sm">
              Đang tải danh mục...
            </div>
          ) : categories.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400 font-semibold shadow-sm flex flex-col items-center">
              <HiOutlineFolder className="h-10 w-10 text-slate-300 stroke-[1.5] mb-2" />
              Chưa có danh mục nào được tạo.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {categories.map((category) => (
                <div
                  key={category.id}
                  onClick={() => viewProductsOfCategory(category)}
                  className="group relative bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden hover:shadow-md hover:border-slate-300 transition duration-200 flex flex-col cursor-pointer"
                >
                  {/* Category Thumbnail */}
                  <div className="h-32 w-full bg-slate-100 overflow-hidden relative">
                    <img
                      src={
                        category.image_url || getCategoryFallbackImage(category.name)
                      }
                      alt={category.name}
                      className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = getCategoryFallbackImage(category.name);
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                      <h3 className="font-black text-white text-lg leading-tight truncate mr-2">
                        {category.name}
                      </h3>
                      <span className="text-[10px] font-black uppercase bg-blue-600/95 text-white px-2 py-0.5 rounded-lg shadow-sm border border-blue-500/30 whitespace-nowrap">
                        {category.products?.[0]?.count || 0} sản phẩm
                      </span>
                    </div>
                  </div>

                  {/* Category Details */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <p className="text-slate-500 text-xs sm:text-sm font-semibold line-clamp-3 mb-4 min-h-[40px]">
                      {category.description || 'Chưa có mô tả cho danh mục này.'}
                    </p>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                        Đang hoạt động
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEdit(category);
                          }}
                          className="p-1.5 bg-slate-50 hover:bg-blue-50 text-slate-500 hover:text-blue-600 rounded-lg transition"
                          title="Chỉnh sửa"
                        >
                          <HiOutlinePencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(category.id, category.name);
                          }}
                          className="p-1.5 bg-slate-50 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-lg transition"
                          title="Xóa danh mục"
                        >
                          <HiOutlineTrash className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 5. VIEW PRODUCTS IN CATEGORY MODAL */}
      {selectedCategoryForProducts && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-100 max-h-[85vh] flex flex-col animate-fadeIn">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 flex-shrink-0">
              <div>
                <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">
                  Danh mục: {selectedCategoryForProducts.name}
                </h3>
                <p className="text-xs text-slate-400 font-semibold mt-0.5">
                  Danh sách sản phẩm thuộc danh mục này ({categoryProducts.length} sản phẩm)
                </p>
              </div>
              <button
                onClick={() => setSelectedCategoryForProducts(null)}
                className="text-slate-400 hover:text-slate-700 transition font-black text-lg p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto py-4 min-h-[200px]">
              {loadingProducts ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 font-semibold">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3" />
                  Đang tải danh sách sản phẩm...
                </div>
              ) : categoryProducts.length === 0 ? (
                <div className="text-center py-12 text-slate-400 font-bold uppercase flex flex-col items-center">
                  <HiOutlineFolder className="h-10 w-10 text-slate-300 stroke-[1.5] mb-2" />
                  Không có sản phẩm nào thuộc danh mục này.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        <th className="py-2.5 px-3 text-center w-12">Ảnh</th>
                        <th className="py-2.5 px-3">Mã sản phẩm (SKU)</th>
                        <th className="py-2.5 px-3">Tên sản phẩm</th>
                        <th className="py-2.5 px-3 text-right">Giá bán</th>
                        <th className="py-2.5 px-3 text-center">Tồn kho</th>
                        <th className="py-2.5 px-3 text-center">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                      {categoryProducts.map((p) => {
                        const isOutOfStock = p.stock_quantity <= 0;
                        const isLowStock = p.stock_quantity <= p.min_stock_level;
                        const formattedPrice = `${Number(p.sell_price || 0).toLocaleString('vi-VN')}đ`;
                        const productImage = p.image_url || '/assets/product-placeholder.svg';

                        return (
                          <tr key={p.id} className="hover:bg-slate-50/50 transition">
                            <td className="py-2 px-3 text-center">
                              <div className="w-8 h-8 rounded border border-slate-100 bg-white p-0.5 flex items-center justify-center overflow-hidden mx-auto shadow-sm">
                                <img
                                  src={productImage}
                                  alt={p.name}
                                  className="max-h-full max-w-full object-contain"
                                />
                              </div>
                            </td>
                            <td className="py-2 px-3 uppercase font-extrabold text-slate-500">{p.sku}</td>
                            <td className="py-2 px-3">
                              <div className="font-extrabold text-slate-800 leading-snug">{p.name}</div>
                              <span className="text-[9px] text-slate-400 font-bold block uppercase mt-0.5">Đơn vị: {p.unit || 'Cái'}</span>
                            </td>
                            <td className="py-2 px-3 text-right font-black text-slate-850">{formattedPrice}</td>
                            <td className="py-2 px-3 text-center font-black text-slate-800">{p.stock_quantity}</td>
                            <td className="py-2 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border whitespace-nowrap ${
                                isOutOfStock
                                  ? 'bg-red-50 text-red-600 border-red-200'
                                  : isLowStock
                                  ? 'bg-amber-50 text-amber-600 border-amber-250'
                                  : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                              }`}>
                                {isOutOfStock ? 'Hết hàng' : isLowStock ? 'Tồn thấp' : 'Còn hàng'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-100 pt-4 flex justify-end flex-shrink-0">
              <button
                onClick={() => setSelectedCategoryForProducts(null)}
                className="px-5 py-2 bg-slate-900 text-white font-bold text-xs uppercase rounded-xl hover:bg-slate-800 transition shadow-sm"
              >
                Đóng lại
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default CategoriesPage;
