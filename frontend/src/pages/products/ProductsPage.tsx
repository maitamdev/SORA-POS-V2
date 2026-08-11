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
  HiOutlineViewGrid,
  HiOutlineViewList,
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
  const [stockStatus, setStockStatus] = useState('all'); // all, in_stock, low_stock, out_of_stock, missing_barcode
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
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
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

      allProducts.forEach((p: Product) => {
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
    } else if (stockStatus === 'missing_barcode') {
      items = items.filter(p => !p.barcode?.trim());
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
      if (!silent) toast.error('Vui lòng nhập hoặc quét mã vạch hợp lệ', { id: 'barcode-lookup' });
      return;
    }

    setProductLookupLoading(true);
    // Hiển thị toast thông báo đang đọc (cả chế độ tự động và thủ công đều có phản hồi trực quan)
    toast.loading('Đang tự động nhận diện sản phẩm...', { id: 'barcode-lookup' });

    try {
      const response = await aiAPI.identifyProductByBarcode(cleanBarcode);
      const suggestion = response.data.data;

      if (suggestion.exists && suggestion.raw) {
        toast.error(`Sản phẩm đã tồn tại: ${suggestion.name}`, { id: 'barcode-lookup' });
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

      toast.success(`AI đã nhận diện (${suggestion.source}): ${suggestion.name}`, { id: 'barcode-lookup' });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Không nhận diện được mã vạch này', { id: 'barcode-lookup' });
    } finally {
      setProductLookupLoading(false);
    }
  };

  useEffect(() => {
    if (!showModal || isEditMode) return;

    const cleanBarcode = barcode.replace(/\D/g, '');
    if (cleanBarcode.length < 8 || cleanBarcode === lastLookupBarcodeRef.current) return;

    // Các chuẩn độ dài mã vạch phổ biến: EAN-8 (8 số), UPC-A (12 số), EAN-13 (13 số).
    // Nếu quét bằng máy quét, độ dài chuẩn này sẽ đạt được ngay lập tức -> tự động tra cứu nhanh sau 150ms.
    // Nếu gõ thủ công thì dùng độ trễ 450ms để chờ gõ xong.
    const isStandardLength = [8, 12, 13].includes(cleanBarcode.length);
    const delay = isStandardLength ? 150 : 450;

    const timer = window.setTimeout(() => {
      handleBarcodeProductLookup(true);
    }, delay);

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

  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1)
    .filter((pageNumber) => pageNumber === 1 || pageNumber === totalPages || Math.abs(pageNumber - page) <= 1);

  return (
    <div className="space-y-5 bg-slate-50 font-sans text-slate-800">
      {false && (
        <div className="hidden">
      
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
              <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-slate-50 p-0.5">
                <button
                  onClick={() => setViewMode('table')}
                  className={`h-8 w-9 flex items-center justify-center rounded-lg transition ${
                    viewMode === 'table'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-700 hover:bg-white'
                  }`}
                  title="Hiển thị dạng bảng"
                  aria-label="Hiển thị dạng bảng"
                >
                  <HiOutlineViewList className="w-4.5 h-4.5" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`h-8 w-9 flex items-center justify-center rounded-lg transition ${
                    viewMode === 'grid'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-700 hover:bg-white'
                  }`}
                  title="Hiển thị dạng lưới"
                  aria-label="Hiển thị dạng lưới"
                >
                  <HiOutlineViewGrid className="w-4.5 h-4.5" />
                </button>
              </div>

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

        {/* 3. PRODUCT LIST */}
        {viewMode === 'table' ? (
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
              <tbody className="divide-y divide-slate-200 text-xs font-semibold text-slate-700">
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
        ) : (
        <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Chế độ lưới POS</p>
              <h3 className="text-sm font-black text-slate-800 mt-0.5">Xem nhanh sản phẩm theo ô vuông</h3>
            </div>
            <span className="text-[11px] font-bold text-slate-500">
              {displayedProducts.length} sản phẩm đang hiển thị
            </span>
          </div>

          {displayedProducts.length === 0 ? (
            <div className="py-16 px-6 text-center text-slate-400 font-extrabold uppercase text-xs">
              Không có sản phẩm nào khớp bộ lọc
            </div>
          ) : (
            <div className="bg-slate-50/70 p-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-3 gap-4">
              {displayedProducts.map((p) => {
                const isOutOfStock = p.stock_quantity <= 0;
                const isLowStock = p.stock_quantity <= p.min_stock_level;
                const statusClass = isOutOfStock
                  ? 'bg-red-50 text-red-600 border-red-200'
                  : isLowStock
                  ? 'bg-amber-50 text-amber-600 border-amber-200'
                  : 'bg-emerald-50 text-emerald-600 border-emerald-200';
                const statusText = isOutOfStock ? 'Hết hàng' : isLowStock ? 'Tồn thấp' : 'Còn hàng';

                return (
                  <article
                    key={p.id}
                    className="group relative rounded-xl border border-slate-300 bg-white p-3 shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-100/60"
                  >
                    {canManageProducts && (
                      <div className="absolute right-2.5 top-2.5 z-10 flex items-center gap-1 rounded-lg border border-slate-200 bg-white/95 p-0.5 shadow-sm opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition">
                        <button
                          onClick={() => handleEditClick(p)}
                          className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-md transition"
                          title="Sửa thông tin"
                        >
                          <HiOutlinePencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(p)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition"
                          title="Xóa sản phẩm"
                        >
                          <HiOutlineTrash className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    <div className="h-24 sm:h-28 rounded-lg bg-white border border-slate-300 flex items-center justify-center p-2 overflow-hidden">
                      <img
                        src={getProductImage(p)}
                        alt={p.name}
                        className="max-h-full max-w-full object-contain transition duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    </div>

                    <div className="mt-3 space-y-2">
                      <div className="min-w-0 border-b border-slate-100 pb-2">
                        <h3 className="text-xs font-black text-slate-850 leading-snug line-clamp-2 min-h-[32px]" title={p.name}>
                          {p.name}
                        </h3>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate mt-1">
                          {p.sku}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border whitespace-nowrap ${statusClass}`}>
                          {statusText}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 truncate">
                          {p.categories?.name || 'Chưa phân loại'}
                        </span>
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 flex items-center justify-between gap-2">
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase">Tồn kho</p>
                          <p className="text-sm font-black text-slate-850">{p.stock_quantity}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[9px] font-black text-slate-400 uppercase">Cảnh báo</p>
                          <p className="text-sm font-black text-slate-850">{p.min_stock_level}</p>
                        </div>
                        <div className="text-right min-w-0">
                          <p className="text-[9px] font-black text-slate-400 uppercase">ĐVT</p>
                          <p className="text-sm font-black text-slate-850 truncate">{p.unit || '-'}</p>
                        </div>
                      </div>

                      <div className="flex items-end justify-between gap-2 rounded-lg border border-blue-100 bg-blue-50/40 px-2.5 py-2">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase">Giá bán</p>
                          <p className="text-sm font-black text-blue-600">{money(p.sell_price)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-slate-400 uppercase">Giá nhập</p>
                          <p className="text-xs font-black text-slate-500">{money(p.cost_price)}</p>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

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
        )}
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
              <span className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">Sản phẩm</span>
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

        </div>
      )}

      {/* REDESIGNED PRODUCT WORKSPACE */}
      <section className="w-full space-y-5">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">Kho hàng / Sản phẩm</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Quản lý sản phẩm</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Thêm và cập nhật sản phẩm, quản lý giá bán, mã vạch và tồn kho.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canManageProducts && (
              <button
                type="button"
                onClick={handleImportExcelClick}
                className="inline-flex h-10 items-center gap-2 border border-blue-200 bg-white px-4 text-sm font-bold text-blue-700 transition hover:border-blue-400 hover:bg-blue-50"
              >
                <HiOutlineUpload className="h-4 w-4" />
                Nhập từ Excel
              </button>
            )}
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex h-10 items-center gap-2 border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <HiOutlineDownload className="h-4 w-4" />
              Xuất dữ liệu
            </button>
            {canManageProducts && (
              <button
                type="button"
                onClick={handleCreateClick}
                className="inline-flex h-10 items-center gap-2 bg-blue-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-blue-700"
              >
                <HiOutlinePlus className="h-4 w-4" />
                Thêm sản phẩm
              </button>
            )}
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {([
            { label: 'Tổng sản phẩm', value: stats.total, note: 'Đang quản lý trong catalog', icon: HiOutlineCube },
            { label: 'Sản phẩm đang bán', value: stats.active, note: 'Đang hiển thị trên POS', icon: HiOutlineEye },
            { label: 'Sắp hết hàng', value: stats.lowStock, note: 'Đã chạm mức tồn tối thiểu', icon: HiOutlineExclamationCircle },
            { label: 'Hết hàng', value: stats.outStock, note: 'Cần nhập thêm hàng', icon: HiOutlineFolder },
          ] as const).map((card) => {
            const Icon = card.icon;
            return (
              <article key={card.label} className="min-h-[132px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{card.label}</p>
                  <span className="flex h-8 w-8 items-center justify-center bg-slate-100 text-slate-500">
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <p className="mt-3 text-2xl font-black tracking-tight text-slate-950">{card.value.toLocaleString('vi-VN')}</p>
                <p className="mt-1 text-xs font-medium text-slate-500">{card.note}</p>
              </article>
            );
          })}
        </div>

        <div className="border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-3 p-4 xl:grid-cols-[minmax(280px,1.5fr)_minmax(160px,1fr)_minmax(160px,1fr)_minmax(160px,1fr)_auto]">
            <label className="relative block">
              <HiOutlineSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="product-search-input"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Tìm tên, SKU, mã vạch"
                className="h-11 w-full border border-slate-200 bg-white pl-10 pr-3 text-sm font-medium outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <select
              value={selectedCategoryId}
              onChange={(e) => {
                setSelectedCategoryId(e.target.value);
                setPage(1);
              }}
              className="h-11 border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">Tất cả danh mục</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            <select
              value={stockStatus}
              onChange={(e) => {
                setStockStatus(e.target.value);
                setPage(1);
              }}
              className="h-11 border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">Tất cả tồn kho</option>
              <option value="in_stock">Còn hàng</option>
              <option value="low_stock">Sắp hết hàng</option>
              <option value="out_of_stock">Hết hàng</option>
              <option value="missing_barcode">Chưa có mã vạch</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-11 border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="newest">Mới cập nhật</option>
              <option value="price-asc">Giá thấp đến cao</option>
              <option value="price-desc">Giá cao đến thấp</option>
              <option value="stock-asc">Tồn kho thấp đến cao</option>
              <option value="stock-desc">Tồn kho cao đến thấp</option>
            </select>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAdvancedFilters((value) => !value)}
                className={`inline-flex h-11 items-center gap-2 border px-3 text-sm font-bold transition ${showAdvancedFilters ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                title="Bộ lọc nâng cao"
              >
                <HiOutlineFilter className="h-4 w-4" />
                <span className="hidden 2xl:inline">Bộ lọc</span>
              </button>
              <div className="flex h-11 items-center border border-slate-200 p-1">
                <button type="button" onClick={() => setViewMode('table')} className={`flex h-9 w-9 items-center justify-center ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`} aria-label="Hiển thị dạng bảng">
                  <HiOutlineViewList className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setViewMode('grid')} className={`flex h-9 w-9 items-center justify-center ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`} aria-label="Hiển thị dạng lưới">
                  <HiOutlineViewGrid className="h-4 w-4" />
                </button>
              </div>
              <div className="relative" ref={settingsRef}>
                <button type="button" onClick={() => setShowTableSettings((value) => !value)} className={`flex h-11 w-11 items-center justify-center border transition ${showTableSettings ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`} aria-label="Tùy chỉnh bảng">
                  <HiOutlineCog className="h-4 w-4" />
                </button>
                {showTableSettings && (
                  <div className="absolute right-0 top-full z-30 mt-2 w-72 border border-slate-200 bg-white p-4 shadow-xl">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <p className="text-xs font-black uppercase tracking-wider text-slate-700">Tùy chỉnh bảng</p>
                      <button type="button" onClick={() => { setVisibleColumns({ image: true, sku: true, name: true, category: true, sell_price: true, cost_price: true, stock: true, min_stock: true, status: true }); setTableDensity('normal'); }} className="text-[11px] font-bold text-blue-600 hover:text-blue-800">Mặc định</button>
                    </div>
                    <p className="mb-2 mt-3 text-[10px] font-black uppercase tracking-wider text-slate-400">Cột hiển thị</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[['image', 'Ảnh'], ['sku', 'SKU'], ['name', 'Tên'], ['category', 'Danh mục'], ['sell_price', 'Giá bán'], ['cost_price', 'Giá nhập'], ['stock', 'Tồn kho'], ['min_stock', 'Mức tối thiểu'], ['status', 'Trạng thái']].map(([key, label]) => (
                        <label key={key} className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600">
                          <input type="checkbox" checked={visibleColumns[key]} onChange={() => toggleColumn(key)} className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                          {label}
                        </label>
                      ))}
                    </div>
                    <p className="mb-2 mt-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Mật độ</p>
                    <div className="grid grid-cols-3 gap-1 border border-slate-200 p-1">
                      {(['compact', 'normal', 'comfortable'] as const).map((density) => (
                        <button key={density} type="button" onClick={() => setTableDensity(density)} className={`py-1.5 text-[11px] font-bold ${tableDensity === density ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                          {density === 'compact' ? 'Gọn' : density === 'normal' ? 'Chuẩn' : 'Thoáng'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 border-t border-slate-100 px-4">
            {[
              ['all', 'Tất cả'],
              ['low_stock', 'Sắp hết hàng'],
              ['out_of_stock', 'Hết hàng'],
              ['missing_barcode', 'Chưa có mã vạch'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => { setStockStatus(value); setPage(1); }}
                className={`relative py-3 text-sm font-bold transition ${stockStatus === value ? 'text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {label}
                {stockStatus === value && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-blue-600" />}
              </button>
            ))}
          </div>

          {showAdvancedFilters && (
            <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">Trạng thái bán</span>
                {([['all', 'Tất cả'], [true, 'Đang bán'], [false, 'Ngừng bán']] as const).map(([value, label]) => (
                  <label key={String(value)} className="inline-flex cursor-pointer items-center gap-2 font-semibold text-slate-700">
                    <input type="radio" name="product-active-filter" checked={filterActiveStatus === value} onChange={() => { setFilterActiveStatus(value); setPage(1); }} className="text-blue-600 focus:ring-blue-500" />
                    {label}
                  </label>
                ))}
              </div>
              <button type="button" onClick={() => { setSearch(''); setSelectedCategoryId('all'); setStockStatus('all'); setSortBy('newest'); setFilterActiveStatus('all'); setPage(1); }} className="self-start text-xs font-bold text-blue-700 hover:text-blue-900 sm:self-auto">Xóa bộ lọc</button>
            </div>
          )}
        </div>

        {viewMode === 'table' ? (
          <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                    {visibleColumns.image && <th className={`${densityPaddingTh} w-16 px-4 text-center`}>Ảnh</th>}
                    {visibleColumns.name && <th className={`${densityPaddingTh} min-w-[240px] px-3`}>Sản phẩm</th>}
                    {visibleColumns.sku && <th className={`${densityPaddingTh} min-w-[150px] px-3`}>SKU / Mã vạch</th>}
                    {visibleColumns.category && <th className={`${densityPaddingTh} min-w-[140px] px-3`}>Danh mục</th>}
                    {visibleColumns.sell_price && <th className={`${densityPaddingTh} min-w-[120px] px-3 text-right`}>Giá bán</th>}
                    {visibleColumns.cost_price && <th className={`${densityPaddingTh} min-w-[120px] px-3 text-right`}>Giá nhập</th>}
                    {visibleColumns.stock && <th className={`${densityPaddingTh} min-w-[140px] px-3`}>Tồn kho</th>}
                    {visibleColumns.status && <th className={`${densityPaddingTh} min-w-[130px] px-3`}>Trạng thái</th>}
                    {canManageProducts && <th className={`${densityPaddingTh} w-24 px-4 text-right`}>Thao tác</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedProducts.length === 0 ? (
                    <tr><td colSpan={Math.max(1, visibleColCount)} className="px-6 py-16 text-center"><HiOutlineCube className="mx-auto h-9 w-9 text-slate-300" /><p className="mt-3 text-sm font-bold text-slate-500">Hiện chưa có sản phẩm phù hợp với bộ lọc</p><p className="mt-1 text-xs text-slate-400">Thử đổi từ khóa hoặc trạng thái tồn kho.</p></td></tr>
                  ) : displayedProducts.map((product) => {
                    const outOfStock = product.stock_quantity <= 0;
                    const lowStock = !outOfStock && product.stock_quantity <= product.min_stock_level;
                    return (
                      <tr key={product.id} className="group transition hover:bg-blue-50/30">
                        {visibleColumns.image && <td className={`${densityPadding} px-4 text-center`}><div className="mx-auto flex h-11 w-11 items-center justify-center overflow-hidden border border-slate-200 bg-white p-1"><img src={getProductImage(product)} alt={product.name} className="max-h-full max-w-full object-contain" loading="lazy" /></div></td>}
                        {visibleColumns.name && <td className={`${densityPadding} px-3`}><p className="max-w-[280px] truncate text-sm font-extrabold text-slate-900" title={product.name}>{product.name}</p><p className="mt-1 text-xs font-medium text-slate-400">Đơn vị: {product.unit || 'Chưa nhập'}</p></td>}
                        {visibleColumns.sku && <td className={`${densityPadding} px-3`}><p className="text-sm font-bold text-slate-700">{product.sku}</p><p className="mt-1 text-xs font-medium text-slate-400">{product.barcode || 'Chưa có mã vạch'}</p></td>}
                        {visibleColumns.category && <td className={`${densityPadding} px-3 text-sm font-semibold text-slate-600`}>{product.categories?.name || 'Chưa phân loại'}</td>}
                        {visibleColumns.sell_price && <td className={`${densityPadding} px-3 text-right text-sm font-black text-slate-900`}>{money(product.sell_price)}</td>}
                        {visibleColumns.cost_price && <td className={`${densityPadding} px-3 text-right text-sm font-semibold text-slate-500`}>{money(product.cost_price)}</td>}
                        {visibleColumns.stock && <td className={`${densityPadding} px-3`}><p className={`text-sm font-black ${outOfStock ? 'text-red-600' : lowStock ? 'text-amber-600' : 'text-slate-800'}`}>{product.stock_quantity} <span className="font-medium text-slate-400">/ tối thiểu {product.min_stock_level}</span></p><span className={`mt-1 inline-flex px-2 py-1 text-[10px] font-black ${outOfStock ? 'bg-red-50 text-red-700' : lowStock ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{outOfStock ? 'Hết hàng' : lowStock ? 'Sắp hết' : 'Còn hàng'}</span></td>}
                        {visibleColumns.status && <td className={`${densityPadding} px-3`}><span className={`inline-flex px-2 py-1 text-[10px] font-black ${product.is_active ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>{product.is_active ? 'Đang bán' : 'Ngừng bán'}</span></td>}
                        {canManageProducts && <td className={`${densityPadding} px-4`}><div className="flex items-center justify-end gap-1"><button type="button" onClick={() => handleEditClick(product)} className="flex h-8 w-8 items-center justify-center text-slate-400 transition hover:bg-blue-50 hover:text-blue-700" title="Sửa sản phẩm"><HiOutlinePencil className="h-4 w-4" /></button><button type="button" onClick={() => handleDeleteClick(product)} className="flex h-8 w-8 items-center justify-center text-slate-400 transition hover:bg-red-50 hover:text-red-600" title="Xóa sản phẩm"><HiOutlineTrash className="h-4 w-4" /></button></div></td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {displayedProducts.length === 0 ? <div className="col-span-full border border-slate-200 bg-white px-6 py-16 text-center"><HiOutlineCube className="mx-auto h-9 w-9 text-slate-300" /><p className="mt-3 text-sm font-bold text-slate-500">Hiện chưa có sản phẩm phù hợp với bộ lọc</p></div> : displayedProducts.map((product) => {
              const outOfStock = product.stock_quantity <= 0;
              const lowStock = !outOfStock && product.stock_quantity <= product.min_stock_level;
              return <article key={product.id} className="group border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"><div className="relative flex h-44 items-center justify-center border border-slate-100 bg-slate-50 p-4"><img src={getProductImage(product)} alt={product.name} className="max-h-full max-w-full object-contain transition group-hover:scale-105" loading="lazy" />{canManageProducts && <div className="absolute right-2 top-2 flex gap-1"><button type="button" onClick={() => handleEditClick(product)} className="flex h-8 w-8 items-center justify-center bg-white text-slate-500 shadow-sm hover:text-blue-700" title="Sửa sản phẩm"><HiOutlinePencil className="h-4 w-4" /></button><button type="button" onClick={() => handleDeleteClick(product)} className="flex h-8 w-8 items-center justify-center bg-white text-slate-500 shadow-sm hover:text-red-600" title="Xóa sản phẩm"><HiOutlineTrash className="h-4 w-4" /></button></div>}</div><p className="mt-4 line-clamp-2 min-h-[40px] text-sm font-extrabold text-slate-900">{product.name}</p><p className="mt-2 text-xs font-medium text-slate-400">SKU: {product.sku}</p><div className="mt-3 flex items-end justify-between gap-3"><p className="text-lg font-black text-blue-700">{money(product.sell_price)}</p><span className={`px-2 py-1 text-[10px] font-black ${outOfStock ? 'bg-red-50 text-red-700' : lowStock ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{outOfStock ? 'Hết hàng' : lowStock ? 'Sắp hết' : `${product.stock_quantity} còn`}</span></div></article>;
            })}
          </div>
        )}

        <footer className="flex flex-col gap-3 border-t border-slate-200 pt-4 text-xs font-semibold text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2"><span>Hiển thị</span><select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }} className="h-8 border border-slate-200 bg-white px-2 font-bold text-slate-700 outline-none"><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option></select><span>sản phẩm/trang</span></div>
          <div className="flex items-center gap-1"><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1} className="flex h-8 w-8 items-center justify-center border border-slate-200 bg-white text-lg text-slate-600 disabled:cursor-not-allowed disabled:opacity-40">‹</button>{pageNumbers.map((pageNumber) => <button type="button" key={pageNumber} onClick={() => setPage(pageNumber)} className={`flex h-8 min-w-8 items-center justify-center border px-2 font-bold ${page === pageNumber ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>{pageNumber}</button>)}<button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages} className="flex h-8 w-8 items-center justify-center border border-slate-200 bg-white text-lg text-slate-600 disabled:cursor-not-allowed disabled:opacity-40">›</button></div>
          <p>Hiển thị {totalItems === 0 ? 0 : (page - 1) * limit + 1} - {Math.min(page * limit, totalItems)} trên {totalItems} sản phẩm</p>
        </footer>
      </section>

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
                  <label className="block font-black text-slate-500 uppercase">Số lượng</label>
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
