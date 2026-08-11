import { FormEvent, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  HiOutlineTag, HiOutlinePlus, HiOutlinePencil, HiOutlineTrash,
  HiOutlineSearch, HiOutlineClock, HiOutlineX,
  HiOutlineCheck, HiOutlineExclamationCircle, HiOutlineLightBulb,
  HiOutlineShoppingCart, HiOutlineFolder, HiOutlineCube,
  HiOutlineLightningBolt, HiOutlineSparkles, HiOutlinePause,
  HiOutlinePlay, HiOutlineCalendar,
} from 'react-icons/hi';
import { FiGift, FiPercent, FiDollarSign, FiHash, FiPackage, FiClock, FiLink } from 'react-icons/fi';
import { promotionAPI } from '../../services/promotion.api';
import { catalogAPI } from '../../services/catalog.api';
import { Promotion, Category, Product } from '../../types/domain.type';
import { useAuthStore } from '../../stores/auth.store';
import { parsePromotionIntent, PROMO_EXAMPLES, type DiscountType } from '../../utils/promoIntentParser';
import {
  DEMO_PROMOTION_USAGE_EVENT,
  readDemoPromotionUsage,
} from '../../utils/promotionUsage';

const money = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;

const DISCOUNT_TYPE_CONFIG: Record<DiscountType, { label: string; color: string; bg: string; border: string }> = {
  percent:            { label: 'Giảm %',        color: 'text-orange-700', bg: 'bg-orange-50',  border: 'border-orange-200' },
  fixed_amount:       { label: 'Giảm tiền',     color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200' },
  buy_x_get_y:        { label: 'Mua X tặng Y',  color: 'text-pink-700',   bg: 'bg-pink-50',    border: 'border-pink-200' },
  fixed_price:        { label: 'Giá combo',     color: 'text-violet-700', bg: 'bg-violet-50',  border: 'border-violet-200' },
  nth_item_discount:  { label: 'SP thứ N giảm', color: 'text-teal-700',   bg: 'bg-teal-50',    border: 'border-teal-200' },
  happy_hour:         { label: 'Happy Hour',    color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-200' },
  bundle:             { label: 'Bundle combo',  color: 'text-rose-700',   bg: 'bg-rose-50',    border: 'border-rose-200' },
};

const DiscountTypeIcon = ({ type, className = 'w-4 h-4' }: { type: DiscountType; className?: string }) => {
  switch (type) {
    case 'percent': return <FiPercent className={className} />;
    case 'fixed_amount': return <FiDollarSign className={className} />;
    case 'buy_x_get_y': return <FiGift className={className} />;
    case 'fixed_price': return <FiPackage className={className} />;
    case 'nth_item_discount': return <HiOutlineLightningBolt className={className} />;
    case 'happy_hour': return <FiClock className={className} />;
    case 'bundle': return <FiLink className={className} />;
  }
};

type PromoStatusKey = 'running' | 'scheduled' | 'disabled' | 'expired' | 'exhausted';

const getPromoStatus = (promo: Promotion): {
  key: PromoStatusKey;
  label: string;
  description: string;
  className: string;
  dot: string;
} => {
  const now = new Date();
  const start = new Date(promo.start_date);
  const end = promo.end_date ? new Date(promo.end_date) : null;

  if (!promo.is_active) {
    return {
      key: 'disabled',
      label: 'Đã tắt',
      description: 'Không áp dụng tại POS',
      className: 'bg-slate-100 text-slate-600 border-slate-200',
      dot: 'bg-slate-400',
    };
  }
  if (now < start) {
    return {
      key: 'scheduled',
      label: 'Sắp diễn ra',
      description: 'Chưa đến ngày bắt đầu',
      className: 'bg-blue-50 text-blue-700 border-blue-200',
      dot: 'bg-blue-500',
    };
  }
  if (end && now > end) {
    return {
      key: 'expired',
      label: 'Đã hết hạn',
      description: 'Đã qua ngày kết thúc',
      className: 'bg-red-50 text-red-700 border-red-200',
      dot: 'bg-red-500',
    };
  }
  if (promo.usage_limit && promo.usage_count >= promo.usage_limit) {
    return {
      key: 'exhausted',
      label: 'Đã hết lượt',
      description: 'Đã dùng hết giới hạn',
      className: 'bg-amber-50 text-amber-800 border-amber-200',
      dot: 'bg-amber-500',
    };
  }
  return {
    key: 'running',
    label: 'Đang áp dụng',
    description: 'Có thể dùng tại POS',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500',
  };
};

const formatDate = (dateStr?: string | Date | null) => {
  if (!dateStr) return 'Không giới hạn';
  const date = dateStr instanceof Date ? dateStr : new Date(dateStr);
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const getPromotionBenefit = (promo: Promotion) => {
  if (promo.discount_type === 'percent') {
    return {
      benefit: `Giảm ${promo.discount_value}%`,
      explanation: 'Tính trên giá trị sản phẩm thuộc phạm vi áp dụng',
    };
  }
  if (promo.discount_type === 'fixed_amount') {
    return {
      benefit: `Giảm trực tiếp ${money(promo.discount_value)}`,
      explanation: 'Trừ vào giá trị sản phẩm thuộc phạm vi áp dụng',
    };
  }
  if (promo.discount_type === 'buy_x_get_y') {
    const buyQuantity = promo.buy_quantity || 0;
    const getQuantity = promo.get_quantity || 0;
    return {
      benefit: `Tặng ${getQuantity} sản phẩm giá thấp nhất`,
      explanation: `Mỗi ${buyQuantity + getQuantity} sản phẩm, chỉ tính tiền ${buyQuantity}`,
    };
  }
  if (promo.discount_type === 'fixed_price') {
    return {
      benefit: `${promo.combo_quantity || 0} sản phẩm chỉ ${money(promo.discount_value)}`,
      explanation: 'Tính theo nhóm sản phẩm đủ số lượng',
    };
  }
  if (promo.discount_type === 'nth_item_discount') {
    return {
      benefit: `Sản phẩm thứ ${promo.nth_item || 2} giảm ${promo.discount_value}%`,
      explanation: 'Ưu đãi cho sản phẩm giá thấp nhất trong nhóm',
    };
  }
  if (promo.discount_type === 'happy_hour') {
    return {
      benefit: `Giảm ${promo.discount_value}% trong khung giờ vàng`,
      explanation: `Áp dụng mỗi ngày từ ${promo.happy_hour_start || 'chưa đặt'} đến ${promo.happy_hour_end || 'chưa đặt'}`,
    };
  }
  const bundleCount = (promo.bundle_product_ids || []).length;
  return {
    benefit: `Combo ${bundleCount} sản phẩm chỉ ${money(promo.discount_value)}`,
    explanation: 'Cần đủ tất cả sản phẩm trong combo',
  };
};

const getValidityDisplay = (promo: Promotion) => {
  const now = new Date();
  const start = new Date(promo.start_date);
  const end = promo.end_date ? new Date(promo.end_date) : null;
  const dayMs = 24 * 60 * 60 * 1000;

  if (!promo.is_active) {
    return {
      primary: 'Đã tắt thủ công',
      secondary: end ? `${formatDate(start)} - ${formatDate(end)}` : `Bắt đầu ${formatDate(start)}`,
    };
  }

  if (now < start) {
    const days = Math.max(1, Math.ceil((start.getTime() - now.getTime()) / dayMs));
    return { primary: `Bắt đầu ${formatDate(start)}`, secondary: `Còn ${days} ngày` };
  }

  if (end && now > end) {
    return { primary: `Kết thúc ${formatDate(end)}`, secondary: 'Đã qua thời hạn sử dụng' };
  }

  if (!end) {
    return { primary: 'Không giới hạn thời gian', secondary: `Bắt đầu từ ${formatDate(start)}` };
  }

  const remainingMs = end.getTime() - now.getTime();
  const remainingDays = Math.ceil(remainingMs / dayMs);
  return {
    primary: `Đến ${formatDate(end)}`,
    secondary: remainingDays <= 1 ? 'Còn dưới 1 ngày' : `Còn ${remainingDays} ngày`,
  };
};

const getUsageDisplay = (promo: Promotion) => {
  if (!promo.usage_limit) {
    return {
      primary: `${promo.usage_count.toLocaleString('vi-VN')} lượt`,
      secondary: 'Không giới hạn lượt dùng',
    };
  }

  const remaining = Math.max(promo.usage_limit - promo.usage_count, 0);
  return {
    primary: `${promo.usage_count.toLocaleString('vi-VN')} / ${promo.usage_limit.toLocaleString('vi-VN')} lượt`,
    secondary: remaining > 0 ? `Còn ${remaining.toLocaleString('vi-VN')} lượt` : 'Đã dùng hết',
  };
};

interface PromotionsTabProps {
  categories: Category[];
}

const PromotionsTab = ({ categories }: PromotionsTabProps) => {
  const { user } = useAuthStore();
  const canManage = user?.role === 'admin' || user?.role === 'manager';
  const isDemoMode = user?.email === 'demo@sora-pos.com';

  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'scheduled' | 'ended'>('all');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Smart Input
  const [smartInput, setSmartInput] = useState('');
  const [smartParsed, setSmartParsed] = useState<ReturnType<typeof parsePromotionIntent>>(null);

  // Form
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDiscountType, setFormDiscountType] = useState<DiscountType>('percent');
  const [formDiscountValue, setFormDiscountValue] = useState<number>(0);
  const [formMaxDiscount, setFormMaxDiscount] = useState<number | ''>('');
  const [formMinOrder, setFormMinOrder] = useState<number>(0);
  const [formBuyQty, setFormBuyQty] = useState<number>(2);
  const [formGetQty, setFormGetQty] = useState<number>(1);
  const [formComboQty, setFormComboQty] = useState<number>(3);
  const [formNthItem, setFormNthItem] = useState<number>(2);
  const [formHappyStart, setFormHappyStart] = useState('14:00');
  const [formHappyEnd, setFormHappyEnd] = useState('17:00');
  const [formBundleProductIds, setFormBundleProductIds] = useState<string[]>([]);
  const [formApplyTo, setFormApplyTo] = useState<'all' | 'category' | 'product'>('all');
  const [formApplyToIds, setFormApplyToIds] = useState<string[]>([]);
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formUsageLimit, setFormUsageLimit] = useState<number | ''>('');
  const [formIsActive, setFormIsActive] = useState(true);

  // Products for product-scope/bundle selection
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [hasRequestedProducts, setHasRequestedProducts] = useState(false);

  const loadPromotions = async () => {
    setLoading(true);
    try {
      const res = await promotionAPI.list({ limit: 500 });
      const demoUsage = isDemoMode ? readDemoPromotionUsage() : {};
      setPromotions(res.data.data.items.map((promotion) => ({
        ...promotion,
        usage_count: promotion.usage_count + (demoUsage[promotion.id] || 0),
      })));
    } catch {
      toast.error('Không tải được danh sách khuyến mãi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPromotions(); }, [isDemoMode]);

  useEffect(() => {
    if (!isDemoMode) return;
    const handleDemoUsageUpdated = () => { loadPromotions(); };
    window.addEventListener(DEMO_PROMOTION_USAGE_EVENT, handleDemoUsageUpdated);
    return () => window.removeEventListener(DEMO_PROMOTION_USAGE_EVENT, handleDemoUsageUpdated);
  }, [isDemoMode]);

  useEffect(() => {
    const listNeedsProductNames = promotions.some((promotion) =>
      promotion.apply_to === 'product' ||
      promotion.discount_type === 'bundle' ||
      Boolean(promotion.get_product_ids?.length)
    );
    const formNeedsProducts = formApplyTo === 'product' || formDiscountType === 'bundle';

    if ((listNeedsProductNames || formNeedsProducts) && !hasRequestedProducts) {
      setHasRequestedProducts(true);
      catalogAPI.products.list({ limit: 500, is_active: true })
        .then((res) => setAllProducts(res.data.data.items))
        .catch(() => {});
    }
  }, [promotions, formApplyTo, formDiscountType, hasRequestedProducts]);

  // ═══ Smart Input — parse on each keystroke ═══
  useEffect(() => {
    if (smartInput.trim().length >= 3) {
      const result = parsePromotionIntent(smartInput);
      setSmartParsed(result);
    } else {
      setSmartParsed(null);
    }
  }, [smartInput]);

  const applySmartResult = () => {
    if (!smartParsed) return;
    setFormDiscountType(smartParsed.discount_type);
    setFormDiscountValue(smartParsed.discount_value);
    setFormName(smartParsed.name || smartInput);
    if (smartParsed.max_discount) setFormMaxDiscount(smartParsed.max_discount);
    if (smartParsed.buy_quantity) setFormBuyQty(smartParsed.buy_quantity);
    if (smartParsed.get_quantity) setFormGetQty(smartParsed.get_quantity);
    if (smartParsed.combo_quantity) setFormComboQty(smartParsed.combo_quantity);
    if (smartParsed.nth_item) setFormNthItem(smartParsed.nth_item);
    if (smartParsed.happy_hour_start) setFormHappyStart(smartParsed.happy_hour_start);
    if (smartParsed.happy_hour_end) setFormHappyEnd(smartParsed.happy_hour_end);
    setSmartInput('');
    setSmartParsed(null);
    toast.success(`Đã nhận diện: ${DISCOUNT_TYPE_CONFIG[smartParsed.discount_type].label}`);
  };

  const resetForm = () => {
    setFormName(''); setFormCode(''); setFormDescription('');
    setFormDiscountType('percent'); setFormDiscountValue(0);
    setFormMaxDiscount(''); setFormMinOrder(0);
    setFormBuyQty(2); setFormGetQty(1); setFormComboQty(3);
    setFormNthItem(2); setFormHappyStart('14:00'); setFormHappyEnd('17:00');
    setFormBundleProductIds([]);
    setFormApplyTo('all'); setFormApplyToIds([]);
    setFormStartDate(''); setFormEndDate('');
    setFormUsageLimit(''); setFormIsActive(true);
    setEditId(null); setProductSearch('');
    setSmartInput(''); setSmartParsed(null);
  };

  const openCreate = () => {
    if (!canManage) { toast.error('Bạn không có quyền tạo khuyến mãi'); return; }
    resetForm();
    setFormStartDate(new Date().toISOString().slice(0, 16));
    setShowModal(true);
  };

  const openEdit = (promo: Promotion) => {
    if (!canManage) { toast.error('Bạn không có quyền chỉnh sửa'); return; }
    setEditId(promo.id);
    setFormName(promo.name);
    setFormCode(promo.code || '');
    setFormDescription(promo.description || '');
    setFormDiscountType(promo.discount_type);
    setFormDiscountValue(promo.discount_value);
    setFormMaxDiscount(promo.max_discount || '');
    setFormMinOrder(promo.min_order_amount);
    setFormBuyQty(promo.buy_quantity || 2);
    setFormGetQty(promo.get_quantity || 1);
    setFormComboQty(promo.combo_quantity || 3);
    setFormNthItem(promo.nth_item || 2);
    setFormHappyStart(promo.happy_hour_start || '14:00');
    setFormHappyEnd(promo.happy_hour_end || '17:00');
    setFormBundleProductIds(promo.bundle_product_ids || []);
    setFormApplyTo(promo.apply_to);
    setFormApplyToIds(promo.apply_to_ids || []);
    setFormStartDate(promo.start_date ? new Date(promo.start_date).toISOString().slice(0, 16) : '');
    setFormEndDate(promo.end_date ? new Date(promo.end_date).toISOString().slice(0, 16) : '');
    setFormUsageLimit(promo.usage_limit || '');
    setFormIsActive(promo.is_active);
    setShowModal(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) { toast.error('Tên khuyến mãi không được để trống'); return; }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: formName.trim(),
        code: formCode.trim() || null,
        description: formDescription.trim() || null,
        discount_type: formDiscountType,
        discount_value: formDiscountType === 'buy_x_get_y' ? 0 : formDiscountValue,
        max_discount: formMaxDiscount || null,
        min_order_amount: formMinOrder,
        buy_quantity: formDiscountType === 'buy_x_get_y' ? formBuyQty : 0,
        get_quantity: formDiscountType === 'buy_x_get_y' ? formGetQty : 0,
        get_product_ids: [],
        combo_quantity: formDiscountType === 'fixed_price' ? formComboQty : 0,
        nth_item: formDiscountType === 'nth_item_discount' ? formNthItem : 2,
        happy_hour_start: formDiscountType === 'happy_hour' ? formHappyStart : null,
        happy_hour_end: formDiscountType === 'happy_hour' ? formHappyEnd : null,
        bundle_product_ids: formDiscountType === 'bundle' ? formBundleProductIds : [],
        apply_to: formApplyTo,
        apply_to_ids: formApplyTo !== 'all' ? formApplyToIds : [],
        start_date: formStartDate || new Date().toISOString(),
        end_date: formEndDate || null,
        usage_limit: formUsageLimit || null,
        is_active: formIsActive,
      };

      if (editId) {
        await promotionAPI.update(editId, payload as Partial<Promotion>);
        toast.success('Đã cập nhật khuyến mãi');
      } else {
        await promotionAPI.create(payload as Partial<Promotion>);
        toast.success('Đã tạo khuyến mãi mới');
      }
      setShowModal(false);
      resetForm();
      await loadPromotions();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi lưu khuyến mãi');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await promotionAPI.remove(id);
      toast.success('Đã xóa khuyến mãi');
      setConfirmDeleteId(null);
      await loadPromotions();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không xóa được');
    }
  };

  const handleToggleActive = async (promo: Promotion) => {
    try {
      await promotionAPI.update(promo.id, { is_active: !promo.is_active } as Partial<Promotion>);
      toast.success(promo.is_active ? 'Đã tắt khuyến mãi' : 'Đã kích hoạt khuyến mãi');
      await loadPromotions();
    } catch {
      toast.error('Lỗi khi cập nhật trạng thái');
    }
  };

  // Stats
  const stats = useMemo(() => {
    let running = 0;
    let scheduled = 0;
    let ended = 0;
    let totalUsage = 0;

    promotions.forEach((promotion) => {
      const status = getPromoStatus(promotion);
      if (status.key === 'running') running += 1;
      else if (status.key === 'scheduled') scheduled += 1;
      else ended += 1;
      totalUsage += promotion.usage_count;
    });

    return { total: promotions.length, running, scheduled, ended, totalUsage };
  }, [promotions]);

  const visiblePromotions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('vi-VN');

    return promotions.filter((promotion) => {
      const status = getPromoStatus(promotion);
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'running' && status.key === 'running')
        || (statusFilter === 'scheduled' && status.key === 'scheduled')
        || (statusFilter === 'ended' && ['disabled', 'expired', 'exhausted'].includes(status.key));

      if (!matchesStatus) return false;
      if (!query) return true;

      return [promotion.name, promotion.code, promotion.description, DISCOUNT_TYPE_CONFIG[promotion.discount_type]?.label]
        .some((value) => value?.toLocaleLowerCase('vi-VN').includes(query));
    });
  }, [promotions, search, statusFilter]);

  const categoryNameById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories]
  );

  const productNameById = useMemo(
    () => new Map(allProducts.map((product) => [product.id, product.name])),
    [allProducts]
  );

  const getScopeDisplay = (promotion: Promotion) => {
    const scopeIds = promotion.discount_type === 'bundle'
      ? promotion.bundle_product_ids || []
      : promotion.apply_to_ids || [];

    if (promotion.discount_type === 'bundle') {
      if (scopeIds.length === 0) {
        return { primary: 'Chưa chọn sản phẩm', secondary: 'Cần cấu hình lại combo', warning: true };
      }
      const names = scopeIds.map((id) => productNameById.get(id)).filter(Boolean) as string[];
      const remaining = Math.max(scopeIds.length - names.slice(0, 2).length, 0);
      return {
        primary: `${scopeIds.length} sản phẩm trong combo`,
        secondary: names.length > 0
          ? `${names.slice(0, 2).join(', ')}${remaining > 0 ? ` và ${remaining} sản phẩm khác` : ''}`
          : 'Đang tải tên sản phẩm',
        warning: false,
      };
    }

    if (promotion.apply_to === 'all') {
      return { primary: 'Toàn bộ đơn hàng', secondary: 'Không giới hạn sản phẩm', warning: false };
    }

    if (scopeIds.length === 0) {
      return {
        primary: promotion.apply_to === 'category' ? 'Chưa chọn danh mục' : 'Chưa chọn sản phẩm',
        secondary: 'Cần cấu hình lại phạm vi',
        warning: true,
      };
    }

    const source = promotion.apply_to === 'category' ? categoryNameById : productNameById;
    const names = scopeIds.map((id) => source.get(id)).filter(Boolean) as string[];
    const entityLabel = promotion.apply_to === 'category' ? 'danh mục' : 'sản phẩm';
    const shownNames = names.slice(0, 2);
    const remaining = Math.max(scopeIds.length - shownNames.length, 0);

    return {
      primary: `${scopeIds.length} ${entityLabel}`,
      secondary: shownNames.length > 0
        ? `${shownNames.join(', ')}${remaining > 0 ? ` và ${remaining} ${entityLabel} khác` : ''}`
        : `Đang tải tên ${entityLabel}`,
      warning: false,
    };
  };

  const getConditionLabels = (promotion: Promotion) => {
    const labels: string[] = [];
    if (promotion.min_order_amount > 0) labels.push(`Đơn tối thiểu ${money(promotion.min_order_amount)}`);
    if (promotion.max_discount && ['percent', 'happy_hour'].includes(promotion.discount_type)) {
      labels.push(`Giảm tối đa ${money(promotion.max_discount)}`);
    }
    return labels;
  };

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return allProducts.slice(0, 50);
    const q = productSearch.toLowerCase();
    return allProducts.filter(p =>
      p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [allProducts, productSearch]);

  const toggleApplyId = (id: string) => {
    setFormApplyToIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleBundleId = (id: string) => {
    setFormBundleProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-600">Bán hàng / Ưu đãi</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Quản lý khuyến mãi</h1>
          <p className="mt-1 max-w-2xl text-sm font-medium text-slate-500">
            Theo dõi chương trình đang áp dụng, điều kiện nhận ưu đãi và thời hạn sử dụng.
          </p>
        </div>
        {canManage && (
          <button type="button" onClick={openCreate}
            className="inline-flex h-10 items-center justify-center gap-2 bg-blue-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 active:translate-y-px">
            <HiOutlinePlus className="h-4 w-4" />
            Tạo khuyến mãi
          </button>
        )}
      </header>

      <section className="border border-slate-200 bg-white shadow-sm" aria-label="Tổng quan khuyến mãi">
        <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 xl:grid-cols-4 xl:divide-y-0">
          {[
            { label: 'Tổng chương trình', value: stats.total, note: 'Đang quản lý', icon: FiGift, tone: 'text-slate-950' },
            { label: 'Đang áp dụng', value: stats.running, note: 'Có thể dùng tại POS', icon: HiOutlineLightBulb, tone: 'text-emerald-700' },
            { label: 'Sắp diễn ra', value: stats.scheduled, note: 'Chờ đến ngày bắt đầu', icon: HiOutlineCalendar, tone: 'text-blue-700' },
            { label: 'Lượt đã dùng', value: stats.totalUsage, note: 'Tổng trên mọi chương trình', icon: FiHash, tone: 'text-slate-950' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.label} className="min-h-[116px] p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{item.label}</p>
                  <Icon className="h-4 w-4 text-slate-400" />
                </div>
                <p className={`mt-3 text-2xl font-black tracking-tight ${item.tone}`}>{item.value.toLocaleString('vi-VN')}</p>
                <p className="mt-1 text-xs font-medium text-slate-500">{item.note}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 p-4 xl:flex-row xl:items-center xl:justify-between">
          <label className="relative block w-full xl:max-w-[360px]">
            <HiOutlineSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <span className="sr-only">Tìm khuyến mãi</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm tên chương trình hoặc mã"
              aria-label="Tìm tên chương trình hoặc mã khuyến mãi"
              className="h-11 w-full border border-slate-200 bg-white pl-10 pr-3 text-sm font-medium outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <div className="grid grid-cols-2 border border-slate-200 sm:flex sm:max-w-full sm:overflow-x-auto">
            {([
              { value: 'all' as const, label: 'Tất cả', count: stats.total },
              { value: 'running' as const, label: 'Đang áp dụng', count: stats.running },
              { value: 'scheduled' as const, label: 'Sắp diễn ra', count: stats.scheduled },
              { value: 'ended' as const, label: 'Đã kết thúc', count: stats.ended },
            ]).map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatusFilter(filter.value)}
                aria-pressed={statusFilter === filter.value}
                className={`inline-flex h-10 items-center justify-center gap-2 px-3 text-xs font-bold transition sm:shrink-0 ${statusFilter === filter.value ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                {filter.label}
                <span className={`text-[11px] ${statusFilter === filter.value ? 'text-slate-300' : 'text-slate-400'}`}>{filter.count}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold text-slate-500">
            Hiển thị <span className="font-black text-slate-800">{visiblePromotions.length}</span> chương trình
            {search.trim() ? ` phù hợp với “${search.trim()}”` : ''}
          </p>
          <p className="inline-flex items-center gap-1.5 font-medium text-slate-400">
            <HiOutlineLightBulb className="h-3.5 w-3.5 text-blue-500" />
            Không có mã là tự động áp dụng tại POS
          </p>
        </div>
      </section>

      <section className="overflow-hidden border border-slate-200 bg-white shadow-sm" aria-label="Danh sách chương trình khuyến mãi">
        {loading ? (
          <div className="divide-y divide-slate-100" aria-label="Đang tải danh sách khuyến mãi">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="grid animate-pulse gap-4 p-5 motion-reduce:animate-none 2xl:grid-cols-[minmax(220px,1.2fr)_minmax(260px,1.45fr)_minmax(220px,1.2fr)_minmax(180px,1fr)_minmax(140px,.8fr)_minmax(145px,.8fr)_116px]">
                <div className="h-12 bg-slate-100" />
                <div className="space-y-2"><div className="h-4 w-40 bg-slate-100" /><div className="h-3 w-56 bg-slate-100" /></div>
                <div className="space-y-2"><div className="h-4 w-32 bg-slate-100" /><div className="h-3 w-44 bg-slate-100" /></div>
                <div className="space-y-2"><div className="h-4 w-28 bg-slate-100" /><div className="h-3 w-24 bg-slate-100" /></div>
                <div className="space-y-2"><div className="h-4 w-20 bg-slate-100" /><div className="h-3 w-24 bg-slate-100" /></div>
                <div className="h-7 w-28 bg-slate-100" />
                <div className="h-8 w-24 bg-slate-100" />
              </div>
            ))}
          </div>
        ) : visiblePromotions.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center bg-blue-50 text-blue-500">
              <FiGift className="h-7 w-7" />
            </div>
            <p className="mt-4 text-sm font-black text-slate-800">
              {promotions.length === 0 ? 'Chưa có chương trình khuyến mãi' : 'Không tìm thấy chương trình phù hợp'}
            </p>
            <p className="mt-1 max-w-sm text-xs font-medium text-slate-500">
              {promotions.length === 0 ? 'Tạo chương trình đầu tiên để POS tự nhận diện ưu đãi cho khách hàng.' : 'Thử đổi từ khóa hoặc trạng thái lọc để xem các chương trình khác.'}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {promotions.length > 0 && (search || statusFilter !== 'all') && (
                <button type="button" onClick={() => { setSearch(''); setStatusFilter('all'); }} className="h-9 border border-slate-200 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50">
                  Xóa bộ lọc
                </button>
              )}
              {promotions.length === 0 && canManage && (
                <button type="button" onClick={openCreate} className="h-9 bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-700">
                  Tạo khuyến mãi
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto 2xl:block">
              <table className="w-full min-w-[1250px] text-left">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-500">
                    <th className="w-[230px] px-4 py-3">Chương trình</th>
                    <th className="w-[285px] px-4 py-3">Khách nhận được</th>
                    <th className="w-[245px] px-4 py-3">Áp dụng cho</th>
                    <th className="w-[190px] px-4 py-3">Hiệu lực</th>
                    <th className="w-[155px] px-4 py-3">Lượt dùng</th>
                    <th className="w-[150px] px-4 py-3">Trạng thái</th>
                    {canManage && <th className="w-[116px] px-4 py-3 text-right">Thao tác</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visiblePromotions.map((promo) => {
                    const status = getPromoStatus(promo);
                    const typeInfo = DISCOUNT_TYPE_CONFIG[promo.discount_type] || DISCOUNT_TYPE_CONFIG.percent;
                    const benefit = getPromotionBenefit(promo);
                    const scope = getScopeDisplay(promo);
                    const validity = getValidityDisplay(promo);
                    const usage = getUsageDisplay(promo);
                    const conditions = getConditionLabels(promo);
                    return (
                      <tr key={promo.id} className="align-top transition hover:bg-blue-50/30">
                        <td className="px-4 py-4">
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-blue-200 bg-blue-50 text-blue-700">
                              <DiscountTypeIcon type={promo.discount_type} className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-slate-900" title={promo.name}>{promo.name}</p>
                              <p className="mt-1 text-[11px] font-bold text-blue-700">{typeInfo.label}</p>
                              {promo.description && <p className="mt-1 line-clamp-2 text-xs font-medium text-slate-500" title={promo.description}>{promo.description}</p>}
                              {promo.code ? (
                                <span className="mt-2 inline-flex items-center gap-1 border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-black tracking-wide text-slate-700">
                                  <HiOutlineTag className="h-3 w-3 text-slate-400" /> Nhập mã {promo.code}
                                </span>
                              ) : (
                                <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-black text-blue-700">
                                  <HiOutlineLightBulb className="h-3 w-3" /> Tự động tại POS
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm font-black leading-5 text-slate-900">{benefit.benefit}</p>
                          <p className="mt-1 text-xs font-medium leading-5 text-slate-500">{benefit.explanation}</p>
                          {conditions.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {conditions.map((condition) => <span key={condition} className="border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-600">{condition}</span>)}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <p className={`text-sm font-black ${scope.warning ? 'text-amber-700' : 'text-slate-800'}`}>{scope.primary}</p>
                          <p className={`mt-1 text-xs font-medium leading-5 ${scope.warning ? 'text-amber-600' : 'text-slate-500'}`}>{scope.secondary}</p>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-start gap-2">
                            <HiOutlineCalendar className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                            <div>
                              <p className="text-xs font-black text-slate-700">{validity.primary}</p>
                              <p className="mt-1 text-[11px] font-medium text-slate-500">{validity.secondary}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm font-black text-slate-800">{usage.primary}</p>
                          <p className="mt-1 text-[11px] font-medium text-slate-500">{usage.secondary}</p>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-[10px] font-black ${status.className}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />{status.label}
                          </span>
                          <p className="mt-1 text-[10px] font-medium text-slate-400">{status.description}</p>
                        </td>
                        {canManage && (
                          <td className="px-4 py-4 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button type="button" onClick={() => handleToggleActive(promo)} aria-label={promo.is_active ? `Tắt ${promo.name}` : `Bật ${promo.name}`} title={promo.is_active ? 'Tắt chương trình' : 'Bật chương trình'} className={`flex h-8 w-8 items-center justify-center border transition ${promo.is_active ? 'border-amber-200 text-amber-700 hover:bg-amber-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}>
                                {promo.is_active ? <HiOutlinePause className="h-4 w-4" /> : <HiOutlinePlay className="h-4 w-4" />}
                              </button>
                              <button type="button" onClick={() => openEdit(promo)} aria-label={`Sửa ${promo.name}`} title="Sửa chương trình" className="flex h-8 w-8 items-center justify-center border border-slate-200 text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
                                <HiOutlinePencil className="h-4 w-4" />
                              </button>
                              <button type="button" onClick={() => setConfirmDeleteId(promo.id)} aria-label={`Xóa ${promo.name}`} title="Xóa chương trình" className="flex h-8 w-8 items-center justify-center border border-slate-200 text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700">
                                <HiOutlineTrash className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 2xl:hidden">
              {visiblePromotions.map((promo) => {
                const status = getPromoStatus(promo);
                const benefit = getPromotionBenefit(promo);
                const scope = getScopeDisplay(promo);
                const validity = getValidityDisplay(promo);
                const usage = getUsageDisplay(promo);
                const conditions = getConditionLabels(promo);
                return (
                  <article key={promo.id} className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-blue-200 bg-blue-50 text-blue-700">
                          <DiscountTypeIcon type={promo.discount_type} className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-slate-900">{promo.name}</p>
                          <p className="mt-1 text-[11px] font-bold text-blue-700">{DISCOUNT_TYPE_CONFIG[promo.discount_type]?.label}</p>
                        </div>
                      </div>
                      <span className={`inline-flex shrink-0 items-center gap-1.5 border px-2 py-1 text-[10px] font-black ${status.className}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />{status.label}
                      </span>
                    </div>

                    <div className="mt-4 border-l-2 border-blue-500 bg-blue-50 px-3 py-3">
                      <p className="text-sm font-black text-slate-900">{benefit.benefit}</p>
                      <p className="mt-1 text-xs font-medium leading-5 text-slate-600">{benefit.explanation}</p>
                      {conditions.length > 0 && <p className="mt-2 text-[11px] font-bold text-slate-600">{conditions.join('  |  ')}</p>}
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Áp dụng cho</p>
                        <p className={`mt-1 font-black ${scope.warning ? 'text-amber-700' : 'text-slate-800'}`}>{scope.primary}</p>
                        <p className={`mt-1 font-medium ${scope.warning ? 'text-amber-600' : 'text-slate-500'}`}>{scope.secondary}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Hiệu lực</p>
                        <p className="mt-1 font-black text-slate-800">{validity.primary}</p>
                        <p className="mt-1 font-medium text-slate-500">{validity.secondary}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Lượt dùng</p>
                        <p className="mt-1 font-black text-slate-800">{usage.primary}</p>
                        <p className="mt-1 font-medium text-slate-500">{usage.secondary}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                      {promo.code ? <span className="inline-flex items-center gap-1 text-[10px] font-black text-slate-600"><HiOutlineTag className="h-3 w-3 text-slate-400" /> Nhập mã {promo.code}</span> : <span className="inline-flex items-center gap-1 text-[10px] font-black text-blue-700"><HiOutlineLightBulb className="h-3 w-3" /> Tự động tại POS</span>}
                      {canManage && (
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => handleToggleActive(promo)} className={`inline-flex h-8 items-center gap-1 border px-2 text-[11px] font-bold ${promo.is_active ? 'border-amber-200 text-amber-700' : 'border-emerald-200 text-emerald-700'}`}>
                            {promo.is_active ? <HiOutlinePause className="h-3.5 w-3.5" /> : <HiOutlinePlay className="h-3.5 w-3.5" />}
                            {promo.is_active ? 'Tắt' : 'Bật'}
                          </button>
                          <button type="button" onClick={() => openEdit(promo)} className="inline-flex h-8 items-center gap-1 border border-slate-200 px-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50"><HiOutlinePencil className="h-3.5 w-3.5" /> Sửa</button>
                          <button type="button" onClick={() => setConfirmDeleteId(promo.id)} aria-label={`Xóa ${promo.name}`} className="flex h-8 w-8 items-center justify-center border border-slate-200 text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"><HiOutlineTrash className="h-3.5 w-3.5" /></button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* Delete Confirm */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setConfirmDeleteId(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-600"><HiOutlineTrash className="w-5 h-5" /></div>
              <div><h3 className="text-sm font-black text-slate-800">Xóa khuyến mãi?</h3><p className="text-xs text-slate-500 mt-0.5">Thao tác này không thể hoàn tác</p></div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-extrabold text-slate-700 hover:bg-slate-50 transition">Hủy</button>
              <button onClick={() => handleDelete(confirmDeleteId)} className="flex-1 py-2 rounded-xl bg-red-600 text-white text-xs font-extrabold hover:bg-red-700 transition shadow-md">Xác nhận xóa</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* CREATE/EDIT MODAL with SMART INPUT          */}
      {/* ═══════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto pt-6 pb-6" onClick={() => { setShowModal(false); resetForm(); }}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl mx-4 my-auto" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600"><FiGift className="w-5 h-5" /></div>
                <h3 className="text-sm font-black text-slate-800">{editId ? 'Chỉnh sửa khuyến mãi' : 'Tạo khuyến mãi mới'}</h3>
              </div>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition"><HiOutlineX className="w-5 h-5" /></button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[72vh] overflow-y-auto">

              {/* ═══ SMART INPUT ═══ */}
              {!editId && (
                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-[10px] font-black text-blue-600 uppercase tracking-wider">
                    <HiOutlineSparkles className="w-3.5 h-3.5" /> Nhập nhanh bằng mô tả
                  </label>
                  <div className="relative">
                    <input
                      type="text" value={smartInput}
                      onChange={(e) => setSmartInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && smartParsed) { e.preventDefault(); applySmartResult(); } }}
                      placeholder='VD: "SP thứ 2 giảm 50%" hoặc "Mua 2 tặng 1"'
                      className="w-full border border-blue-200 bg-blue-50/30 rounded-xl px-3 py-2.5 text-xs font-semibold outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition pr-20"
                    />
                    {smartParsed && (
                      <button type="button" onClick={applySmartResult}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-blue-600 text-white text-[10px] font-black rounded-lg hover:bg-blue-700 transition">
                        Áp dụng
                      </button>
                    )}
                  </div>

                  {/* Smart parse preview */}
                  {smartParsed && (
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${DISCOUNT_TYPE_CONFIG[smartParsed.discount_type].bg} ${DISCOUNT_TYPE_CONFIG[smartParsed.discount_type].border}`}>
                      <DiscountTypeIcon type={smartParsed.discount_type} className={`w-4 h-4 ${DISCOUNT_TYPE_CONFIG[smartParsed.discount_type].color}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-[11px] font-black ${DISCOUNT_TYPE_CONFIG[smartParsed.discount_type].color}`}>
                          {DISCOUNT_TYPE_CONFIG[smartParsed.discount_type].label}: {smartParsed.name}
                        </p>
                      </div>
                      <span className="text-[9px] font-bold text-slate-400">{Math.round(smartParsed.confidence * 100)}%</span>
                    </div>
                  )}

                  {/* Example chips */}
                  {!smartInput && (
                    <div className="flex flex-wrap gap-1.5">
                      {PROMO_EXAMPLES.slice(0, 4).map((ex) => (
                        <button key={ex} type="button" onClick={() => setSmartInput(ex)}
                          className="px-2 py-1 text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition">
                          {ex}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Divider */}
              {!editId && <div className="border-t border-slate-100 pt-2"><p className="text-[9px] font-bold text-slate-400 text-center uppercase">hoặc cấu hình thủ công bên dưới</p></div>}

              {/* Name */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Tên chương trình *</label>
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)}
                  placeholder="VD: Giảm 20% cuối tuần / SP thứ 2 nửa giá"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition" required />
              </div>

              {/* Code + Description */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Mã khuyến mãi</label>
                  <input type="text" value={formCode} onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="VD: SALE20"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-blue-500 transition uppercase" />
                  <p className="text-[9px] text-slate-400">Bỏ trống → tự động áp dụng</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Mô tả</label>
                  <input type="text" value={formDescription} onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Ghi chú..." className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-blue-500 transition" />
                </div>
              </div>

              {/* ═══ TYPE SELECTOR ═══ */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Loại khuyến mãi *</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {(Object.entries(DISCOUNT_TYPE_CONFIG) as [DiscountType, typeof DISCOUNT_TYPE_CONFIG['percent']][]).map(([key, info]) => (
                    <button key={key} type="button" onClick={() => setFormDiscountType(key)}
                      className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-[10px] font-black border transition-all ${
                        formDiscountType === key ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500/20' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}>
                      <DiscountTypeIcon type={key} className="w-3.5 h-3.5" />{info.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ═══ DYNAMIC FIELDS ═══ */}

              {/* Percent */}
              {formDiscountType === 'percent' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-orange-50/50 rounded-xl border border-orange-100">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-orange-600 uppercase tracking-wider">Phần trăm giảm (%)*</label>
                    <input type="number" value={formDiscountValue || ''} onChange={(e) => setFormDiscountValue(Number(e.target.value))}
                      placeholder="VD: 20" min={1} max={100} className="w-full border border-orange-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-orange-500 transition" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-orange-600 uppercase tracking-wider">Giảm tối đa (đ)</label>
                    <input type="number" value={formMaxDiscount} onChange={(e) => setFormMaxDiscount(e.target.value ? Number(e.target.value) : '')}
                      placeholder="Không giới hạn" min={0} className="w-full border border-orange-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-orange-500 transition" />
                  </div>
                </div>
              )}

              {/* Fixed Amount */}
              {formDiscountType === 'fixed_amount' && (
                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 space-y-1">
                  <label className="text-[10px] font-black text-blue-600 uppercase tracking-wider">Số tiền giảm (đ) *</label>
                  <input type="number" value={formDiscountValue || ''} onChange={(e) => setFormDiscountValue(Number(e.target.value))}
                    placeholder="VD: 50000" min={1} className="w-full border border-blue-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-blue-500 transition" required />
                </div>
              )}

              {/* Buy X Get Y */}
              {formDiscountType === 'buy_x_get_y' && (
                <div className="p-3 bg-pink-50/50 rounded-xl border border-pink-100 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-pink-600 uppercase tracking-wider">Mua (số lượng) *</label>
                      <input type="number" value={formBuyQty} onChange={(e) => setFormBuyQty(Number(e.target.value))} min={1}
                        className="w-full border border-pink-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-pink-500 transition" required />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-pink-600 uppercase tracking-wider">Tặng (số lượng) *</label>
                      <input type="number" value={formGetQty} onChange={(e) => setFormGetQty(Number(e.target.value))} min={1}
                        className="w-full border border-pink-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-pink-500 transition" required />
                    </div>
                  </div>
                  <div className="bg-white/80 rounded-lg p-2 border border-pink-200/50">
                    <p className="text-[10px] font-bold text-pink-600 flex items-center gap-1">
                      <FiGift className="w-3 h-3 flex-shrink-0" /> Khách mua <span className="font-black">{formBuyQty}</span> SP, tặng thêm <span className="font-black">{formGetQty}</span> SP (giá thấp nhất miễn phí)
                    </p>
                  </div>
                </div>
              )}

              {/* Fixed Price Combo */}
              {formDiscountType === 'fixed_price' && (
                <div className="p-3 bg-violet-50/50 rounded-xl border border-violet-100 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-violet-600 uppercase tracking-wider">Số SP trong combo *</label>
                      <input type="number" value={formComboQty} onChange={(e) => setFormComboQty(Number(e.target.value))} min={2}
                        className="w-full border border-violet-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-violet-500 transition" required />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-violet-600 uppercase tracking-wider">Giá combo (đ) *</label>
                      <input type="number" value={formDiscountValue || ''} onChange={(e) => setFormDiscountValue(Number(e.target.value))}
                        placeholder="VD: 99000" min={1} className="w-full border border-violet-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-violet-500 transition" required />
                    </div>
                  </div>
                  <div className="bg-white/80 rounded-lg p-2 border border-violet-200/50">
                    <p className="text-[10px] font-bold text-violet-600 flex items-center gap-1">
                      <FiPackage className="w-3 h-3 flex-shrink-0" /> Mua <span className="font-black">{formComboQty}</span> SP bất kỳ = <span className="font-black">{formDiscountValue ? money(formDiscountValue) : '___'}</span>
                    </p>
                  </div>
                </div>
              )}

              {/* ═══ NEW: Nth Item Discount ═══ */}
              {formDiscountType === 'nth_item_discount' && (
                <div className="p-3 bg-teal-50/50 rounded-xl border border-teal-100 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-teal-600 uppercase tracking-wider">SP thứ mấy được giảm *</label>
                      <input type="number" value={formNthItem} onChange={(e) => setFormNthItem(Number(e.target.value))} min={2}
                        className="w-full border border-teal-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-teal-500 transition" required />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-teal-600 uppercase tracking-wider">Giảm bao nhiêu (%) *</label>
                      <input type="number" value={formDiscountValue || ''} onChange={(e) => setFormDiscountValue(Number(e.target.value))}
                        placeholder="VD: 50" min={1} max={100}
                        className="w-full border border-teal-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-teal-500 transition" required />
                    </div>
                  </div>
                  <div className="bg-white/80 rounded-lg p-2 border border-teal-200/50">
                    <p className="text-[10px] font-bold text-teal-600 flex items-center gap-1">
                      <HiOutlineLightningBolt className="w-3 h-3 flex-shrink-0" /> SP thứ <span className="font-black">{formNthItem}</span> được giảm <span className="font-black">{formDiscountValue || '___'}%</span>
                      {formNthItem === 2 && formDiscountValue === 50 && <span className="ml-1 text-[9px] text-teal-500">(nửa giá — như CK)</span>}
                    </p>
                  </div>
                </div>
              )}

              {/* ═══ NEW: Happy Hour ═══ */}
              {formDiscountType === 'happy_hour' && (
                <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-amber-600 uppercase tracking-wider">Từ lúc *</label>
                      <input type="time" value={formHappyStart} onChange={(e) => setFormHappyStart(e.target.value)}
                        className="w-full border border-amber-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-amber-500 transition" required />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-amber-600 uppercase tracking-wider">Đến lúc *</label>
                      <input type="time" value={formHappyEnd} onChange={(e) => setFormHappyEnd(e.target.value)}
                        className="w-full border border-amber-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-amber-500 transition" required />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-amber-600 uppercase tracking-wider">Giảm (%) *</label>
                      <input type="number" value={formDiscountValue || ''} onChange={(e) => setFormDiscountValue(Number(e.target.value))}
                        placeholder="30" min={1} max={100}
                        className="w-full border border-amber-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-amber-500 transition" required />
                    </div>
                  </div>
                  <div className="bg-white/80 rounded-lg p-2 border border-amber-200/50">
                    <p className="text-[10px] font-bold text-amber-600 flex items-center gap-1">
                      <FiClock className="w-3 h-3 flex-shrink-0" /> Mỗi ngày từ <span className="font-black">{formHappyStart}</span> đến <span className="font-black">{formHappyEnd}</span> giảm <span className="font-black">{formDiscountValue || '___'}%</span>
                    </p>
                  </div>
                </div>
              )}

              {/* ═══ NEW: Bundle ═══ */}
              {formDiscountType === 'bundle' && (
                <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-100 space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-rose-600 uppercase tracking-wider">Giá bundle (đ) *</label>
                    <input type="number" value={formDiscountValue || ''} onChange={(e) => setFormDiscountValue(Number(e.target.value))}
                      placeholder="VD: 35000" min={1}
                      className="w-full border border-rose-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-rose-500 transition" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-rose-600 uppercase tracking-wider">Chọn SP trong bundle ({formBundleProductIds.length} đã chọn)</label>
                    <input type="text" value={productSearch} onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Tìm sản phẩm..."
                      className="w-full border border-rose-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-rose-500 transition" />
                    <div className="max-h-32 overflow-y-auto space-y-0.5 mt-1">
                      {filteredProducts.map((p) => (
                        <label key={p.id} className="flex items-center gap-2 cursor-pointer hover:bg-white px-2 py-1.5 rounded-lg transition">
                          <input type="checkbox" checked={formBundleProductIds.includes(p.id)} onChange={() => toggleBundleId(p.id)}
                            className="rounded border-slate-300 text-rose-600 focus:ring-rose-500/20" />
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-semibold text-slate-700 truncate block">{p.name}</span>
                            <span className="text-[10px] text-slate-400 font-bold">{money(p.sell_price)}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  {formBundleProductIds.length >= 2 && (
                    <div className="bg-white/80 rounded-lg p-2 border border-rose-200/50">
                      <p className="text-[10px] font-bold text-rose-600 flex items-center gap-1">
                        <FiLink className="w-3 h-3 flex-shrink-0" /> {formBundleProductIds.length} SP cùng nhau = <span className="font-black">{formDiscountValue ? money(formDiscountValue) : '___'}</span>
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Min Order */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Đơn hàng tối thiểu (đ)</label>
                <input type="number" value={formMinOrder || ''} onChange={(e) => setFormMinOrder(Number(e.target.value))}
                  placeholder="0 = không yêu cầu" min={0}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-blue-500 transition" />
              </div>

              {/* Apply To (skip for bundle) */}
              {formDiscountType !== 'bundle' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Phạm vi áp dụng</label>
                  <div className="flex gap-2">
                    {([
                      { value: 'all' as const, label: 'Toàn đơn hàng', Icon: HiOutlineShoppingCart },
                      { value: 'category' as const, label: 'Theo danh mục', Icon: HiOutlineFolder },
                      { value: 'product' as const, label: 'Theo sản phẩm', Icon: HiOutlineCube },
                    ]).map((opt) => (
                      <button key={opt.value} type="button" onClick={() => { setFormApplyTo(opt.value); setFormApplyToIds([]); }}
                        className={`flex-1 flex items-center gap-1.5 justify-center py-2 rounded-xl text-[10px] font-black border transition ${
                          formApplyTo === opt.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}>
                        <opt.Icon className="w-3.5 h-3.5" />{opt.label}
                      </button>
                    ))}
                  </div>

                  {formApplyTo === 'category' && (
                    <div className="border border-slate-200 rounded-xl p-3 max-h-36 overflow-y-auto space-y-1 bg-slate-50/50">
                      {categories.length === 0 ? <p className="text-[10px] text-slate-400 text-center py-2">Chưa có danh mục nào</p> :
                        categories.map((cat) => (
                          <label key={cat.id} className="flex items-center gap-2 cursor-pointer hover:bg-white px-2 py-1.5 rounded-lg transition">
                            <input type="checkbox" checked={formApplyToIds.includes(cat.id)} onChange={() => toggleApplyId(cat.id)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20" />
                            <span className="text-xs font-semibold text-slate-700">{cat.name}</span>
                          </label>
                        ))
                      }
                    </div>
                  )}

                  {formApplyTo === 'product' && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
                      <div className="px-3 py-2 border-b border-slate-200">
                        <input type="text" value={productSearch} onChange={(e) => setProductSearch(e.target.value)}
                          placeholder="Tìm sản phẩm..." className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-blue-500 transition" />
                        {formApplyToIds.length > 0 && <p className="text-[10px] font-bold text-blue-600 mt-1">Đã chọn {formApplyToIds.length} sản phẩm</p>}
                      </div>
                      <div className="max-h-36 overflow-y-auto p-2 space-y-0.5">
                        {filteredProducts.map((p) => (
                          <label key={p.id} className="flex items-center gap-2 cursor-pointer hover:bg-white px-2 py-1.5 rounded-lg transition">
                            <input type="checkbox" checked={formApplyToIds.includes(p.id)} onChange={() => toggleApplyId(p.id)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20" />
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-slate-700 truncate block">{p.name}</span>
                              <span className="text-[10px] text-slate-400 font-bold">{p.sku}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Ngày bắt đầu</label>
                  <input type="datetime-local" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-blue-500 transition" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Ngày kết thúc</label>
                  <input type="datetime-local" value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-blue-500 transition" />
                  <p className="text-[9px] text-slate-400">Bỏ trống → vô thời hạn</p>
                </div>
              </div>

              {/* Usage Limit + Active */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Giới hạn lượt</label>
                  <input type="number" value={formUsageLimit} onChange={(e) => setFormUsageLimit(e.target.value ? Number(e.target.value) : '')}
                    placeholder="Không giới hạn" min={1}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-blue-500 transition" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Trạng thái</label>
                  <button type="button" onClick={() => setFormIsActive(!formIsActive)}
                    className={`w-full border rounded-xl px-3 py-2 text-xs font-extrabold transition flex items-center justify-center gap-2 ${
                      formIsActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'
                    }`}>
                    {formIsActive ? <HiOutlineCheck className="w-4 h-4" /> : <HiOutlineX className="w-4 h-4" />}
                    {formIsActive ? 'Đang kích hoạt' : 'Đã tắt'}
                  </button>
                </div>
              </div>
            </form>

            {/* Footer */}
            <div className="flex gap-2 px-6 py-4 border-t border-slate-100">
              <button type="button" onClick={() => { setShowModal(false); resetForm(); }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-extrabold text-slate-700 hover:bg-slate-50 transition">
                Hủy bỏ
              </button>
              <button onClick={handleSubmit} disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-extrabold hover:bg-blue-700 transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed">
                {saving ? 'Đang lưu...' : editId ? 'Cập nhật' : 'Tạo khuyến mãi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PromotionsTab;
