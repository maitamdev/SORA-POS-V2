import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  HiOutlineCube,
  HiOutlineSearch,
  HiOutlinePlus,
  HiOutlineUpload,
  HiOutlineDownload,
  HiOutlineFilter,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineEye,
  HiOutlineCog,
  HiOutlineFolder,
  HiOutlineExclamationCircle,
} from 'react-icons/hi';
import { catalogAPI } from '../../services/catalog.api';
import { aiAPI } from '../../services/ai.api';
import { defaultOperationSettings, OperationSettings, settingsAPI } from '../../services/settings.api';
import { useAuthStore } from '../../stores/auth.store';
import { Category, Product, Supplier } from '../../types/domain.type';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';

const money = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const generateSku = (name: string, barcode: string): string => {
  const cleanBarcode = barcode.replace(/\D/g, '');
  const cleanName = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .toUpperCase()
    .split(/[\s-]+/)
    .filter(Boolean);
  
  const tokens = cleanName.filter(t => t.length > 1 || !isNaN(Number(t))).slice(0, 3);
  const prefix = tokens.join('-');
  const suffix = cleanBarcode.slice(-4) || Math.floor(1000 + Math.random() * 9000).toString();
  
  return prefix ? `${prefix}-${suffix}` : `SP-${suffix}`;
};

const getProductImage = (product: Product) => {
  return product.image_url || '/assets/product-placeholder.svg';
};

