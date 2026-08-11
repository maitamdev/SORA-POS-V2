import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { catalogAPI } from '../../services/catalog.api';
import { Category, Product } from '../../types/domain.type';
import {
  HiOutlineFolder,
  HiOutlineCube,
  HiOutlineCheck,
  HiOutlineExclamationCircle,
  HiOutlinePencil,
  HiOutlinePlus,
  HiOutlineRefresh,
  HiOutlineSearch,
  HiOutlineTrash,
  HiOutlineX,
} from 'react-icons/hi';
import { useAuthStore } from '../../stores/auth.store';

const CategoriesPage = () => {
  const { user } = useAuthStore();
  const isDemoMode = user?.email === 'demo@sora-pos.com';
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [editing, setEditing] = useState<Category | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');


  // Products modal states
  const [selectedCategoryForProducts, setSelectedCategoryForProducts] = useState<Category | null>(null);
  const [categoryProducts, setCategoryProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Add products to category states
  const [activeModalTab, setActiveModalTab] = useState<'list' | 'add'>('list');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [searchProductsResults, setSearchProductsResults] = useState<Product[]>([]);
  const [searchProductsLoading, setSearchProductsLoading] = useState(false);

  // Search products effect when activeModalTab is 'add'
  useEffect(() => {
    if (activeModalTab !== 'add') return;
    const trimmed = productSearchQuery.trim();
    if (!trimmed) {
      setSearchProductsResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchProductsLoading(true);
      try {
        const res = await catalogAPI.products.list({ search: trimmed, limit: 10 });
        setSearchProductsResults(res.data.data.items);
      } catch (err) {
        console.error('Lỗi tìm sản phẩm:', err);
      } finally {
        setSearchProductsLoading(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [productSearchQuery, activeModalTab]);

  const handleAddProductToCategory = async (productId: string) => {
    if (!selectedCategoryForProducts) return;
    try {
      await catalogAPI.products.update(productId, { category_id: selectedCategoryForProducts.id });
      toast.success('Đã thêm sản phẩm vào danh mục!');
      
      // Update local search results state
      setSearchProductsResults((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, category_id: selectedCategoryForProducts.id } : p))
      );
      
      // Reload products of the category in background
      const res = await catalogAPI.products.list({ category_id: selectedCategoryForProducts.id, limit: 100 });
      setCategoryProducts(res.data.data.items);
      
      // Update count on main page
      setCategories((prev) =>
        prev.map((cat) => {
          if (cat.id === selectedCategoryForProducts.id) {
            const currentCount = cat.products?.[0]?.count || 0;
            return {
              ...cat,
              products: [{ count: currentCount + 1 }],
            };
          }
          return cat;
        })
      );
    } catch (error) {
      toast.error('Không thể thêm sản phẩm vào danh mục');
    }
  };

  const handleRemoveProductFromCategory = async (productId: string) => {
    if (!selectedCategoryForProducts) return;
    if (!window.confirm('Bạn có chắc muốn xóa sản phẩm này khỏi danh mục?')) return;
    try {
      await catalogAPI.products.update(productId, { category_id: null });
      toast.success('Đã xóa sản phẩm khỏi danh mục.');
      
      // Filter out of current category list
      setCategoryProducts((prev) => prev.filter((p) => p.id !== productId));
      
      // Update count on main page
      setCategories((prev) =>
        prev.map((cat) => {
          if (cat.id === selectedCategoryForProducts.id) {
            const currentCount = cat.products?.[0]?.count || 0;
            return {
              ...cat,
              products: [{ count: Math.max(currentCount - 1, 0) }],
            };
          }
          return cat;
        })
      );
    } catch (error) {
      toast.error('Không thể xóa sản phẩm khỏi danh mục');
    }
  };

  const closeModal = () => {
    setSelectedCategoryForProducts(null);
    setActiveModalTab('list');
    setProductSearchQuery('');
    setSearchProductsResults([]);
  };

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

  const openAddProductsToCategory = async (category: Category) => {
    setSelectedCategoryForProducts(category);
    setActiveModalTab('add');
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

  const fetchCategories = async (forceRefresh = false) => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { search, is_active: true };
      if (forceRefresh) params._t = Date.now();
      const res = await catalogAPI.categories.list(params);
      setCategories(res.data.data.items);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Không tải được danh mục');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchCategories();
  }, [debouncedSearch]);

  const startEdit = (category: Category) => {
    setEditing(category);
    setName(category.name);
    setDescription(category.description || '');
    setImageUrl(category.image_url || '');
    setShowFormModal(true);
  };

  const openCreate = () => {
    resetForm();
    setShowFormModal(true);
  };

  const resetForm = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setImageUrl('');
  };

  const closeFormModal = () => {
    setShowFormModal(false);
    resetForm();
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
        if (isDemoMode) {
          setCategories((prev) => prev.map((category) => (
            category.id === editing.id
              ? { ...category, ...payload, description: payload.description || null, image_url: payload.image_url || null }
              : category
          )));
        } else {
          await fetchCategories(true);
        }
      } else {
        const response = await catalogAPI.categories.create(payload);
        toast.success('Đã tạo danh mục mới thành công');
        const created = response.data?.data as Partial<Category> | undefined;
        const newCategory: Category = {
          id: created?.id || `category-${Date.now()}`,
          name: payload.name,
          description: payload.description || null,
          image_url: payload.image_url || null,
          is_active: true,
          products: [{ count: 0 }],
        };
        if (isDemoMode) {
          setCategories((prev) => [newCategory, ...prev.filter((category) => category.id !== newCategory.id)]);
        } else {
          await fetchCategories(true);
        }
      }
      resetForm();
      setShowFormModal(false);
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
      if (isDemoMode) {
        setCategories((prev) => prev.filter((category) => category.id !== id));
      } else {
        await fetchCategories(true);
      }
      if (editing?.id === id) {
        resetForm();
        setShowFormModal(false);
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Xóa danh mục thất bại');
    }
  };

  const totalProducts = categories.reduce(
    (total, category) => total + Number(category.products?.[0]?.count || 0),
    0,
  );
  const emptyCategories = categories.filter(
    (category) => Number(category.products?.[0]?.count || 0) === 0,
  ).length;
  const activeCategories = categories.filter((category) => category.is_active).length;

  return (
    <div className="space-y-5 animate-fadeIn">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Danh mục</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">Quản lý nhóm sản phẩm dùng cho lọc hàng hóa và POS.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
          <label className="relative block min-w-0 flex-1 sm:w-[250px] xl:w-[280px]">
            <span className="sr-only">Tìm kiếm danh mục</span>
            <HiOutlineSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm tên danh mục..."
              aria-label="Tìm tên danh mục"
              className="h-10 w-full border border-slate-200 bg-white pl-10 pr-3 text-sm font-medium outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-10 items-center justify-center gap-2 bg-blue-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 active:translate-y-px"
          >
            <HiOutlinePlus className="h-4 w-4" />
            Tạo danh mục
          </button>
          <button
            type="button"
            onClick={() => fetchCategories()}
            className="inline-flex h-10 items-center justify-center gap-2 border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <HiOutlineRefresh className="h-4 w-4" />
            Tải lại
          </button>
        </div>
      </header>

      <section className="border border-slate-200 bg-white shadow-sm" aria-label="Tổng quan danh mục">
        <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 xl:grid-cols-4 xl:divide-y-0">
          {[
            { label: 'Tổng danh mục', value: categories.length, note: 'Theo kết quả hiện tại', icon: HiOutlineFolder, tone: 'text-slate-950' },
            { label: 'Sản phẩm đã phân loại', value: totalProducts, note: 'Tổng trong các nhóm', icon: HiOutlineCube, tone: 'text-blue-700' },
            { label: 'Danh mục trống', value: emptyCategories, note: emptyCategories ? 'Cần bổ sung sản phẩm' : 'Các nhóm đã có sản phẩm', icon: HiOutlineExclamationCircle, tone: emptyCategories ? 'text-amber-700' : 'text-emerald-700' },
            { label: 'Đang hoạt động', value: activeCategories, note: 'Sẵn sàng dùng tại POS', icon: HiOutlineCheck, tone: 'text-emerald-700' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.label} className="min-h-[116px] p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{item.label}</p>
                  <Icon className="h-4 w-4 text-slate-400" />
                </div>
                <p className={'mt-3 text-2xl font-black tracking-tight ' + item.tone}>{item.value.toLocaleString('vi-VN')}</p>
                <p className="mt-1 text-xs font-medium text-slate-500">{item.note}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="min-w-0 overflow-hidden border border-slate-200 bg-white shadow-sm" aria-label="Danh sách danh mục">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <h2 className="text-base font-black text-slate-950">Danh mục đang quản lý</h2>
              <p className="mt-1 text-xs font-medium text-slate-500">
                {loading ? 'Đang đồng bộ dữ liệu...' : (categories.length + ' danh mục trong kết quả hiện tại')}
                {search.trim() ? (' · Từ khóa “' + search.trim() + '”') : ''}
              </p>
            </div>
          </div>

          <div className="p-4 sm:p-5">
            {loading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3" aria-label="Đang tải danh mục">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="animate-pulse border border-slate-200 bg-white motion-reduce:animate-none">
                    <div className="h-32 bg-slate-100" />
                    <div className="space-y-3 p-4">
                      <div className="h-4 w-2/3 bg-slate-100" />
                      <div className="h-3 w-full bg-slate-100" />
                      <div className="h-3 w-4/5 bg-slate-100" />
                      <div className="h-8 w-full bg-slate-100" />
                    </div>
                  </div>
                ))}
              </div>
            ) : categories.length === 0 ? (
              <div className="flex flex-col items-center justify-center border border-dashed border-slate-200 px-6 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center bg-blue-50 text-blue-500">
                  <HiOutlineFolder className="h-7 w-7 stroke-[1.5]" />
                </div>
                <p className="mt-4 text-sm font-black text-slate-800">{search.trim() ? 'Không tìm thấy danh mục phù hợp' : 'Chưa có danh mục nào được tạo'}</p>
                <p className="mt-1 max-w-sm text-xs font-medium text-slate-500">
                  {search.trim() ? 'Thử đổi từ khóa hoặc xóa bộ lọc để xem các nhóm hàng khác.' : 'Tạo danh mục đầu tiên để sản phẩm được phân loại rõ ràng tại POS.'}
                </p>
                {search.trim() && (
                  <button type="button" onClick={() => setSearch('')} className="mt-5 h-9 border border-slate-200 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50">
                    Xóa bộ lọc
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                {categories.map((category) => {
                  const productCount = Number(category.products?.[0]?.count || 0);
                  return (
                    <article
                      key={category.id}
                      onClick={() => viewProductsOfCategory(category)}
                      className="group flex min-w-0 cursor-pointer flex-col border border-slate-200 bg-white transition hover:border-blue-300 hover:shadow-md"
                    >
                      <div className="relative flex h-32 w-full items-center justify-center overflow-hidden bg-slate-100">
                        {category.image_url ? (
                          <img
                            src={category.image_url}
                            alt={category.name}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <HiOutlineFolder className="h-9 w-9 text-slate-300 stroke-[1.5]" aria-label="Chưa có ảnh" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-slate-900/10 to-transparent" />
                        <span className="absolute bottom-3 left-3 inline-flex items-center border border-white/30 bg-slate-950/70 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white">
                          {productCount.toLocaleString('vi-VN')} sản phẩm
                        </span>
                      </div>

                      <div className="flex flex-1 flex-col p-4">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="min-w-0 truncate text-sm font-black text-slate-900" title={category.name}>{category.name}</h3>
                          <HiOutlineFolder className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                        </div>
                        <p className="mt-2 min-h-[42px] line-clamp-2 text-xs font-medium leading-5 text-slate-500" title={category.description || undefined}>
                          {category.description || 'Chưa có mô tả cho danh mục này.'}
                        </p>

                        <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                          <span className="inline-flex items-center gap-1.5 border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">
                            <span className="h-1.5 w-1.5 bg-emerald-500" />
                            {category.is_active ? 'Đang hoạt động' : 'Đã tắt'}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openAddProductsToCategory(category);
                              }}
                              className="inline-flex h-8 items-center gap-1.5 bg-blue-600 px-2.5 text-[11px] font-black text-white transition hover:bg-blue-700"
                              title="Thêm sản phẩm"
                              aria-label={'Thêm sản phẩm vào ' + category.name}
                            >
                              <HiOutlinePlus className="h-3.5 w-3.5" />
                              <span>Thêm SP</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEdit(category);
                              }}
                              className="inline-flex h-8 w-8 items-center justify-center border border-slate-200 text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                              title="Chỉnh sửa"
                              aria-label={'Chỉnh sửa ' + category.name}
                            >
                              <HiOutlinePencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(category.id, category.name);
                              }}
                              className="inline-flex h-8 w-8 items-center justify-center border border-slate-200 text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                              title="Xóa danh mục"
                              aria-label={'Xóa ' + category.name}
                            >
                              <HiOutlineTrash className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
      </section>

      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="category-form-title">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 id="category-form-title" className="text-lg font-black text-slate-950">
                {editing ? 'Chỉnh sửa danh mục' : 'Tạo danh mục'}
              </h2>
              <button
                type="button"
                onClick={closeFormModal}
                className="inline-flex h-8 w-8 items-center justify-center text-slate-400 transition hover:bg-slate-50 hover:text-slate-800"
                aria-label="Đóng"
              >
                <HiOutlineX className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-5">
              <label className="block space-y-1.5">
                <span className="block text-[11px] font-black uppercase tracking-[0.1em] text-slate-500">
                  Tên danh mục <span className="text-red-500">*</span>
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Đồ uống, Fastfood..."
                  required
                  autoFocus
                  className="h-10 w-full border border-slate-200 px-3 text-sm font-semibold outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="block text-[11px] font-black uppercase tracking-[0.1em] text-slate-500">Mô tả</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Nhập mô tả ngắn gọn cho danh mục này..."
                  rows={3}
                  className="w-full resize-y border border-slate-200 px-3 py-2 text-sm font-semibold leading-5 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="block text-[11px] font-black uppercase tracking-[0.1em] text-slate-500">URL hình ảnh</span>
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => {
                    let val = e.target.value;
                    if (val.includes('google.com/imgres')) {
                      try {
                        const urlObj = new URL(val);
                        const realImgUrl = urlObj.searchParams.get('imgurl');
                        if (realImgUrl) {
                          val = realImgUrl;
                        }
                      } catch (err) {
                        console.error('Lỗi khi phân tích URL Google Images:', err);
                      }
                    }
                    setImageUrl(val);
                  }}
                  placeholder="https://example.com/image.jpg"
                  className="h-10 w-full border border-slate-200 px-3 text-sm font-semibold outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <div className="space-y-1.5">
                <span className="block text-[11px] font-black uppercase tracking-[0.1em] text-slate-500">Xem trước hình ảnh</span>
                <div className="relative flex h-32 w-full items-center justify-center overflow-hidden border border-dashed border-slate-200 bg-slate-50">
                  {imageUrl.trim() ? (
                    <img
                      key={imageUrl}
                      src={imageUrl.trim()}
                      alt="Xem trước ảnh danh mục"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <HiOutlineFolder className="h-8 w-8 text-slate-300 stroke-[1.5]" />
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={closeFormModal} className="h-10 border border-slate-200 px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                  Hủy
                </button>
                <button type="submit" disabled={saving} className="inline-flex h-10 items-center justify-center gap-2 bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                  {!editing && <HiOutlinePlus className="h-4 w-4" />}
                  {saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo danh mục'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                  Quản lý sản phẩm thuộc danh mục này
                </p>
              </div>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-700 transition font-black text-lg p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-100 mt-2 shrink-0">
              <button
                type="button"
                onClick={() => setActiveModalTab('list')}
                className={`py-2.5 px-4 text-xs font-black border-b-2 transition-all ${
                  activeModalTab === 'list'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Sản phẩm trong danh mục ({categoryProducts.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveModalTab('add')}
                className={`py-2.5 px-4 text-xs font-black border-b-2 transition-all ${
                  activeModalTab === 'add'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                ➕ Thêm sản phẩm vào danh mục
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto py-4 min-h-[200px]">
              {activeModalTab === 'list' ? (
                loadingProducts ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400 font-semibold">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3" />
                    Đang tải danh sách sản phẩm...
                  </div>
                ) : categoryProducts.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 font-bold uppercase flex flex-col items-center gap-3">
                    <HiOutlineFolder className="h-10 w-10 text-slate-300 stroke-[1.5]" />
                    <span>Không có sản phẩm nào thuộc danh mục này.</span>
                    <button
                      type="button"
                      onClick={() => setActiveModalTab('add')}
                      className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-sm"
                    >
                      Thêm sản phẩm ngay
                    </button>
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
                          <th className="py-2.5 px-3 text-center">Bỏ khỏi DM</th>
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
                              <td className="py-2 px-3 text-right font-black text-slate-900">{formattedPrice}</td>
                              <td className="py-2 px-3 text-center font-black text-slate-800">{p.stock_quantity}</td>
                              <td className="py-2 px-3 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border whitespace-nowrap ${
                                  isOutOfStock
                                    ? 'bg-red-50 text-red-600 border-red-200'
                                    : isLowStock
                                    ? 'bg-amber-50 text-amber-600 border-amber-200'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}>
                                  {isOutOfStock ? 'Hết hàng' : isLowStock ? 'Tồn thấp' : 'Còn hàng'}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveProductFromCategory(p.id)}
                                  className="p-1 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded transition"
                                  title="Xóa khỏi danh mục"
                                >
                                  <HiOutlineTrash className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                <div className="space-y-4">
                  {/* Search input for adding product */}
                  <div className="relative">
                    <input
                      type="text"
                      value={productSearchQuery}
                      onChange={(e) => setProductSearchQuery(e.target.value)}
                      placeholder="Tìm sản phẩm bằng tên, SKU, barcode..."
                      className="w-full h-10 rounded-xl border border-slate-200 pl-10 pr-4 text-xs sm:text-sm font-semibold outline-none focus:border-blue-500 bg-slate-50/50"
                    />
                    <HiOutlineSearch className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  </div>

                  {searchProductsLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 font-semibold">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mb-2" />
                      Đang tìm kiếm sản phẩm...
                    </div>
                  ) : productSearchQuery.trim() && searchProductsResults.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 font-bold uppercase">
                      Không tìm thấy sản phẩm nào.
                    </div>
                  ) : !productSearchQuery.trim() ? (
                    <div className="text-center py-12 text-slate-400 font-semibold text-xs sm:text-sm">
                      Nhập từ khóa tìm kiếm để bắt đầu thêm sản phẩm vào danh mục.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            <th className="py-2.5 px-3">Mã sản phẩm (SKU)</th>
                            <th className="py-2.5 px-3">Tên sản phẩm</th>
                            <th className="py-2.5 px-3">Danh mục hiện tại</th>
                            <th className="py-2.5 px-3 text-right">Giá bán</th>
                            <th className="py-2.5 px-3 text-center">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                          {searchProductsResults.map((p) => {
                            const isInCurrentCategory = p.category_id === selectedCategoryForProducts.id;
                            return (
                              <tr key={p.id} className="hover:bg-slate-50/50 transition">
                                <td className="py-2 px-3 uppercase font-extrabold text-slate-500">{p.sku}</td>
                                <td className="py-2 px-3">
                                  <div className="font-extrabold text-slate-800 leading-snug">{p.name}</div>
                                </td>
                                <td className="py-2 px-3 text-slate-500">
                                  {isInCurrentCategory ? (
                                    <span className="text-blue-600 font-bold">Danh mục này</span>
                                  ) : (
                                    p.categories?.name || 'Không có'
                                  )}
                                </td>
                                <td className="py-2 px-3 text-right font-black text-slate-900">
                                  {Number(p.sell_price || 0).toLocaleString('vi-VN')}đ
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleAddProductToCategory(p.id)}
                                    disabled={isInCurrentCategory}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                                      isInCurrentCategory
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                        : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                                    }`}
                                  >
                                    {isInCurrentCategory ? 'Đã thêm' : 'Thêm vào'}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-100 pt-4 flex justify-end flex-shrink-0">
              <button
                type="button"
                onClick={closeModal}
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
