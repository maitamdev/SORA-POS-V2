import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  HiOutlineShoppingCart,
  HiOutlineSearch,
  HiOutlineLocationMarker,
  HiOutlineBell,
  HiOutlineDocumentText,
  HiOutlineUser,
  HiOutlineCalendar,
  HiOutlineHome,
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlineCreditCard,
  HiOutlinePrinter,
  HiOutlineXCircle,
  HiOutlineBookmark,
  HiOutlineCheck,
  HiOutlineMenu,
  HiOutlineTag,
} from 'react-icons/hi';
import { catalogAPI } from '../../services/catalog.api';
import { orderAPI } from '../../services/order.api';
import { Category, Customer, Product } from '../../types/domain.type';

interface CartItem {
  product: Product;
  quantity: number;
}

interface HeldOrder {
  id: string;
  cart: CartItem[];
  customerId: string;
  customerName: string;
  date: string;
  total: number;
}

const money = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;

// Custom Barcode icon svg
const BarcodeIcon = () => (
  <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h2M7 5h1M10 5h3M15 5h1M18 5h3M3 10h1M6 10h2M10 10h2M14 10h3M19 10h2M3 15h3M8 15h1M11 15h2M15 15h2M19 15h2M3 20h2M7 20h2M11 20h1M14 20h3M19 20h2" />
  </svg>
);

const getProductImage = (product: Product) => {
  if (product.image_url) return product.image_url;
  
  const nameLower = product.name.toLowerCase();
  if (nameLower.includes('coca') || nameLower.includes('pepsi') || nameLower.includes('nước ngọt')) {
    return 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=200';
  }
  if (nameLower.includes('nước suối') || nameLower.includes('aquafina')) {
    return 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&q=80&w=200';
  }
  if (nameLower.includes('lay') || nameLower.includes('khoai tây') || nameLower.includes('bánh')) {
    return 'https://images.unsplash.com/photo-1599490659213-e2b9527b0876?auto=format&fit=crop&q=80&w=200';
  }
  if (nameLower.includes('sữa') || nameLower.includes('vinamilk')) {
    return 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&q=80&w=200';
  }
  if (nameLower.includes('mì hảo hảo') || nameLower.includes('mì')) {
    return 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&q=80&w=200';
  }
  if (nameLower.includes('oreo')) {
    return 'https://images.unsplash.com/photo-1558961359-fa397c41f0a5?auto=format&fit=crop&q=80&w=200';
  }
  if (nameLower.includes('cafe') || nameLower.includes('nescafé')) {
    return 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&q=80&w=200';
  }
  return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=200';
};