const ProductsPage = () => {
  const { user } = useAuthStore();
  const { scannedBarcode } = useBarcodeScanner();
  const [searchParams] = useSearchParams();
  const categoryParam = searchParams.get('categoryId') || 'all';

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    lowStock: 0,
    outStock: 0,
  });

  // Filtering states
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState(categoryParam);
  const [stockStatus, setStockStatus] = useState('all'); // all, in_stock, low_stock, out_of_stock
  const [sortBy, setSortBy] = useState('newest');

  // Pagination states
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalItems, setTotalItems] = useState(0);

  // Add/Edit Product Modal State
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentId, setCurrentId] = useState('');
  
  // Form fields
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [costPrice, setCostPrice] = useState(0);
  const [sellPrice, setSellPrice] = useState(0);
  const [stockQuantity, setStockQuantity] = useState(0);
  const [minStockLevel, setMinStockLevel] = useState(10);
  const [unit, setUnit] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  
  // AI State
  const [generatingAI, setGeneratingAI] = useState(false);
  const [productLookupLoading, setProductLookupLoading] = useState(false);
  const lastLookupBarcodeRef = useRef('');

  // Advanced Filter Popup
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterActiveStatus, setFilterActiveStatus] = useState<boolean | 'all'>(true);

  const [operationSettings, setOperationSettings] = useState<OperationSettings>(defaultOperationSettings);

  // Table Settings
  const [showTableSettings, setShowTableSettings] = useState(false);
  const [tableDensity, setTableDensity] = useState<'compact' | 'normal' | 'comfortable'>('normal');
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    image: true,
    sku: true,
    name: true,
    category: true,
    sell_price: true,
    cost_price: true,
    stock: true,
    min_stock: true,
    status: true,
  });
  const settingsRef = useRef<HTMLDivElement>(null);

  // Close settings panel on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowTableSettings(false);
      }
    };
    if (showTableSettings) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTableSettings]);

  const toggleColumn = (key: string) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const densityPadding = tableDensity === 'compact' ? 'py-1.5' : tableDensity === 'comfortable' ? 'py-4' : 'py-3';
  const densityPaddingTh = tableDensity === 'compact' ? 'py-2' : tableDensity === 'comfortable' ? 'py-4' : 'py-3.5';
  const canManageProducts = user?.role === 'admin' || user?.role === 'manager';
  const visibleColCount = Object.values(visibleColumns).filter(Boolean).length + (canManageProducts ? 2 : 0); // +2 for checkbox & actions

  const loadProducts = async () => {
    const params: Record<string, unknown> = {
      search,
      page,
      limit,
    };
    if (selectedCategoryId !== 'all') params.category_id = selectedCategoryId;
    if (filterActiveStatus !== 'all') params.is_active = filterActiveStatus ? 'true' : 'false';

    // Tham số tìm tất cả sản phẩm thỏa mãn bộ lọc để tính thống kê (bỏ phân trang)
    const statsParams: Record<string, unknown> = {
      search,
      limit: 10000,
    };
    if (selectedCategoryId !== 'all') statsParams.category_id = selectedCategoryId;
    if (filterActiveStatus !== 'all') statsParams.is_active = filterActiveStatus ? 'true' : 'false';

    try {
      const [productRes, allProductRes] = await Promise.all([
        catalogAPI.products.list(params),
        catalogAPI.products.list(statsParams),
      ]);

      setProducts(productRes.data.data.items);
      setTotalItems(productRes.data.data.pagination.total);

      // Tính toán thống kê trên toàn bộ sản phẩm thỏa mãn bộ lọc
      const allProducts = allProductRes.data.data.items;
      let active = 0;
      let lowStock = 0;
      let outStock = 0;

      allProducts.forEach(p => {
        if (p.is_active) active++;
        if (p.stock_quantity <= 0) outStock++;
        else if (p.stock_quantity <= p.min_stock_level) lowStock++;
      });

      setStats({
        total: allProductRes.data.data.pagination.total,
        active,
        lowStock,
        outStock,
      });
    } catch (err) {
      toast.error('Lỗi khi tải dữ liệu sản phẩm');
    }
  };

  const loadStaticData = async () => {
    try {
      const [categoryRes, supplierRes] = await Promise.all([
        catalogAPI.categories.list({ limit: 100, is_active: true }),
        catalogAPI.suppliers.list({ limit: 100, is_active: true }),
      ]);
      setCategories(categoryRes.data.data.items);
      setSuppliers(supplierRes.data.data.items);
    } catch (err) {
      console.warn('Lỗi khi tải danh mục và NCC', err);
    }
  };

  useEffect(() => {
    loadStaticData();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    loadProducts();
  }, [page, limit, selectedCategoryId, debouncedSearch, filterActiveStatus]);

  // Handle scanned barcode
  useEffect(() => {
    if (scannedBarcode) {
      if (showModal) {
        setBarcode(scannedBarcode);
      } else {
        setSearch(scannedBarcode);
      }
    }
  }, [scannedBarcode, showModal]);

  // Sync selectedCategoryId with URL parameters if categoryParam changes
  useEffect(() => {
    if (categoryParam !== selectedCategoryId) {
      setSelectedCategoryId(categoryParam);
      setPage(1);
    }
  }, [categoryParam]);

  useEffect(() => {
    settingsAPI
      .getOperation()
      .then((response) => {
        const nextSettings = { ...defaultOperationSettings, ...response.data.data.settings };
        setOperationSettings(nextSettings);
        setMinStockLevel(nextSettings.defaultMinStockLevel);
      })
      .catch(() => setOperationSettings(defaultOperationSettings));
  }, []);

  // SVG Donut chart calculations
  const donutChart = useMemo(() => {
    const totalVal = stats.total || 1;
    const activePct = (stats.active / totalVal) * 100;
    const lowStockPct = (stats.lowStock / totalVal) * 100;
    const outStockPct = (stats.outStock / totalVal) * 100;

    // Circumference of SVG circle with r=36 is 2*PI*36 = 226.2
    const c = 226.2;
    
    const activeStroke = (activePct / 100) * c;
    const lowStockStroke = (lowStockPct / 100) * c;
    const outStockStroke = (outStockPct / 100) * c;

    return {
      activePct: activePct.toFixed(1),
      lowStockPct: lowStockPct.toFixed(1),
      outStockPct: outStockPct.toFixed(1),
      c,
      activeOffset: 0,
      lowStockOffset: c - activeStroke,
      outStockOffset: c - activeStroke - lowStockStroke,
    };
  }, [stats]);

  // Filtered & Sorted products list for display
  const displayedProducts = useMemo(() => {
    let items = [...products];

    // Apply stock level status filter locally
    if (stockStatus === 'in_stock') {
      items = items.filter(p => p.stock_quantity > p.min_stock_level);
    } else if (stockStatus === 'low_stock') {
      items = items.filter(p => p.stock_quantity > 0 && p.stock_quantity <= p.min_stock_level);
    } else if (stockStatus === 'out_of_stock') {
      items = items.filter(p => p.stock_quantity <= 0);
    }

    // Apply sorting
    if (sortBy === 'price-asc') {
      items.sort((a, b) => Number(a.sell_price) - Number(b.sell_price));
    } else if (sortBy === 'price-desc') {
      items.sort((a, b) => Number(b.sell_price) - Number(a.sell_price));
    } else if (sortBy === 'stock-asc') {
      items.sort((a, b) => a.stock_quantity - b.stock_quantity);
    } else if (sortBy === 'stock-desc') {
      items.sort((a, b) => b.stock_quantity - a.stock_quantity);
    } else if (sortBy === 'newest') {
      // Default / newest
    }

    return items;
  }, [products, stockStatus, sortBy]);

  // Category counts breakdown for sidebar
  const categoryCounts = useMemo(() => {
    const countsMap: Record<string, number> = {};
    products.forEach(p => {
      const catName = p.categories?.name || 'Chưa phân loại';
      countsMap[catName] = (countsMap[catName] || 0) + 1;
    });

    return Object.entries(countsMap).map(([name, count]) => {
      // rough multiplier to fit overall stats
      const scale = totalItems > products.length ? (totalItems / products.length) : 1;
      return {
        name,
        count: Math.round(count * scale)
      };
    });
  }, [products, totalItems]);

  // Modal form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageProducts) {
      toast.error('Tài khoản nhân viên không có quyền thêm hoặc sửa sản phẩm');
      return;
    }
    if (!sku.trim() || !name.trim() || sellPrice <= 0) {
      toast.error('Vui lòng điền đầy đủ Mã SKU, Tên sản phẩm và Giá bán');
      return;
    }

    const resolvedCategoryId: string | null = categoryId || null;

    const payload = {
      sku: sku.trim(),
      barcode: barcode.trim() || null,
      name: name.trim(),
      category_id: resolvedCategoryId,
      supplier_id: null,
      cost_price: Number(costPrice),
      sell_price: Number(sellPrice),
      stock_quantity: Number(stockQuantity),
      min_stock_level: Number(minStockLevel),
      unit: unit.trim() || undefined,
      image_url: imageUrl.trim() || null,
      description: description.trim() || null,
      is_active: isActive,
    };

    try {
      if (isEditMode) {
        await catalogAPI.products.update(currentId, payload);
        toast.success(`Đã cập nhật sản phẩm ${name}`);
      } else {
        await catalogAPI.products.create(payload);
        toast.success(`Đã thêm sản phẩm ${name} thành công`);
      }
      setShowModal(false);
      await loadProducts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi lưu sản phẩm');
    }
  };

  const handleEditClick = (product: Product) => {
    if (!canManageProducts) {
      toast.error('Tài khoản nhân viên không có quyền sửa sản phẩm');
      return;
    }
    setIsEditMode(true);
    setCurrentId(product.id);
    setSku(product.sku);
    setBarcode(product.barcode || '');
    setName(product.name);
    setCategoryId(product.category_id || '');
    setCategoryName(product.categories?.name || '');
    setCostPrice(Number(product.cost_price));
    setSellPrice(Number(product.sell_price));
    setStockQuantity(Number(product.stock_quantity));
    setMinStockLevel(Number(product.min_stock_level));
    setUnit(product.unit || '');
    setImageUrl(product.image_url || '');
    setDescription(product.description || '');
    setIsActive(product.is_active);
    lastLookupBarcodeRef.current = product.barcode || '';
    setShowModal(true);
  };

  const applySuggestedCategory = (categoryNameFromAI?: string | null) => {
    if (!categoryNameFromAI) return;

    const normalizedSuggestion = normalizeText(categoryNameFromAI);
    const matchedCategory = categories.find((category) => {
      const normalizedCategory = normalizeText(category.name);
      return normalizedCategory.includes(normalizedSuggestion) || normalizedSuggestion.includes(normalizedCategory);
    });

    if (matchedCategory) {
      setCategoryId(matchedCategory.id);
      setCategoryName(matchedCategory.name);
    } else if (!categoryName) {
      setCategoryName(categoryNameFromAI);
    }
  };

  const handleBarcodeProductLookup = async (silent = false) => {
    const cleanBarcode = barcode.replace(/\D/g, '');
    if (cleanBarcode.length < 6) {
      if (!silent) toast.error('Vui lòng nhập hoặc quét mã vạch hợp lệ');
      return;
    }

    setProductLookupLoading(true);
    try {
      const response = await aiAPI.identifyProductByBarcode(cleanBarcode);
      const suggestion = response.data.data;

      if (suggestion.exists && suggestion.raw) {
        toast.error(`Sản phẩm đã tồn tại: ${suggestion.name}`, { id: 'duplicate-barcode-toast' });
        if (window.confirm(`Sản phẩm "${suggestion.name}" đã tồn tại trong hệ thống.\n\nBạn có muốn chuyển sang chế độ CHỈNH SỬA sản phẩm này không?`)) {
          handleEditClick(suggestion.raw);
        }
        return;
      }

      setBarcode(suggestion.barcode);
      if (!sku.trim() || sku.trim() === barcode.trim()) setSku(suggestion.sku);
      setName(suggestion.name);
      setUnit((current) => current || suggestion.unit || 'Cái');
      setImageUrl((current) => current || suggestion.image_url || '');
      setDescription((current) => current || suggestion.description || '');
      applySuggestedCategory(suggestion.category_name);
      lastLookupBarcodeRef.current = cleanBarcode;

      toast.success(`AI đã nhận diện (${suggestion.source}): ${suggestion.name}`);
    } catch (error: any) {
      if (!silent) {
        toast.error(error.response?.data?.message || 'Không nhận diện được sản phẩm từ mã vạch này');
      }
    } finally {
      setProductLookupLoading(false);
    }
  };

  useEffect(() => {
    if (!showModal || isEditMode) return;

    const cleanBarcode = barcode.replace(/\D/g, '');
    if (cleanBarcode.length < 8 || cleanBarcode === lastLookupBarcodeRef.current) return;

    const timer = window.setTimeout(() => {
      handleBarcodeProductLookup(true);
    }, 600);

    return () => window.clearTimeout(timer);
  }, [barcode, showModal, isEditMode]);

  // Auto-generate SKU when name or barcode changes (if SKU is empty or is equal to the barcode)
  useEffect(() => {
    if (isEditMode || !showModal) return;
    const cleanBarcode = barcode.trim();
    const cleanSku = sku.trim();

    if (!cleanSku || cleanSku === cleanBarcode) {
      if (name.trim()) {
        setSku(generateSku(name, barcode));
      }
    }
  }, [name, barcode, isEditMode, showModal]);

  const handleAIGenerateDescription = async () => {
    if (!name.trim()) {
      toast.error('Vui lòng điền Tên sản phẩm trước khi sinh mô tả bằng AI');
      return;
    }
    setGeneratingAI(true);
    try {
      const res = await aiAPI.generateDescription(name.trim());
      setDescription(res.data.data.description);
      toast.success('Đã sinh mô tả sản phẩm bằng AI!');
    } catch (err) {
      toast.error('Không thể sinh mô tả sản phẩm bằng AI');
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleAIAutoCategorize = async () => {
    if (!name.trim() || categories.length === 0) return;
    try {
      const res = await aiAPI.suggestCategory(name.trim(), categories.map(c => ({ id: c.id, name: c.name })));
      const suggestedId = res.data.data.categoryId;
      if (suggestedId) {
        setCategoryId(suggestedId);
        const catName = categories.find(c => c.id === suggestedId)?.name;
        if (catName) {
          setCategoryName(catName);
          toast.success(`AI đã tự động phân loại danh mục: ${catName}`);
        }
      }
    } catch (err) {
      console.error('Failed to auto categorize', err);
    }
  };

  const suggestedSellPriceInfo = useMemo(() => {
    if (costPrice <= 0) return null;
    
    const catName = categoryName.toLowerCase();
    
    let margin = 0.25; // default 25% profit margin
    if (catName.includes('nước') || catName.includes('giải khát') || catName.includes('đồ uống')) {
      margin = 0.35; // 35% margin for beverages
    } else if (catName.includes('mì') || catName.includes('ăn liền') || catName.includes('thực phẩm')) {
      margin = 0.15; // 15% margin for noodles
    } else if (catName.includes('bánh') || catName.includes('kẹo') || catName.includes('snack')) {
      margin = 0.30; // 30% margin for snacks
    } else if (catName.includes('sữa')) {
      margin = 0.18; // 18% margin for milk
    } else if (catName.includes('gia dụng') || catName.includes('đồ dùng')) {
      margin = 0.40; // 40% margin for household
    }
    
    const suggested = Math.round((costPrice / (1 - margin)) / 500) * 500;
    const actualMargin = ((suggested - costPrice) / suggested) * 100;
    
    return {
      price: suggested,
      margin: Math.round(actualMargin),
      marginPercentStr: `${Math.round(actualMargin)}%`
    };
  }, [costPrice, categoryName]);

  const handleCreateClick = () => {
    if (!canManageProducts) {
      toast.error('Tài khoản nhân viên không có quyền thêm sản phẩm');
      return;
    }
    setIsEditMode(false);
    setCurrentId('');
    setSku('');
    setBarcode('');
    setName('');
    setCategoryId('');
    setCategoryName('');
    setCostPrice(0);
    setSellPrice(0);
    setStockQuantity(0);
    setMinStockLevel(operationSettings.defaultMinStockLevel);
    setUnit('');
    setImageUrl('');
    setDescription('');
    setIsActive(true);
    lastLookupBarcodeRef.current = '';
    setShowModal(true);
  };

  const handleDeleteClick = async (product: Product) => {
    if (!canManageProducts) {
      toast.error('Tài khoản nhân viên không có quyền xóa sản phẩm');
      return;
    }
    if (window.confirm(`Bạn có chắc chắn muốn xóa sản phẩm "${product.name}"?`)) {
      try {
        await catalogAPI.products.remove(product.id);
        toast.success(`Đã xóa sản phẩm ${product.name}`);
        await loadProducts();
      } catch (err) {
        toast.error('Lỗi khi xóa sản phẩm');
      }
    }
  };

  // CSV Export feature
  const handleExportCSV = () => {
    if (products.length === 0) {
      toast.error('Không có sản phẩm nào để xuất!');
      return;
    }

    const headers = ['Mã sản phẩm (SKU)', 'Mã vạch', 'Tên sản phẩm', 'Danh mục', 'Giá bán', 'Giá nhập', 'Tồn kho', 'Cảnh báo', 'Đơn vị', 'Trạng thái'];
    const rows = products.map(p => [
      p.sku,
      p.barcode || '',
      p.name,
      p.categories?.name || '',
      p.sell_price,
      p.cost_price,
      p.stock_quantity,
      p.min_stock_level,
      p.unit,
      p.is_active ? 'Đang bán' : 'Ngừng bán'
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `SORA_POS_Products_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Đã xuất dữ liệu Excel/CSV thành công!');
  };

  // CSV Import (Excel)
  const handleImportExcelClick = () => {
    if (!canManageProducts) {
      toast.error('Tài khoản nhân viên không có quyền nhập sản phẩm');
      return;
    }
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.csv, .txt';
    fileInput.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (evt: any) => {
        const text = evt.target.result;
        toast.success(`Đã đọc thành công file: ${file.name}. Đang xử lý...`);

        try {
          const lines = text.split(/\r?\n/).filter((l: string) => l.trim() !== '');
          if (lines.length < 2) {
            toast.error('File không chứa đủ dữ liệu (thiếu dòng tiêu đề hoặc nội dung).');
            return;
          }

          // Detect separator
          const detectSeparator = (headerLine: string): string => {
            const separators = [',', ';', '\t'];
            let maxCount = 0;
            let detected = ',';
            for (const sep of separators) {
              const count = (headerLine.match(new RegExp(sep, 'g')) || []).length;
              if (count > maxCount) {
                maxCount = count;
                detected = sep;
              }
            }
            return detected;
          };

          const separator = detectSeparator(lines[0]);

          // Parse CSV line handling quotes
          const parseCSVLine = (line: string, sep: string): string[] => {
            const result: string[] = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              if (char === '"') {
                inQuotes = !inQuotes;
              } else if (char === sep && !inQuotes) {
                result.push(current.trim());
                current = '';
              } else {
                current += char;
              }
            }
            result.push(current.trim());
            return result.map(val => val.replace(/^"|"$/g, '').replace(/""/g, '"'));
          };

          const headers = parseCSVLine(lines[0], separator).map((h: string) => h.toLowerCase().trim());

          const headerMapping: Record<string, string> = {
            'mã sản phẩm (sku)': 'sku',
            'mã sản phẩm': 'sku',
            'sku': 'sku',
            'mã sp': 'sku',
            'ma san pham': 'sku',
            'mã vạch': 'barcode',
            'barcode': 'barcode',
            'mã code': 'barcode',
            'ma vach': 'barcode',
            'tên sản phẩm': 'name',
            'tên sp': 'name',
            'tên': 'name',
            'name': 'name',
            'ten san pham': 'name',
            'danh mục': 'category_name',
            'danh muc': 'category_name',
            'loại': 'category_name',
            'nhóm hàng': 'category_name',
            'category': 'category_name',
            'thương hiệu': 'supplier_name',
            'nhà cung cấp': 'supplier_name',
            'brand': 'supplier_name',
            'ncc': 'supplier_name',
            'thuong hieu': 'supplier_name',
            'giá bán': 'sell_price',
            'giá lẻ': 'sell_price',
            'gia ban': 'sell_price',
            'sell price': 'sell_price',
            'price': 'sell_price',
            'giá nhập': 'cost_price',
            'giá vốn': 'cost_price',
            'gia nhap': 'cost_price',
            'cost price': 'cost_price',
            'cost': 'cost_price',
            'tồn kho': 'stock_quantity',
            'số lượng': 'stock_quantity',
            'tồn': 'stock_quantity',
            'stock': 'stock_quantity',
            'quantity': 'stock_quantity',
            'so luong': 'stock_quantity',
            'cảnh báo': 'min_stock_level',
            'định mức': 'min_stock_level',
            'tồn tối thiểu': 'min_stock_level',
            'cảnh báo tồn': 'min_stock_level',
            'min stock': 'min_stock_level',
            'canh bao': 'min_stock_level',
            'đơn vị': 'unit',
            'đơn vị tính': 'unit',
            'dvt': 'unit',
            'unit': 'unit',
            'don vi': 'unit',
            'trạng thái': 'is_active',
            'trạng thái bán': 'is_active',
            'status': 'is_active',
            'active': 'is_active',
            'trang thai': 'is_active',
            'mô tả': 'description',
            'description': 'description',
            'mo ta': 'description'
          };

          const fieldIndices: Record<string, number> = {};
          headers.forEach((header, index) => {
            const mappedField = headerMapping[header];
            if (mappedField) {
              fieldIndices[mappedField] = index;
            }
          });

          if (fieldIndices['name'] === undefined) {
            toast.error('Không tìm thấy cột "Tên sản phẩm" trong file.');
            return;
          }

          const cleanNumber = (val: string): number => {
            if (!val) return 0;
            let cleaned = val.replace(/[^\d.,-]/g, '');
            if (cleaned.includes('.') && !cleaned.includes(',')) {
              const parts = cleaned.split('.');
              if (parts.length > 1 && parts[parts.length - 1].length === 3) {
                cleaned = cleaned.replace(/\./g, '');
              }
            } else if (cleaned.includes(',') && !cleaned.includes('.')) {
              const parts = cleaned.split(',');
              if (parts.length > 1 && parts[parts.length - 1].length === 3) {
                cleaned = cleaned.replace(/,/g, '');
              }
            }
            return parseFloat(cleaned) || 0;
          };

          const parsedProducts: any[] = [];
          for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i], separator);
            if (values.length === 0 || (values.length === 1 && values[0] === '')) continue;

            const getVal = (field: string): string => {
              const idx = fieldIndices[field];
              return idx !== undefined && idx < values.length ? values[idx].trim() : '';
            };

            const nameVal = getVal('name');
            if (!nameVal) continue;

            let skuVal = getVal('sku');
            if (!skuVal) {
              skuVal = `SP${Date.now().toString().slice(-6)}${i}`;
            }

            const categoryName = getVal('category_name');
            let category_id: string | null = null;
            if (categoryName) {
              const foundCat = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
              if (foundCat) {
                category_id = foundCat.id;
              }
            }

            const supplierName = getVal('supplier_name');
            let supplier_id: string | null = null;
            if (supplierName) {
              const foundSupp = suppliers.find(s => s.name.toLowerCase() === supplierName.toLowerCase());
              if (foundSupp) {
                supplier_id = foundSupp.id;
              }
            }

            const cost_price = cleanNumber(getVal('cost_price'));
            const sell_price = cleanNumber(getVal('sell_price'));
            const stock_quantity = parseInt(getVal('stock_quantity'), 10) || 0;
            const min_stock_level = parseInt(getVal('min_stock_level'), 10) || 10;
            const unitVal = getVal('unit');

            const isActiveStr = getVal('is_active').toLowerCase();
            const is_active = isActiveStr === 'ngừng bán' || isActiveStr === 'inactive' || isActiveStr === 'false' ? false : true;

            parsedProducts.push({
              sku: skuVal,
              barcode: getVal('barcode') || null,
              name: nameVal,
              category_id,
              supplier_id,
              cost_price,
              sell_price,
              stock_quantity,
              min_stock_level,
              unit: unitVal || undefined,
              is_active,
              description: getVal('description') || null,
            });
          }

          if (parsedProducts.length === 0) {
            toast.error('Không tìm thấy sản phẩm hợp lệ để import.');
            return;
          }

          const response = await catalogAPI.products.createBulk(parsedProducts);
          const { imported, skipped, skippedSkus } = response.data.data;

          if (imported > 0) {
            if (skipped > 0) {
              toast.success(`Đã import thành công ${imported} sản phẩm! (Bỏ qua ${skipped} trùng SKU: ${skippedSkus.slice(0, 3).join(', ')}${skippedSkus.length > 3 ? '...' : ''})`, { duration: 6000 });
            } else {
              toast.success(`Đã import thành công toàn bộ ${imported} sản phẩm!`);
            }
            await loadProducts();
          } else {
            toast.error(`Không có sản phẩm nào được nhập. Bỏ qua ${skipped} trùng SKU: ${skippedSkus.join(', ')}`);
          }
        } catch (err) {
          console.error(err);
          toast.error('Lỗi khi xử lý dữ liệu file import');
        }
      };
      reader.readAsText(file);
    };
    fileInput.click();
  };

  return (
    <div className="flex flex-col 2xl:flex-row gap-4 2xl:gap-6 bg-slate-50 font-sans text-slate-800">
      
      {/* LEFT CONTENT AREA */}
      <div className="flex-1 space-y-5 min-w-0 overflow-hidden">
        
        {/* Page Title & Subtitle */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 border-b border-slate-200/60 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <HiOutlineCube className="w-5.5 h-5.5" />
            </div>
            <div>
              <h1 className="text-base sm:text-xl font-black text-slate-800 uppercase leading-none tracking-tight">Quản lý sản phẩm</h1>
              <p className="text-xs text-slate-400 font-bold tracking-wide mt-1">Quản lý thông tin, giá bán, tồn kho và trạng thái sản phẩm</p>
            </div>
          </div>
        </header>

        {/* 1. TOP KPI SUMMARY CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Total products */}
          <div className="bg-white border border-slate-200/60 p-4 rounded-2xl flex items-center gap-4 shadow-sm relative overflow-hidden">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
              <HiOutlineCube className="w-6 h-6" />
            </div>
            <div className="leading-tight">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tổng sản phẩm</p>
              <h2 className="text-2xl font-black text-slate-800 mt-1">{stats.total.toLocaleString('vi-VN')}</h2>
              <span className="text-[10px] font-bold text-emerald-600 flex items-center mt-1">
                +28 sản phẩm mới ↗
              </span>
            </div>
          </div>

          {/* Active Products */}
          <div className="bg-white border border-slate-200/60 p-4 rounded-2xl flex items-center gap-4 shadow-sm relative overflow-hidden">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <div className="leading-tight">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sản phẩm đang bán</p>
              <h2 className="text-2xl font-black text-slate-800 mt-1">{stats.active.toLocaleString('vi-VN')}</h2>
              <span className="text-[10px] font-bold text-slate-400 mt-1 block">
                {((stats.active / (stats.total || 1)) * 100).toFixed(1)}% tổng sản phẩm
              </span>
            </div>
          </div>

          {/* Low Stock Warn */}
          <div className="bg-white border border-slate-200/60 p-4 rounded-2xl flex items-center gap-4 shadow-sm relative overflow-hidden">
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
              <HiOutlineExclamationCircle className="w-6 h-6" />
            </div>
            <div className="leading-tight">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sắp hết hàng</p>
              <h2 className="text-2xl font-black text-slate-850 mt-1 text-amber-600">{stats.lowStock}</h2>
              <span className="text-[10px] font-bold text-slate-400 mt-1 block">
                Cần nhập thêm hàng
              </span>
            </div>
          </div>

          {/* Out of stock */}
          <div className="bg-white border border-slate-200/60 p-4 rounded-2xl flex items-center gap-4 shadow-sm relative overflow-hidden">
            <div className="w-11 h-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="leading-tight">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hết hàng</p>
              <h2 className="text-2xl font-black text-red-600 mt-1">{stats.outStock}</h2>
              <span className="text-[10px] font-bold text-slate-400 mt-1 block">
                {((stats.outStock / (stats.total || 1)) * 100).toFixed(1)}% tổng sản phẩm
              </span>
            </div>
          </div>
        </div>

        {/* 2. FILTER CONTROLS PANEL */}
        <div className="bg-white border border-slate-200/60 p-4 rounded-2xl shadow-sm space-y-3.5">
          {/* Main search and filters row */}
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <HiOutlineSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4.5 h-4.5" />
              <input
                id="product-search-input"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Tìm kiếm sản phẩm (F3)..."
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 transition"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-shrink-0">
              <select
                value={selectedCategoryId}
                onChange={(e) => {
                  setSelectedCategoryId(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 bg-white outline-none"
              >
                <option value="all">Tất cả danh mục</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <select
                value={stockStatus}
                onChange={(e) => setStockStatus(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 bg-white outline-none"
              >
                <option value="all">Tình trạng tồn kho</option>
                <option value="in_stock">Còn hàng (Đầy đủ)</option>
                <option value="low_stock">Tồn kho thấp</option>
                <option value="out_of_stock">Đã hết hàng</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 bg-white outline-none"
              >
                <option value="newest">Sắp xếp: Mới nhất</option>
                <option value="price-asc">Giá: Thấp đến Cao</option>
                <option value="price-desc">Giá: Cao đến Thấp</option>
                <option value="stock-asc">Tồn kho: Thấp đến Cao</option>
                <option value="stock-desc">Tồn kho: Cao đến Thấp</option>
              </select>
            </div>

            {canManageProducts && (
              <button
                onClick={handleCreateClick}
                className="px-5 py-2.5 bg-blue-600 text-white hover:bg-blue-700 text-xs font-black uppercase rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition"
              >
                <HiOutlinePlus className="w-4 h-4" />
                <span>Thêm sản phẩm</span>
              </button>
            )}
          </div>

          {/* Action Row: Excel import, export, advanced filters */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <div className="flex items-center gap-2">
              {canManageProducts && (
                <button
                  onClick={handleImportExcelClick}
                  className="px-4 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
                >
                  <HiOutlineUpload className="w-4 h-4 text-emerald-500" />
                  <span>Nhập Excel</span>
                </button>
              )}

              <button
                onClick={handleExportCSV}
                className="px-4 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
              >
                <HiOutlineDownload className="w-4 h-4 text-blue-500" />
                <span>Xuất dữ liệu</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`px-4 py-1.5 border text-xs font-bold rounded-xl flex items-center gap-1.5 transition ${
                  showAdvancedFilters
                    ? 'bg-slate-150 border-slate-300 text-slate-700'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <HiOutlineFilter className="w-4 h-4" />
                <span>Bộ lọc nâng cao</span>
              </button>
              
              <div className="relative" ref={settingsRef}>
                <button
                  onClick={() => setShowTableSettings(!showTableSettings)}
                  className={`p-2 border rounded-xl transition ${showTableSettings ? 'bg-blue-50 border-blue-200 text-blue-600' : 'border-slate-200 hover:bg-slate-50 text-slate-500'}`}
                >
                  <HiOutlineCog className="w-4.5 h-4.5" />
                </button>

                {/* Settings Dropdown Panel */}
                {showTableSettings && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-4 space-y-4 animate-fadeIn">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                        <HiOutlineCog className="w-4 h-4 text-blue-500" />
                        Tùy chỉnh bảng
                      </h4>
                      <button
                        onClick={() => {
                          setVisibleColumns({ image: true, sku: true, name: true, category: true, sell_price: true, cost_price: true, stock: true, min_stock: true, status: true });
                          setTableDensity('normal');
                        }}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800"
                      >
                        Reset mặc định
                      </button>
                    </div>

                    {/* Column Visibility */}
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Ẩn / Hiện cột</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { key: 'image', label: 'Ảnh' },
                          { key: 'sku', label: 'Mã SP' },
                          { key: 'name', label: 'Tên SP' },
                          { key: 'category', label: 'Danh mục' },
                          { key: 'sell_price', label: 'Giá bán' },
                          { key: 'cost_price', label: 'Giá nhập' },
                          { key: 'stock', label: 'Tồn kho' },
                          { key: 'min_stock', label: 'Cảnh báo' },
                          { key: 'status', label: 'Trạng thái' },
                        ].map(col => (
                          <label
                            key={col.key}
                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition text-xs font-bold ${
                              visibleColumns[col.key] ? 'bg-blue-50 text-blue-700' : 'bg-slate-50 text-slate-400'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={visibleColumns[col.key]}
                              onChange={() => toggleColumn(col.key)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                            />
                            {col.label}
                          </label>
                        ))}
                      </div>
                    </div>

                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Advanced filter panels */}
          {showAdvancedFilters && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="space-y-1.5">
                <label className="block font-black text-slate-500 uppercase">Trạng thái bán</label>
                <div className="flex gap-4 mt-1.5">
                  <label className="flex items-center gap-1.5 font-bold text-slate-600 cursor-pointer">
                    <input type="radio" checked={filterActiveStatus === true} onChange={() => setFilterActiveStatus(true)} name="statusFilter" />
                    <span>Đang bán (Active)</span>
                  </label>
                  <label className="flex items-center gap-1.5 font-bold text-slate-600 cursor-pointer">
                    <input type="radio" checked={filterActiveStatus === false} onChange={() => setFilterActiveStatus(false)} name="statusFilter" />
                    <span>Ngừng bán (Inactive)</span>
                  </label>
                  <label className="flex items-center gap-1.5 font-bold text-slate-600 cursor-pointer">
                    <input type="radio" checked={filterActiveStatus === 'all'} onChange={() => setFilterActiveStatus('all')} name="statusFilter" />
                    <span>Tất cả</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block font-black text-slate-500 uppercase">Lọc theo mã vạch</label>
                <input
                  type="text"
                  placeholder="Nhập chính xác mã vạch..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 bg-white font-semibold outline-none"
                />
              </div>

              <div className="flex items-end justify-end">
                <button
                  onClick={() => {
                    setStockStatus('all');
                    setSelectedCategoryId('all');
                    setSearch('');
                    setFilterActiveStatus(true);
                    setShowAdvancedFilters(false);
                    toast.success('Đã reset bộ lọc!');
                  }}
                  className="px-4 py-1.5 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-700"
                >
                  Xóa tất cả bộ lọc
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 3. PRODUCT LIST TABLE */}
        <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto -mx-px">
            <table className="w-full min-w-[900px] text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                  {canManageProducts && (
                    <th className={`${densityPaddingTh} px-4 w-10`}>
                      <input type="checkbox" className="rounded" />
                    </th>
                  )}
                  {visibleColumns.image && <th className={`${densityPaddingTh} px-3 w-14 text-center`}>Ảnh</th>}
                  {visibleColumns.sku && <th className={`${densityPaddingTh} px-3 w-28`}>Mã sản phẩm</th>}
                  {visibleColumns.name && <th className={`${densityPaddingTh} px-3 min-w-[200px]`}>Tên sản phẩm</th>}
                  {visibleColumns.category && <th className={`${densityPaddingTh} px-3`}>Danh mục</th>}
                  {visibleColumns.sell_price && <th className={`${densityPaddingTh} px-3 text-right`}>Giá bán</th>}
                  {visibleColumns.cost_price && <th className={`${densityPaddingTh} px-3 text-right`}>Giá nhập</th>}
                  {visibleColumns.stock && <th className={`${densityPaddingTh} px-3 text-center`}>Tồn kho</th>}
                  {visibleColumns.min_stock && <th className={`${densityPaddingTh} px-3 text-center`}>Cảnh báo</th>}
                  {visibleColumns.status && <th className={`${densityPaddingTh} px-3 text-center`}>Trạng thái</th>}
                  {canManageProducts && <th className={`${densityPaddingTh} px-4 text-center w-28`}>Thao tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                {displayedProducts.length === 0 ? (
                  <tr>
                    <td colSpan={visibleColCount} className="py-12 text-center text-slate-400 font-extrabold uppercase">
                      Không có sản phẩm nào khớp bộ lọc
                    </td>
                  </tr>
                ) : (
                  displayedProducts.map((p) => {
                    const isOutOfStock = p.stock_quantity <= 0;
                    const isLowStock = p.stock_quantity <= p.min_stock_level;
                    
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/40 transition">
                        {canManageProducts && (
                          <td className={`${densityPadding} px-4`}>
                            <input type="checkbox" className="rounded" />
                          </td>
                        )}
                        
                        {/* Image column */}
                        {visibleColumns.image && (
                          <td className={`${tableDensity === 'compact' ? 'py-1' : 'py-2'} px-3 text-center`}>
                            <div className={`${tableDensity === 'compact' ? 'w-7 h-7' : 'w-10 h-10'} rounded-lg border border-slate-100 bg-white p-0.5 flex items-center justify-center overflow-hidden mx-auto shadow-sm`}>
                              <img
                                src={getProductImage(p)}
                                alt={p.name}
                                className="max-h-full max-w-full object-contain"
                                loading="lazy"
                              />
                            </div>
                          </td>
                        )}

                        {/* SKU */}
                        {visibleColumns.sku && (
                          <td className={`${densityPadding} px-3 uppercase font-extrabold text-slate-500`}>
                            {p.sku}
                          </td>
                        )}

                        {/* Name & Unit */}
                        {visibleColumns.name && (
                          <td className={`${densityPadding} px-3`}>
                            <div className="font-extrabold text-slate-800 leading-snug">{p.name}</div>
                            {tableDensity !== 'compact' && (
                              <span className="text-[10px] text-slate-400 font-bold mt-0.5 block uppercase">
                                Đơn vị: {p.unit || 'Chưa nhập'}
                              </span>
                            )}
                          </td>
                        )}

                        {/* Category */}
                        {visibleColumns.category && (
                          <td className={`${densityPadding} px-3 text-slate-500 font-bold`}>
                            {p.categories?.name || '---'}
                          </td>
                        )}



                        {/* Sell Price */}
                        {visibleColumns.sell_price && (
                          <td className={`${densityPadding} px-3 text-right font-black text-slate-800`}>
                            {money(p.sell_price)}
                          </td>
                        )}

                        {/* Cost Price */}
                        {visibleColumns.cost_price && (
                          <td className={`${densityPadding} px-3 text-right font-bold text-slate-400`}>
                            {money(p.cost_price)}
                          </td>
                        )}

                        {/* Stock Quantity */}
                        {visibleColumns.stock && (
                          <td className={`${densityPadding} px-3 text-center font-black text-slate-850`}>
                            {p.stock_quantity}
                          </td>
                        )}

                        {/* Min Alert Level */}
                        {visibleColumns.min_stock && (
                          <td className={`${densityPadding} px-3 text-center font-bold text-slate-400`}>
                            {p.min_stock_level}
                          </td>
                        )}

                        {/* Status Label */}
                        {visibleColumns.status && (
                          <td className={`${densityPadding} px-3 text-center`}>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border whitespace-nowrap ${
                              isOutOfStock
                                ? 'bg-red-50 text-red-600 border-red-200'
                                : isLowStock
                                ? 'bg-amber-50 text-amber-600 border-amber-250'
                                : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                            }`}>
                              {isOutOfStock ? 'Hết hàng' : isLowStock ? 'Tồn thấp' : 'Còn hàng'}
                            </span>
                          </td>
                        )}

                        {canManageProducts && (
                          <td className={`${densityPadding} px-4 text-center`}>
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleEditClick(p)}
                                className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition"
                                title="Sửa thông tin"
                              >
                                <HiOutlinePencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteClick(p)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                                title="Xóa sản phẩm"
                              >
                                <HiOutlineTrash className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Pagination footer */}
          <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span>Hiển thị</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="border border-slate-200 rounded px-1.5 py-0.5 bg-white font-bold text-slate-600"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>sản phẩm/trang</span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-7 h-7 border border-slate-200 rounded bg-white flex items-center justify-center text-slate-500 disabled:opacity-40"
              >
                ‹
              </button>
              {Array.from({ length: Math.ceil(totalItems / limit) }).map((_, index) => {
                const pNum = index + 1;
                return (
                  <button
                    key={pNum}
                    onClick={() => setPage(pNum)}
                    className={`w-7 h-7 rounded text-xs font-black transition ${
                      page === pNum
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {pNum}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(p => Math.min(Math.ceil(totalItems / limit), p + 1))}
                disabled={page >= Math.ceil(totalItems / limit)}
                className="w-7 h-7 border border-slate-200 rounded bg-white flex items-center justify-center text-slate-500 disabled:opacity-40"
              >
                ›
              </button>
            </div>
            
            <span className="font-bold">
              Hiển thị {products.length === 0 ? 0 : (page - 1) * limit + 1} - {Math.min(page * limit, totalItems)} trên {totalItems} sản phẩm
            </span>
          </div>
        </div>
      </div>

      {/* RIGHT SIDEBAR WIDGETS */}
      <aside className="w-full 2xl:w-72 space-y-4 2xl:space-y-5 flex-shrink-0">
        
        {/* Panel 1: Phân loại sản phẩm (Categories list) */}
        <div className="bg-white border border-slate-200/60 p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
              <HiOutlineFolder className="w-4.5 h-4.5 text-blue-500" />
              <span>Phân loại sản phẩm</span>
            </h3>
            <span className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer">Xem tất cả</span>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {categoryCounts.map((cat, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs py-1 hover:bg-slate-50/50 rounded px-1">
                <span className="font-bold text-slate-600">{cat.name}</span>
                <span className="font-black text-slate-850 px-2 py-0.5 bg-slate-50 rounded border border-slate-100">{cat.count}</span>
              </div>
            ))}
            <div className="border-t border-slate-150 pt-2 flex justify-between items-center text-xs font-black text-slate-800">
              <span>Tổng cộng</span>
              <span>{stats.total}</span>
            </div>
          </div>
        </div>

        {/* Panel 2: Tình trạng tồn kho (Stock status breakdown) */}
        <div className="bg-white border border-slate-200/60 p-4 rounded-2xl shadow-sm">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center gap-1.5 border-b border-slate-100 pb-2.5 mb-3.5">
            <HiOutlineExclamationCircle className="w-4.5 h-4.5 text-amber-500" />
            <span>Tình hình tồn kho</span>
          </h3>

          <div className="flex flex-col items-center justify-center py-2 relative">
            {/* SVG Donut Chart */}
            <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 80 80">
              {/* Active */}
              <circle
                cx="40"
                cy="40"
                r="36"
                fill="transparent"
                stroke="#10b981"
                strokeWidth="8"
                strokeDasharray={`${donutChart.c}`}
                strokeDashoffset={`${donutChart.activeOffset}`}
              />
              {/* Low stock */}
              <circle
                cx="40"
                cy="40"
                r="36"
                fill="transparent"
                stroke="#f59e0b"
                strokeWidth="8"
                strokeDasharray={`${donutChart.c}`}
                strokeDashoffset={`${donutChart.lowStockOffset}`}
              />
              {/* Out of stock */}
              <circle
                cx="40"
                cy="40"
                r="36"
                fill="transparent"
                stroke="#ef4444"
                strokeWidth="8"
                strokeDasharray={`${donutChart.c}`}
                strokeDashoffset={`${donutChart.outStockOffset}`}
              />
            </svg>
            <div className="absolute flex flex-col items-center leading-none text-center">
              <span className="text-lg font-black text-slate-800">{stats.total}</span>
              <span className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">Đang xem</span>
            </div>
          </div>

          <div className="mt-4 space-y-2 text-xs">
            <div className="flex items-center justify-between font-semibold">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                <span>Còn hàng</span>
              </div>
              <span className="font-bold text-slate-600">{stats.active} ({donutChart.activePct}%)</span>
            </div>

            <div className="flex items-center justify-between font-semibold">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-amber-500 rounded-full" />
                <span>Tồn thấp</span>
              </div>
              <span className="font-bold text-slate-600">{stats.lowStock} ({donutChart.lowStockPct}%)</span>
            </div>

            <div className="flex items-center justify-between font-semibold">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-red-500 rounded-full" />
                <span>Hết hàng</span>
              </div>
              <span className="font-bold text-slate-600">{stats.outStock} ({donutChart.outStockPct}%)</span>
            </div>
          </div>
        </div>

      </aside>

      {/* 4. ADD / EDIT PRODUCT MODAL FORM */}
      {showModal && canManageProducts && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">
              {isEditMode ? `Chỉnh sửa sản phẩm: ${name}` : 'Thêm mới sản phẩm'}
            </h3>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">Vui lòng điền thông tin sản phẩm và lưu lại cơ sở dữ liệu.</p>
            
            <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                {/* SKU */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block font-black text-slate-500 uppercase">Mã sản phẩm (SKU) *</label>
                    {(name.trim() || barcode.trim()) && (
                      <button
                        type="button"
                        onClick={() => {
                          const newSku = generateSku(name, barcode);
                          setSku(newSku);
                          toast.success(`Đã tạo SKU: ${newSku}`);
                        }}
                        className="text-[10px] font-black text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 transition"
                      >
                        Tự động tạo SKU
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="Ví dụ: SP000001"
                    className="w-full border border-slate-205 rounded-xl px-4 py-2 font-semibold outline-none focus:border-blue-500 bg-slate-50 transition"
                  />
                </div>

                {/* Barcode */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block font-black text-slate-500 uppercase">Mã vạch (Barcode)</label>
                    <button
                      type="button"
                      onClick={() => handleBarcodeProductLookup(false)}
                      disabled={productLookupLoading || barcode.replace(/\D/g, '').length < 6}
                      className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-black text-blue-600 transition hover:text-blue-800 disabled:opacity-50"
                      title="Đọc dữ liệu sản phẩm từ Open Food Facts"
                    >
                      <HiOutlineSearch className={productLookupLoading ? 'animate-spin' : ''} />
                      {productLookupLoading ? 'Đang đọc...' : 'AI nhận diện'}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="Quét hoặc nhập mã vạch sản phẩm"
                    className="w-full border border-slate-205 rounded-xl px-4 py-2 font-semibold outline-none focus:border-blue-500 bg-slate-50 transition"
                  />
                </div>
              </div>

              {/* Name */}
              <div className="space-y-1">
                <label className="block font-black text-slate-500 uppercase">Tên sản phẩm *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={handleAIAutoCategorize}
                  placeholder="Ví dụ: Coca Cola 330ml"
                  className="w-full border border-slate-205 rounded-xl px-4 py-2 font-semibold outline-none focus:border-blue-500 bg-slate-50 transition"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                {/* Unit */}
                <div className="space-y-1">
                  <label className="block font-black text-slate-500 uppercase">Đơn vị tính</label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="Lon, Chai, Gói..."
                    className="w-full border border-slate-205 rounded-xl px-4 py-2 font-semibold outline-none focus:border-blue-500 bg-slate-50 transition"
                  />
                </div>

                {/* Category select input */}
                <div className="space-y-1">
                  <label className="block font-black text-slate-500 uppercase">Danh mục *</label>
                  <select
                    required
                    value={categoryId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setCategoryId(id);
                      const cat = categories.find((c) => c.id === id);
                      setCategoryName(cat ? cat.name : '');
                    }}
                    className="w-full border border-slate-205 rounded-xl px-4 py-2 font-semibold outline-none focus:border-blue-500 bg-slate-50 transition text-slate-800"
                  >
                    <option value="">-- Chọn danh mục --</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                {/* Cost price */}
                <div className="space-y-1">
                  <label className="block font-black text-slate-500 uppercase">Giá nhập *</label>
                  <input
                    type="number"
                    required
                    value={costPrice || ''}
                    onChange={(e) => setCostPrice(Number(e.target.value))}
                    placeholder="0"
                    className="w-full border border-slate-205 rounded-xl px-4 py-2 font-semibold outline-none focus:border-blue-500 bg-slate-50 transition"
                  />
                </div>

                {/* Sell price */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block font-black text-slate-500 uppercase">Giá bán *</label>
                    {suggestedSellPriceInfo && (
                      <button
                        type="button"
                        onClick={() => {
                          setSellPrice(suggestedSellPriceInfo.price);
                          toast.success(`Đã áp dụng giá gợi ý AI: ${money(suggestedSellPriceInfo.price)}`);
                        }}
                        className="text-[9px] font-black text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 transition"
                        title="Click để áp dụng giá bán đề xuất của AI"
                      >
                        AI Gợi ý: {money(suggestedSellPriceInfo.price)} (+{suggestedSellPriceInfo.marginPercentStr})
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    required
                    value={sellPrice || ''}
                    onChange={(e) => setSellPrice(Number(e.target.value))}
                    placeholder="0"
                    className="w-full border border-slate-205 rounded-xl px-4 py-2 font-semibold outline-none focus:border-blue-500 bg-slate-50 transition"
                  />
                </div>

                {/* Stock Quantity */}
                <div className="space-y-1">
                  <label className="block font-black text-slate-500 uppercase">Số lượng tồn kho</label>
                  <input
                    type="number"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(Number(e.target.value))}
                    placeholder="0"
                    className="w-full border border-slate-205 rounded-xl px-4 py-2 font-semibold outline-none focus:border-blue-500 bg-slate-50 transition"
                  />
                </div>

                {/* Min alert level */}
                <div className="space-y-1">
                  <label className="block font-black text-slate-500 uppercase">Ngưỡng cảnh báo</label>
                  <input
                    type="number"
                    value={minStockLevel}
                    onChange={(e) => setMinStockLevel(Number(e.target.value))}
                    placeholder={String(operationSettings.defaultMinStockLevel)}
                    className="w-full border border-slate-205 rounded-xl px-4 py-2 font-semibold outline-none focus:border-blue-500 bg-slate-50 transition"
                  />
                </div>
              </div>

              {/* Image URL */}
              <div className="space-y-1">
                <label className="block font-black text-slate-500 uppercase">Đường dẫn hình ảnh (URL)</label>
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="w-full border border-slate-205 rounded-xl px-4 py-2 font-semibold outline-none focus:border-blue-500 bg-slate-50 transition"
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block font-black text-slate-500 uppercase">Mô tả sản phẩm</label>
                  <button
                    type="button"
                    onClick={handleAIGenerateDescription}
                    disabled={generatingAI || !name.trim()}
                    className="text-[10px] font-black text-blue-600 hover:text-blue-850 flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200 disabled:opacity-50 transition"
                  >
                    {generatingAI ? (
                      <>
                        <svg className="animate-spin h-3 w-3 text-blue-600" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Đang viết...</span>
                      </>
                    ) : (
                      <>
                        <span>AI Viết mô tả</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Nhập mô tả sản phẩm (ví dụ: nước uống có ga)..."
                  className="w-full border border-slate-205 rounded-xl px-4 py-2 font-semibold outline-none focus:border-blue-500 bg-slate-50 transition h-20 resize-none"
                />
              </div>

              {/* Active/Inactive status toggle */}
              <div className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  id="product-active-toggle"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4.5 h-4.5"
                />
                <label htmlFor="product-active-toggle" className="font-extrabold text-slate-700 cursor-pointer">
                  Mở bán sản phẩm này ngay lập tức (Active)
                </label>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-wider rounded-xl transition"
                >
                  Lưu lại
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsPage;