const POSPage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Filtering & Sorting
  const [search, setSearch] = useState('');
  const [barcodeSearch, setBarcodeSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [sortBy, setSortBy] = useState('default');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Checkout details
  const [customerId, setCustomerId] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'value'>('value');
  const [discountValue, setDiscountValue] = useState(0);
  const [notes, setNotes] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'card'>('cash');
  const [receivedAmount, setReceivedAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });

  // Fast header details
  const [draftOrderNote, setDraftOrderNote] = useState('');
  const [draftNoteDisplay, setDraftNoteDisplay] = useState('');

  // Held Orders & Modals
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);
  const [showHeldOrdersModal, setShowHeldOrdersModal] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');

  // Draft Order number generated based on date
  const draftOrderNumber = useMemo(() => {
    const date = new Date();
    const y = String(date.getFullYear()).slice(-2);
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `POS${y}${m}${d}-0012`;
  }, []);

  const loadData = async () => {
    const params: Record<string, unknown> = {
      search,
      is_active: true,
      limit: 20,
      page,
    };
    if (selectedCategoryId !== 'all') {
      params.category_id = selectedCategoryId;
    }

    const [productRes, categoryRes, customerRes] = await Promise.all([
      catalogAPI.products.list(params),
      catalogAPI.categories.list({ is_active: true, limit: 100 }),
      catalogAPI.customers.list({ is_active: true, limit: 100 }),
    ]);

    setProducts(productRes.data.data.items);
    setPagination(productRes.data.data.pagination);
    setCategories(categoryRes.data.data.items);
    setCustomers(customerRes.data.data.items);
  };

  useEffect(() => {
    loadData().catch(() => toast.error('Không tải được dữ liệu POS'));
  }, [page, selectedCategoryId, search]);

  // Load held orders from local storage on mount
  useEffect(() => {
    const stored = localStorage.getItem('sora_pos_held_orders');
    if (stored) {
      try {
        setHeldOrders(JSON.parse(stored));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Sync phone number when customer selection changes
  useEffect(() => {
    if (!customerId) {
      setCustomerPhone('');
      return;
    }
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      setCustomerPhone(customer.phone || '');
    }
  }, [customerId, customers]);

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.product.sell_price) * item.quantity, 0),
    [cart]
  );

  const discountAmount = useMemo(() => {
    if (discountType === 'percent') {
      return Math.floor((total * discountValue) / 100);
    }
    return discountValue;
  }, [total, discountType, discountValue]);

  const finalAmount = useMemo(() => Math.max(total - discountAmount, 0), [total, discountAmount]);

  const changeAmount = useMemo(() => {
    if (paymentMethod !== 'cash') return 0;
    return Math.max(receivedAmount - finalAmount, 0);
  }, [receivedAmount, finalAmount, paymentMethod]);

  const sortedProducts = useMemo(() => {
    const items = [...products];
    if (sortBy === 'price-asc') {
      items.sort((a, b) => Number(a.sell_price) - Number(b.sell_price));
    } else if (sortBy === 'price-desc') {
      items.sort((a, b) => Number(b.sell_price) - Number(a.sell_price));
    } else if (sortBy === 'name-asc') {
      items.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    } else if (sortBy === 'name-desc') {
      items.sort((a, b) => b.name.localeCompare(a.name, 'vi'));
    }
    return items;
  }, [products, sortBy]);

  // Barcode search submission
  const handleBarcodeSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!barcodeSearch.trim()) return;

    const query = barcodeSearch.trim();
    // Look locally first
    const found = products.find(p => p.barcode === query || p.sku === query);
    if (found) {
      addToCart(found);
      toast.success(`Đã thêm ${found.name} vào giỏ hàng`);
      setBarcodeSearch('');
    } else {
      // Find in database via API
      catalogAPI.products.list({ search: query, limit: 1 }).then(res => {
        const match = res.data.data.items[0];
        if (match && (match.barcode === query || match.sku === query)) {
          addToCart(match);
          toast.success(`Đã thêm ${match.name} vào giỏ hàng`);
        } else {
          toast.error(`Không tìm thấy sản phẩm có mã/SKU: ${query}`);
        }
        setBarcodeSearch('');
      }).catch(() => {
        toast.error('Lỗi khi quét mã vạch');
        setBarcodeSearch('');
      });
    }
  };

  // Stepper cart modifications
  const addToCart = (product: Product) => {
    if (Number(product.stock_quantity) <= 0) {
      toast.error('Sản phẩm đã hết hàng');
      return;
    }
    setCart((items) => {
      const existing = items.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= Number(product.stock_quantity)) {
          toast.error('Không đủ tồn kho');
          return items;
        }
        return items.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...items, { product, quantity: 1 }];
    });
  };

  const updateQty = (productId: string, quantity: number) => {
    setCart((items) =>
      items
        .map((item) => {
          if (item.product.id !== productId) return item;
          const nextQuantity = Math.max(0, Math.min(quantity, Number(item.product.stock_quantity)));
          return { ...item, quantity: nextQuantity };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  // Keyboard hotkey implementation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F2') {
        event.preventDefault();
        document.getElementById('barcode-search-input')?.focus();
      } else if (event.key === 'F3') {
        event.preventDefault();
        document.getElementById('product-search-input')?.focus();
      } else if (event.key === 'F6') {
        event.preventDefault();
        handleHoldOrder();
      } else if (event.key === 'F7') {
        event.preventDefault();
        handleClearCart();
      } else if (event.key === 'F8') {
        event.preventDefault();
        handlePrintInvoice();
      } else if (event.key === 'F9') {
        event.preventDefault();
        checkout();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, customerId, discountAmount, finalAmount, paymentMethod, receivedAmount, notes]);

  // Order Operations
  const handleClearCart = () => {
    if (cart.length === 0) return;
    if (window.confirm('Bạn có chắc muốn xóa toàn bộ giỏ hàng?')) {
      setCart([]);
      setReceivedAmount(0);
      setDiscountValue(0);
      setNotes('');
      setVoucherCode('');
      toast.success('Đã xóa giỏ hàng');
    }
  };

  const handleHoldOrder = () => {
    if (cart.length === 0) {
      setShowHeldOrdersModal(true); // Open manager if cart empty
      return;
    }
    
    const customerObj = customers.find(c => c.id === customerId);
    const newHeld: HeldOrder = {
      id: `HELD-${Date.now()}`,
      cart,
      customerId,
      customerName: customerObj?.name || 'Khách lẻ',
      date: new Date().toLocaleTimeString('vi-VN') + ' ' + new Date().toLocaleDateString('vi-VN'),
      total: finalAmount
    };

    const updated = [newHeld, ...heldOrders];
    setHeldOrders(updated);
    localStorage.setItem('sora_pos_held_orders', JSON.stringify(updated));
    setCart([]);
    setReceivedAmount(0);
    setDiscountValue(0);
    setNotes('');
    setVoucherCode('');
    toast.success('Đã tạm giữ đơn hàng thành công!');
  };

  const handleRestoreOrder = (heldId: string) => {
    const order = heldOrders.find(o => o.id === heldId);
    if (order) {
      setCart(order.cart);
      setCustomerId(order.customerId);
      const updated = heldOrders.filter(o => o.id !== heldId);
      setHeldOrders(updated);
      localStorage.setItem('sora_pos_held_orders', JSON.stringify(updated));
      setShowHeldOrdersModal(false);
      toast.success('Đã khôi phục đơn hàng');
    }
  };

  const handleRemoveHeldOrder = (heldId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Bạn có chắc muốn xóa đơn lưu này?')) {
      const updated = heldOrders.filter(o => o.id !== heldId);
      setHeldOrders(updated);
      localStorage.setItem('sora_pos_held_orders', JSON.stringify(updated));
      toast.success('Đã xóa đơn lưu');
    }
  };

  const handlePrintInvoice = () => {
    if (cart.length === 0) {
      toast.error('Giỏ hàng đang trống!');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Vui lòng cho phép mở popup trên trình duyệt để in hóa đơn.');
      return;
    }

    const customerObj = customers.find(c => c.id === customerId);
    const customerName = customerObj?.name || 'Khách lẻ';
    const customerPhoneStr = customerPhone || customerObj?.phone || 'Trống';

    const cartRowsHtml = cart.map(item => `
      <tr>
        <td style="padding: 6px 0; font-size: 13px;">${item.product.name}<br/><span style="font-size: 10px; color:#555;">${item.product.sku}</span></td>
        <td style="text-align: center; padding: 6px 0; font-size: 13px;">${item.quantity}</td>
        <td style="text-align: right; padding: 6px 0; font-size: 13px;">${money(item.product.sell_price)}</td>
        <td style="text-align: right; padding: 6px 0; font-size: 13px; font-weight: bold;">${money(Number(item.product.sell_price) * item.quantity)}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Hóa đơn bán lẻ - SORA POS</title>
          <style>
            body { font-family: 'Courier New', monospace; padding: 15px; color: #000; line-height: 1.4; max-width: 320px; margin: 0 auto; }
            .center { text-align: center; }
            .title { font-size: 18px; font-weight: bold; margin: 0; }
            .subtitle { font-size: 11px; margin: 3px 0; color: #333; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th { border-bottom: 1px dashed #000; padding: 5px 0; font-size: 12px; text-align: left; }
            td { border-bottom: 1px dotted #ccc; }
            .row { display: flex; justify-content: space-between; font-size: 13px; margin: 4px 0; }
            .bold { font-weight: bold; }
            .total-row { font-size: 15px; border-top: 1px dashed #000; padding-top: 8px; margin-top: 8px; }
            .footer { font-size: 11px; margin-top: 25px; text-align: center; color: #555; }
          </style>
        </head>
        <body>
          <div class="center">
            <h2 class="title">SORA MART</h2>
            <p class="subtitle">SORA Mart - Chi nhánh 1</p>
            <p class="subtitle">Đ/C: Toà nhà Sora, Quận 1, TP. HCM</p>
            <p class="subtitle">SĐT: 1900 6868</p>
          </div>
          <hr style="border: none; border-top: 1px dashed #000; margin: 10px 0;" />
          <div style="font-size: 12px;">
            <div><b>Mã HĐ:</b> ${draftOrderNumber}</div>
            <div><b>Ngày:</b> ${new Date().toLocaleString('vi-VN')}</div>
            <div><b>Khách hàng:</b> ${customerName} (${customerPhoneStr})</div>
            <div><b>Thu ngân:</b> Admin</div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 45%;">Tên SP</th>
                <th style="width: 15%; text-align: center;">SL</th>
                <th style="width: 20%; text-align: right;">Đơn giá</th>
                <th style="width: 20%; text-align: right;">T.Tiền</th>
              </tr>
            </thead>
            <tbody>
              ${cartRowsHtml}
            </tbody>
          </table>
          <div class="row">
            <span>Tạm tính:</span>
            <span>${money(total)}</span>
          </div>
          ${discountAmount > 0 ? `
            <div class="row">
              <span>Chiết khấu:</span>
              <span>-${money(discountAmount)}</span>
            </div>
          ` : ''}
          <div class="row bold total-row">
            <span>Thành tiền:</span>
            <span>${money(finalAmount)}</span>
          </div>
          <div class="row">
            <span>Phương thức:</span>
            <span>${paymentMethod === 'cash' ? 'Tiền mặt' : paymentMethod === 'transfer' ? 'Chuyển khoản QR' : 'Thẻ ngân hàng'}</span>
          </div>
          ${paymentMethod === 'cash' ? `
            <div class="row">
              <span>Khách đưa:</span>
              <span>${money(receivedAmount || finalAmount)}</span>
            </div>
            <div class="row">
              <span>Tiền thừa:</span>
              <span>${money(Math.max((receivedAmount || finalAmount) - finalAmount, 0))}</span>
            </div>
          ` : ''}
          <div class="footer">
            <p>Cảm ơn quý khách đã mua sắm!</p>
            <p>Hẹn gặp lại quý khách!</p>
            <p style="font-size: 9px; color: #999;">Powered by Sora POS</p>
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const checkout = async () => {
    if (cart.length === 0) {
      toast.error('Giỏ hàng đang trống');
      return;
    }

    setLoading(true);
    try {
      const response = await orderAPI.create({
        customer_id: customerId || null,
        discount_amount: discountAmount,
        note: notes || null,
        payment: {
          method: paymentMethod,
          received_amount: paymentMethod === 'cash' ? (receivedAmount || finalAmount) : finalAmount,
        },
        items: cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
        })),
      });

      toast.success(`Đã thanh toán hóa đơn ${response.data.data.order_number} thành công!`);
      setCart([]);
      setReceivedAmount(0);
      setDiscountValue(0);
      setNotes('');
      setVoucherCode('');
      setDraftNoteDisplay('');
      setDraftOrderNote('');
      await loadData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Thanh toán thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) {
      toast.error('Vui lòng nhập tên khách hàng');
      return;
    }
    try {
      const res = await catalogAPI.customers.create({
        name: newCustName.trim(),
        phone: newCustPhone.trim() || null,
        is_active: true,
      });
      const created = res.data.data;
      setCustomers(prev => [created, ...prev]);
      setCustomerId(created.id);
      setShowAddCustomerModal(false);
      setNewCustName('');
      setNewCustPhone('');
      toast.success(`Đã thêm khách hàng ${created.name}`);
    } catch (err) {
      toast.error('Lỗi khi thêm khách hàng');
    }
  };

  // Add order details note from quick draft top cards
  const handleAddDraftNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (draftOrderNote.trim()) {
      setDraftNoteDisplay(draftOrderNote.trim());
      setNotes(prev => prev ? `${prev}\n[Ghi chú đơn: ${draftOrderNote.trim()}]` : `[Ghi chú đơn: ${draftOrderNote.trim()}]`);
      setDraftOrderNote('');
      toast.success('Đã thêm ghi chú vào đơn');
    }
  };

  // Calculate items bounds for pagination display
  const itemsStart = (pagination.page - 1) * pagination.limit + 1;
  const itemsEnd = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans antialiased text-slate-800">
      
      {/* 1. TOP HEADER SECTION */}
      <header className="h-auto min-h-[4rem] flex flex-wrap items-center justify-between gap-2 px-3 sm:px-6 py-2 bg-white border-b border-slate-100 flex-shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <HiOutlineShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-slate-800 uppercase leading-none">Bán hàng POS</h1>
            <p className="text-[10px] text-slate-400 font-bold tracking-wide mt-0.5">Realtime Billing Screen</p>
          </div>
        </div>

        {/* Header Search Bars */}
        <div className="hidden md:flex items-center gap-3">
          {/* F3 Product Search */}
          <div className="relative">
            <HiOutlineSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              id="product-search-input"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Tìm sản phẩm (F3)"
              className="w-60 lg:w-80 pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 bg-slate-50 transition"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600">✕</button>
            )}
          </div>

          {/* F2 Barcode Scanner Input */}
          <form onSubmit={handleBarcodeSubmit} className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
              <BarcodeIcon />
            </div>
            <input
              id="barcode-search-input"
              value={barcodeSearch}
              onChange={(e) => setBarcodeSearch(e.target.value)}
              placeholder="Quét mã vạch (F2)"
              className="w-48 lg:w-56 pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 bg-slate-50 transition"
            />
            <button type="submit" className="hidden">Submit</button>
          </form>
        </div>

        {/* Right Info Widgets */}
        <div className="hidden sm:flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-700">
            <HiOutlineLocationMarker className="w-4 h-4 text-blue-500" />
            <span>SORA Mart - Chi nhánh 1</span>
          </div>

          {/* Notification bell */}
          <button className="relative w-9 h-9 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center text-slate-600 transition">
            <HiOutlineBell className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 border border-white rounded-full text-[9px] font-black text-white flex items-center justify-center">5</span>
          </button>

          {/* User profile */}
          <div className="flex items-center gap-2 pl-3 border-l border-slate-100">
            <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shadow-sm">
              AD
            </div>
            <div className="hidden md:block leading-tight">
              <p className="text-xs font-black text-slate-800">Admin</p>
              <p className="text-[10px] font-bold text-slate-400">Quản trị viên</p>
            </div>
          </div>
        </div>
      </header>

      {/* 2. MAIN LAYOUT CONTAINER */}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-[1fr_420px] overflow-hidden h-[calc(100vh-64px)]">
        
        {/* LEFT CATALOG PANEL */}
        <section className="flex flex-col h-full overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 bg-slate-50/50">
          
          {/* Card Info Indicators */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
            {/* Order Code */}
            <div className="bg-white border border-slate-200/60 p-2.5 rounded-xl flex items-center gap-2.5 shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-blue-55 text-blue-600 flex items-center justify-center flex-shrink-0 bg-blue-50">
                <HiOutlineDocumentText className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0 leading-tight">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Mã đơn hàng</p>
                <p className="text-xs font-black text-slate-800 truncate mt-0.5">{draftOrderNumber}</p>
              </div>
            </div>

            {/* Customer */}
            <div className="bg-white border border-slate-200/60 p-2.5 rounded-xl flex items-center gap-2.5 shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                <HiOutlineUser className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0 leading-tight">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Khách hàng</p>
                <p className="text-xs font-black text-slate-800 truncate mt-0.5">
                  {customers.find(c => c.id === customerId)?.name || 'Khách lẻ'}
                </p>
              </div>
            </div>

            {/* Price list */}
            <div className="bg-white border border-slate-200/60 p-2.5 rounded-xl flex items-center gap-2.5 shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                <HiOutlineCalendar className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0 leading-tight">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Bảng giá</p>
                <p className="text-xs font-black text-slate-800 truncate mt-0.5">Bảng giá mặc định</p>
              </div>
            </div>

            {/* Kênh bán */}
            <div className="bg-white border border-slate-200/60 p-2.5 rounded-xl flex items-center gap-2.5 shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
                <HiOutlineHome className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0 leading-tight">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Kênh bán</p>
                <p className="text-xs font-black text-slate-800 truncate mt-0.5">Tại cửa hàng</p>
              </div>
            </div>

            {/* Ghi chú đơn */}
            <form onSubmit={handleAddDraftNote} className="bg-white border border-slate-200/60 p-1.5 rounded-xl flex items-center gap-1 shadow-sm">
              <input
                value={draftOrderNote}
                onChange={(e) => setDraftOrderNote(e.target.value)}
                placeholder={draftNoteDisplay || "Ghi chú đơn"}
                className="flex-1 w-full bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 text-xs font-semibold outline-none focus:border-blue-300"
              />
              <button type="submit" className="w-7 h-7 bg-blue-600 text-white font-bold rounded-lg flex items-center justify-center hover:bg-blue-700">+</button>
            </form>
          </div>

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

          {/* Subfilters Row (Mag glass + supplier + sort + view toggle) */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3 rounded-xl border border-slate-200/60 shadow-sm">
            <div className="relative w-full sm:w-72">
              <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Tìm kiếm sản phẩm (F3)..."
                className="w-full pl-9 pr-4 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-blue-500 transition"
              />
            </div>

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

              {/* View switches */}
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

          {/* Product Grid Catalog */}
          <div className="flex-1 overflow-y-auto min-h-0 pr-1">
            {products.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 bg-white rounded-2xl border border-dashed border-slate-350 p-10 text-center text-slate-400">
                <HiOutlineShoppingCart className="w-12 h-12 text-slate-300 mb-2" />
                <p className="font-extrabold text-slate-500">Chưa có sản phẩm nào được hiển thị</p>
                <p className="text-xs text-slate-400 mt-1">Vui lòng điều chỉnh lại bộ lọc tìm kiếm sản phẩm.</p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {sortedProducts.map((product) => {
                  const isLowStock = product.stock_quantity <= product.min_stock_level;
                  const isOutOfStock = product.stock_quantity <= 0;
                  return (
                    <div
                      key={product.id}
                      className="bg-white border border-slate-200/60 rounded-xl p-3 flex flex-col justify-between hover:shadow-md hover:border-blue-400 transition relative overflow-hidden group"
                    >
                      {/* Stock badge label */}
                      <span className={`absolute top-2.5 right-2.5 px-2 py-0.5 text-[9px] font-black rounded-full border ${
                        isOutOfStock
                          ? 'bg-red-100 text-red-700 border-red-200'
                          : isLowStock
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        Tồn: {product.stock_quantity} {isLowStock && !isOutOfStock && '⚠️'} {isOutOfStock && 'Hết'}
                      </span>

                      {/* Product Thumbnail image */}
                      <div className="h-28 flex items-center justify-center mb-2 bg-slate-50/50 rounded-lg p-2 overflow-hidden flex-shrink-0">
                        <img
                          src={getProductImage(product)}
                          alt={product.name}
                          className="max-h-full max-w-full object-contain group-hover:scale-105 transition duration-300"
                          loading="lazy"
                        />
                      </div>

                      {/* Details */}
                      <div className="flex-1 flex flex-col">
                        <h3 className="text-xs font-black text-slate-800 line-clamp-2 mt-1 min-h-[32px]">
                          {product.name}
                        </h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 tracking-wider">
                          {product.sku}
                        </p>
                      </div>

                      <div className="mt-3">
                        <span className="text-sm font-black text-blue-600 block">{money(product.sell_price)}</span>
                        
                        <button
                          onClick={() => addToCart(product)}
                          disabled={!product.is_active || isOutOfStock}
                          className="w-full mt-2.5 flex items-center justify-center gap-1 py-1.5 border border-blue-600 text-blue-600 text-[11px] font-black rounded-lg hover:bg-blue-600 hover:text-white transition disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-blue-600"
                        >
                          <HiOutlinePlus className="w-3.5 h-3.5" />
                          <span>Thêm (F4)</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              // List View Mode
              <div className="space-y-2 bg-white rounded-xl border border-slate-200/60 overflow-hidden divide-y divide-slate-100 shadow-sm">
                {sortedProducts.map((product) => {
                  const isLowStock = product.stock_quantity <= product.min_stock_level;
                  const isOutOfStock = product.stock_quantity <= 0;
                  return (
                    <div key={product.id} className="p-3 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition">
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
                          onClick={() => addToCart(product)}
                          disabled={!product.is_active || isOutOfStock}
                          className="p-1 px-3 border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
                        >
                          + Thêm
                        </button>
                      </div>
                    </div>
                  );
                })}
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
                onClick={() => setPage(p => Math.max(1, p - 1))}
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
                onClick={() => setPage(p => Math.min(Math.ceil(pagination.total / pagination.limit), p + 1))}
                disabled={page >= Math.ceil(pagination.total / pagination.limit)}
                className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition"
              >
                ›
              </button>
            </div>
          </footer>
        </section>

        {/* RIGHT CHECKOUT SIDEBAR PANEL */}
        <aside className="flex flex-col h-full bg-white border-l border-slate-200/60 shadow-lg">
          
          {/* Cart Header Section */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
            <h2 className="text-sm font-black text-slate-800 flex items-center gap-1.5 uppercase">
              <HiOutlineShoppingCart className="w-5 h-5 text-blue-600" />
              <span>Giỏ hàng ({cart.reduce((s, i) => s + i.quantity, 0)})</span>
            </h2>
            {cart.length > 0 && (
              <button
                onClick={handleClearCart}
                className="flex items-center gap-1 text-[11px] font-bold text-red-500 hover:text-red-750 transition"
              >
                <HiOutlineTrash className="w-4 h-4" />
                <span>Xóa giỏ hàng</span>
              </button>
            )}
          </div>

          {/* Cart Items List Area */}
          <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100 min-h-0 bg-slate-50/20">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center text-slate-400 py-10">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-350 mb-2">
                  📭
                </div>
                <p className="text-xs font-black text-slate-500 uppercase">Giỏ hàng trống</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Chọn sản phẩm bên trái hoặc quét mã vạch.</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.product.id} className="py-3 flex items-start justify-between gap-3 group">
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Thumbnail */}
                    <img
                      src={getProductImage(item.product)}
                      alt={item.product.name}
                      className="w-11 h-11 rounded-lg border border-slate-200/60 object-contain flex-shrink-0 bg-white p-0.5"
                    />
                    
                    <div className="min-w-0 leading-tight">
                      <p className="text-xs font-black text-slate-800 truncate" title={item.product.name}>
                        {item.product.name}
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{item.product.sku}</p>
                      
                      {/* Quantity control steppers */}
                      <div className="flex items-center gap-1 mt-2">
                        <button
                          onClick={() => updateQty(item.product.id, item.quantity - 1)}
                          className="w-5.5 h-5.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-extrabold"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateQty(item.product.id, Number(e.target.value))}
                          className="w-10 h-5.5 border border-slate-200 text-center text-xs font-black text-slate-800 outline-none rounded"
                        />
                        <button
                          onClick={() => updateQty(item.product.id, item.quantity + 1)}
                          className="w-5.5 h-5.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-extrabold"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className="text-xs font-black text-slate-800">
                      {money(Number(item.product.sell_price) * item.quantity)}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      {money(item.product.sell_price)}
                    </span>
                    <button
                      onClick={() => updateQty(item.product.id, 0)}
                      className="text-xs font-bold text-slate-350 hover:text-red-500 opacity-0 group-hover:opacity-100 transition duration-150 self-end mt-1"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Customer & Notes Panel */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-3 flex-shrink-0">
            {/* Customer & Phone Selector Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Khách hàng</label>
                <div className="flex items-center gap-1.5">
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="flex-1 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 outline-none"
                  >
                    <option value="">Khách lẻ</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setShowAddCustomerModal(true)}
                    className="w-7 h-7 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg flex items-center justify-center hover:bg-blue-100 transition flex-shrink-0"
                  >
                    <HiOutlinePlus className="w-4.5 h-4.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Số điện thoại</label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Nhập số điện thoại"
                  className="w-full bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 outline-none"
                />
              </div>
            </div>

            {/* Discount and Voucher Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Chiết khấu đơn</label>
                <div className="flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden w-full">
                  <input
                    type="number"
                    value={discountValue || ''}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                    placeholder="0"
                    className="flex-1 w-full px-2.5 py-1.5 text-xs font-semibold outline-none"
                  />
                  <button
                    onClick={() => {
                      setDiscountType(discountType === 'percent' ? 'value' : 'percent');
                      setDiscountValue(0);
                    }}
                    className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 border-l border-slate-200 text-xs font-black text-slate-600 transition"
                  >
                    {discountType === 'percent' ? '%' : 'đ'}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Mã giảm giá (Voucher)</label>
                <div className="flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden w-full px-2">
                  <HiOutlineTag className="text-slate-400 w-4 h-4 flex-shrink-0" />
                  <input
                    type="text"
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value)}
                    placeholder="Chọn hoặc nhập mã"
                    className="flex-1 w-full px-1.5 py-1.5 text-xs font-semibold outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Note Area */}
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Ghi chú đơn hàng</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, 200))}
                placeholder="Nhập ghi chú hóa đơn (nếu có)..."
                className="w-full bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 outline-none h-14 resize-none"
              />
              <span className="text-[9px] font-bold text-slate-400 float-right mt-0.5">{notes.length}/200</span>
            </div>
          </div>

          {/* Pricing calculations & checkout actions */}
          <div className="p-4 bg-white border-t border-slate-100 space-y-4 flex-shrink-0">
            {/* Calculation details */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                <span>Tạm tính</span>
                <span>{money(total)}</span>
              </div>
              
              {discountAmount > 0 && (
                <div className="flex justify-between items-center text-xs font-bold text-red-500">
                  <span>Chiết khấu</span>
                  <span>-{money(discountAmount)}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                <span>Tổng tiền hàng</span>
                <span>{money(total)}</span>
              </div>

              <div className="flex justify-between items-center border-t border-slate-100 pt-2 text-sm font-extrabold text-slate-800">
                <span>Thành tiền</span>
                <span className="text-xl font-black text-blue-600">{money(finalAmount)}</span>
              </div>
            </div>

            {/* Payment Method Selector Tab Row */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Phương thức thanh toán</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    setPaymentMethod('cash');
                    setReceivedAmount(0);
                  }}
                  className={`flex flex-col items-center justify-center py-2.5 rounded-xl border text-[11px] font-black gap-1.5 transition ${
                    paymentMethod === 'cash'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20'
                      : 'bg-slate-50 border-slate-200/60 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-base">💵</span>
                  <span>Tiền mặt</span>
                </button>

                <button
                  onClick={() => {
                    setPaymentMethod('transfer');
                    setReceivedAmount(finalAmount);
                  }}
                  className={`flex flex-col items-center justify-center py-2.5 rounded-xl border text-[11px] font-black gap-1.5 transition ${
                    paymentMethod === 'transfer'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20'
                      : 'bg-slate-50 border-slate-200/60 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-base">📲</span>
                  <span>Chuyển khoản QR</span>
                </button>

                <button
                  onClick={() => {
                    setPaymentMethod('card');
                    setReceivedAmount(finalAmount);
                  }}
                  className={`flex flex-col items-center justify-center py-2.5 rounded-xl border text-[11px] font-black gap-1.5 transition ${
                    paymentMethod === 'card'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20'
                      : 'bg-slate-50 border-slate-200/60 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <HiOutlineCreditCard className="w-5 h-5 text-current" />
                  <span>Thẻ</span>
                </button>
              </div>
            </div>

            {/* Cash payments extra parameters */}
            {paymentMethod === 'cash' && (
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-250 flex items-center justify-between gap-3 text-xs">
                <div className="flex-1">
                  <label className="block text-[9px] font-bold text-slate-400 uppercase">Tiền khách đưa</label>
                  <input
                    type="number"
                    value={receivedAmount || ''}
                    onChange={(e) => setReceivedAmount(Number(e.target.value))}
                    placeholder={String(finalAmount)}
                    className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-black text-slate-800 mt-0.5 outline-none focus:border-blue-400"
                  />
                </div>
                <div className="text-right">
                  <span className="block text-[9px] font-bold text-slate-400 uppercase">Tiền trả lại</span>
                  <span className="text-sm font-black text-emerald-600 block mt-0.5">{money(changeAmount)}</span>
                </div>
              </div>
            )}

            {/* CTA action buttons */}
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                {/* Hold (F6) */}
                <button
                  onClick={handleHoldOrder}
                  className="py-2.5 border border-blue-600 hover:bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-wider rounded-xl transition flex flex-col items-center justify-center gap-1"
                >
                  <HiOutlineBookmark className="w-4.5 h-4.5" />
                  <span>Giữ đơn (F6)</span>
                </button>

                {/* Cancel (F7) */}
                <button
                  onClick={handleClearCart}
                  disabled={cart.length === 0}
                  className="py-2.5 border border-red-200 hover:bg-red-50 text-red-500 text-[10px] font-black uppercase tracking-wider rounded-xl transition flex flex-col items-center justify-center gap-1 disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <HiOutlineXCircle className="w-4.5 h-4.5" />
                  <span>Hủy đơn (F7)</span>
                </button>

                {/* Print (F8) */}
                <button
                  onClick={handlePrintInvoice}
                  disabled={cart.length === 0}
                  className="py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-[10px] font-black uppercase tracking-wider rounded-xl transition flex flex-col items-center justify-center gap-1 disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <HiOutlinePrinter className="w-4.5 h-4.5" />
                  <span>In bill (F8)</span>
                </button>
              </div>

              {/* Pay Order (F9) */}
              <button
                onClick={checkout}
                disabled={loading || cart.length === 0}
                className="w-full py-3 bg-blue-600 text-white hover:bg-blue-700 text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition disabled:opacity-60 disabled:shadow-none"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Đang thanh toán...</span>
                  </>
                ) : (
                  <>
                    <HiOutlineCheck className="w-4.5 h-4.5 stroke-[3]" />
                    <span>Thanh toán (F9)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* 3. ADD NEW CUSTOMER QUICK MODAL */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Thêm nhanh khách hàng</h3>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">Khách hàng được lưu trực tiếp vào cơ sở dữ liệu.</p>
            
            <form onSubmit={handleAddCustomerSubmit} className="mt-5 space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Họ và tên *</label>
                <input
                  type="text"
                  required
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="Nhập tên khách hàng"
                  className="w-full border border-slate-205 rounded-xl px-4 py-2 text-xs font-semibold outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 bg-slate-50 transition"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Số điện thoại</label>
                <input
                  type="text"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  placeholder="Nhập số điện thoại"
                  className="w-full border border-slate-205 rounded-xl px-4 py-2 text-xs font-semibold outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 bg-slate-50 transition"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="flex-1 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-100 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-blue-600 text-white text-xs font-black rounded-xl hover:bg-blue-700 transition"
                >
                  Lưu lại
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. HELD ORDERS MANAGEMENT MODAL */}
      {showHeldOrdersModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 max-h-[80vh] flex flex-col">
            <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Danh sách hóa đơn đang tạm giữ</h3>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">Bấm vào hóa đơn để khôi phục lại giỏ hàng bán hàng.</p>
            
            <div className="mt-4 flex-1 overflow-y-auto divide-y divide-slate-100 pr-1">
              {heldOrders.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs font-bold uppercase">
                  Chưa có hóa đơn nào đang tạm giữ
                </div>
              ) : (
                heldOrders.map((ord) => (
                  <div
                    key={ord.id}
                    onClick={() => handleRestoreOrder(ord.id)}
                    className="py-3.5 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 rounded-xl px-2 transition"
                  >
                    <div className="min-w-0 leading-tight">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-800">{ord.id}</span>
                        <span className="text-[10px] font-bold text-slate-400">({ord.date})</span>
                      </div>
                      <p className="text-xs font-bold text-slate-500 mt-1">
                        Khách hàng: <span className="text-slate-800">{ord.customerName}</span> | {ord.cart.reduce((s, i) => s + i.quantity, 0)} sản phẩm
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs font-black text-blue-600">{money(ord.total)}</span>
                      <button
                        onClick={(e) => handleRemoveHeldOrder(ord.id, e)}
                        className="p-1 text-slate-350 hover:text-red-500 transition rounded"
                      >
                        <HiOutlineTrash className="w-4.5 h-4.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 mt-4 flex justify-end">
              <button
                onClick={() => setShowHeldOrdersModal(false)}
                className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POSPage;
