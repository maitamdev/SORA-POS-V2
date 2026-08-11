import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FiArrowLeft,
  FiCheck,
  FiChevronRight,
  FiClock,
  FiFileText,
  FiInbox,
  FiPackage,
  FiPlus,
  FiRefreshCw,
  FiTruck,
  FiX,
} from 'react-icons/fi';
import { catalogAPI } from '../../services/catalog.api';
import { purchaseOrderAPI } from '../../services/purchaseOrder.api';
import {
  Product,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus,
  Supplier,
} from '../../types/domain.type';

const formatCurrency = (value: number) => new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
}).format(Number(value || 0));

const formatDate = (value?: string | null) => value
  ? new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  : '—';

const statusMeta: Record<PurchaseOrderStatus, { label: string; tone: string }> = {
  draft: { label: 'Bản nháp', tone: 'border-slate-300 bg-slate-50 text-slate-600' },
  pending: { label: 'Chờ duyệt', tone: 'border-amber-300 bg-amber-50 text-amber-700' },
  approved: { label: 'Đã duyệt', tone: 'border-blue-300 bg-blue-50 text-blue-700' },
  ordered: { label: 'Đã đặt hàng', tone: 'border-indigo-300 bg-indigo-50 text-indigo-700' },
  in_transit: { label: 'Đang về', tone: 'border-violet-300 bg-violet-50 text-violet-700' },
  partially_received: { label: 'Nhận một phần', tone: 'border-orange-300 bg-orange-50 text-orange-700' },
  received: { label: 'Đã nhận đủ', tone: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
  cancelled: { label: 'Đã huỷ', tone: 'border-rose-300 bg-rose-50 text-rose-700' },
};

const statusFilters: Array<{ value: 'all' | PurchaseOrderStatus; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'draft', label: 'Bản nháp' },
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'ordered', label: 'Đã đặt' },
  { value: 'in_transit', label: 'Đang về' },
  { value: 'partially_received', label: 'Nhận một phần' },
  { value: 'received', label: 'Đã nhận đủ' },
];

type DraftLine = { product_id: string; quantity: string; unit_cost: string };
type ReceiveLine = {
  item: PurchaseOrderItem;
  quantity: string;
  unit_price: string;
  expiry_date: string;
  batch_number: string;
};

const emptyDraftLine = (): DraftLine => ({ product_id: '', quantity: '1', unit_cost: '0' });

const getProductName = (item: PurchaseOrderItem) => item.products?.name || item.product_id;

const PurchaseOrdersPage = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | PurchaseOrderStatus>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [receiveOrder, setReceiveOrder] = useState<PurchaseOrder | null>(null);
  const [receiveLines, setReceiveLines] = useState<ReceiveLine[]>([]);
  const [createForm, setCreateForm] = useState({ supplier_id: '', expected_at: '', note: '' });
  const [draftLines, setDraftLines] = useState<DraftLine[]>([emptyDraftLine()]);

  const load = async () => {
    setLoading(true);
    try {
      const query: Record<string, unknown> = { limit: 100 };
      if (statusFilter !== 'all') query.status = statusFilter;
      const [ordersResponse, suppliersResponse, productsResponse] = await Promise.all([
        purchaseOrderAPI.list(query),
        catalogAPI.suppliers.list({ limit: 200, is_active: true }),
        catalogAPI.products.list({ limit: 200, is_active: true }),
      ]);
      setOrders(ordersResponse.data.data.items);
      setSuppliers(suppliersResponse.data.data.items);
      setProducts(productsResponse.data.data.items);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Không thể tải danh sách đơn nhập hàng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [statusFilter]);

  const visibleOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return orders;
    return orders.filter((order) => (
      order.order_number.toLowerCase().includes(term)
      || order.suppliers?.name?.toLowerCase().includes(term)
    ));
  }, [orders, search]);

  const summary = useMemo(() => ({
    total: orders.length,
    awaiting: orders.filter((order) => ['pending', 'approved'].includes(order.status)).length,
    inTransit: orders.filter((order) => ['ordered', 'in_transit', 'partially_received'].includes(order.status)).length,
    value: orders.filter((order) => !['cancelled', 'received'].includes(order.status)).reduce((sum, order) => sum + Number(order.total_amount || 0), 0),
  }), [orders]);

  const updateDraftLine = (index: number, patch: Partial<DraftLine>) => {
    setDraftLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line));
  };

  const resetCreate = () => {
    setCreateForm({ supplier_id: '', expected_at: '', note: '' });
    setDraftLines([emptyDraftLine()]);
    setShowCreate(false);
  };

  const createOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    const items = draftLines.map((line) => ({
      product_id: line.product_id,
      quantity: Number(line.quantity),
      unit_cost: Number(line.unit_cost),
    }));
    if (!createForm.supplier_id || items.some((item) => !item.product_id || !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unit_cost) || item.unit_cost < 0)) {
      toast.error('Vui lòng chọn nhà cung cấp và nhập đủ dòng hàng hợp lệ');
      return;
    }
    if (new Set(items.map((item) => item.product_id)).size !== items.length) {
      toast.error('Mỗi sản phẩm chỉ được xuất hiện một lần trong đơn');
      return;
    }

    setSaving(true);
    try {
      await purchaseOrderAPI.create({
        supplier_id: createForm.supplier_id,
        expected_at: createForm.expected_at ? `${createForm.expected_at}T23:59:59+07:00` : null,
        note: createForm.note || null,
        items,
      });
      toast.success('Đã tạo đơn nhập hàng dạng bản nháp');
      resetCreate();
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Không thể tạo đơn nhập hàng');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (order: PurchaseOrder, status: string) => {
    setSaving(true);
    try {
      const response = await purchaseOrderAPI.updateStatus(order.id, status);
      setSelectedOrder(response.data.data);
      toast.success(`Đã chuyển đơn sang ${statusMeta[status as PurchaseOrderStatus]?.label || status}`);
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Không thể cập nhật trạng thái đơn');
    } finally {
      setSaving(false);
    }
  };

  const openReceive = (order: PurchaseOrder) => {
    const lines = (order.items || [])
      .filter((item) => item.quantity > item.received_quantity)
      .map((item) => ({
        item,
        quantity: String(item.quantity - item.received_quantity),
        unit_price: String(item.unit_cost || 0),
        expiry_date: '',
        batch_number: '',
      }));
    if (lines.length === 0) {
      toast('Đơn này đã nhận đủ hàng');
      return;
    }
    setReceiveOrder(order);
    setReceiveLines(lines);
  };

  const receiveOrderItems = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!receiveOrder) return;
    const items = receiveLines
      .filter((line) => Number(line.quantity) > 0)
      .map((line) => ({
        purchase_order_item_id: line.item.id,
        quantity: Number(line.quantity),
        unit_price: Number(line.unit_price),
        expiry_date: line.expiry_date,
        batch_number: line.batch_number.trim(),
      }));
    if (items.length === 0 || items.some((item) => !Number.isInteger(item.quantity) || item.quantity <= 0 || !item.expiry_date || !item.batch_number || !Number.isFinite(item.unit_price) || item.unit_price < 0)) {
      toast.error('Mỗi dòng nhận phải có số lượng, giá, số lô và HSD');
      return;
    }
    setSaving(true);
    try {
      await purchaseOrderAPI.receive(receiveOrder.id, { paid_amount: 0, items });
      toast.success('Đã nhận hàng, cập nhật tồn kho và lô/HSD thành công');
      setReceiveOrder(null);
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Không thể nhận hàng từ đơn nhập');
    } finally {
      setSaving(false);
    }
  };

  const actionFor = (order: PurchaseOrder) => {
    if (order.status === 'draft') return { label: 'Gửi duyệt', next: 'pending' };
    if (order.status === 'pending') return { label: 'Duyệt đơn', next: 'approved' };
    if (order.status === 'approved') return { label: 'Xác nhận đã đặt', next: 'ordered' };
    if (order.status === 'ordered') return { label: 'Đánh dấu đang về', next: 'in_transit' };
    return null;
  };

  return (
    <div className="min-h-full bg-[#f4f7fb] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-6 flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end">
          <div>
            <button type="button" onClick={() => navigate('/stock')} className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500 hover:text-blue-700">
              <FiArrowLeft /> Kho hàng <FiChevronRight className="text-slate-300" /> Mua hàng
            </button>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-700">Procurement control</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Đơn nhập hàng nhà cung cấp</h1>
            <p className="mt-1 text-sm text-slate-500">Kiểm soát từ đề xuất mua đến hàng về kho, nhận từng phần và đối chiếu lô/HSD.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void load()} className="inline-flex h-11 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:border-blue-400 hover:text-blue-700">
              <FiRefreshCw className={loading ? 'animate-spin' : ''} /> Làm mới
            </button>
            <button type="button" onClick={() => setShowCreate(true)} className="inline-flex h-11 items-center gap-2 bg-blue-700 px-5 text-sm font-black text-white hover:bg-blue-800">
              <FiPlus /> Tạo đơn nhập
            </button>
          </div>
        </div>

        <div className="mb-6 grid gap-px border border-slate-200 bg-slate-200 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Tổng đơn trong kỳ', value: summary.total, icon: FiFileText, tone: 'text-blue-700' },
            { label: 'Chờ duyệt / đã duyệt', value: summary.awaiting, icon: FiClock, tone: 'text-amber-600' },
            { label: 'Đang trên đường', value: summary.inTransit, icon: FiTruck, tone: 'text-violet-700' },
            { label: 'Giá trị đang mở', value: formatCurrency(summary.value), icon: FiPackage, tone: 'text-emerald-700' },
          ].map((metric) => (
            <div key={metric.label} className="bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{metric.label}</p>
                  <p className={`mt-3 text-2xl font-black tracking-tight ${metric.tone}`}>{metric.value}</p>
                </div>
                <metric.icon className={`text-xl ${metric.tone}`} />
              </div>
            </div>
          ))}
        </div>

        <div className="border border-slate-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-1">
              {statusFilters.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setStatusFilter(filter.value)}
                  className={`border px-3 py-2 text-xs font-bold transition ${statusFilter === filter.value ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700'}`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã đơn hoặc nhà cung cấp..." className="h-10 w-full border border-slate-300 px-3 text-sm outline-none focus:border-blue-600 lg:w-80" />
          </div>

          {loading ? (
            <div className="flex h-64 items-center justify-center text-sm font-semibold text-slate-400">Đang tải dữ liệu mua hàng...</div>
          ) : visibleOrders.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-center">
              <FiInbox className="mb-3 text-3xl text-slate-300" />
              <p className="font-bold text-slate-700">Chưa có đơn nhập phù hợp</p>
              <p className="mt-1 text-sm text-slate-400">Tạo bản nháp đầu tiên để bắt đầu theo dõi nguồn hàng.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full text-left">
                <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Đơn nhập</th>
                    <th className="px-5 py-4">Nhà cung cấp</th>
                    <th className="px-5 py-4">Trạng thái</th>
                    <th className="px-5 py-4">Tiến độ nhận</th>
                    <th className="px-5 py-4">Dự kiến về</th>
                    <th className="px-5 py-4 text-right">Giá trị</th>
                    <th className="px-5 py-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleOrders.map((order) => {
                    const received = (order.items || []).reduce((sum, item) => sum + Number(item.received_quantity || 0), 0);
                    const total = (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
                    const progress = total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0;
                    const action = actionFor(order);
                    return (
                      <tr key={order.id} className="group hover:bg-blue-50/40">
                        <td className="px-5 py-4">
                          <button type="button" onClick={() => setSelectedOrder(order)} className="text-left">
                            <p className="font-mono text-sm font-black text-slate-900 group-hover:text-blue-700">{order.order_number}</p>
                            <p className="mt-1 text-xs text-slate-400">{(order.items || []).length} mặt hàng · cập nhật {formatDate(order.updated_at)}</p>
                          </button>
                        </td>
                        <td className="px-5 py-4 text-sm font-bold text-slate-700">{order.suppliers?.name || '—'}</td>
                        <td className="px-5 py-4"><span className={`inline-flex border px-2.5 py-1 text-[11px] font-black ${statusMeta[order.status].tone}`}>{statusMeta[order.status].label}</span></td>
                        <td className="px-5 py-4">
                          <div className="w-36">
                            <div className="mb-1 flex justify-between text-[11px] font-bold text-slate-500"><span>{received}/{total} đơn vị</span><span>{progress}%</span></div>
                            <div className="h-1.5 bg-slate-100"><div className="h-full bg-blue-600" style={{ width: `${progress}%` }} /></div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm font-semibold text-slate-600">{formatDate(order.expected_at)}</td>
                        <td className="px-5 py-4 text-right text-sm font-black text-slate-900">{formatCurrency(order.total_amount)}</td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            {['approved', 'ordered', 'in_transit', 'partially_received'].includes(order.status) && (
                              <button type="button" onClick={() => openReceive(order)} className="border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100">Nhận hàng</button>
                            )}
                            {action && <button type="button" disabled={saving} onClick={() => void changeStatus(order, action.next)} className="border border-blue-300 bg-white px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-50">{action.label}</button>}
                            <button type="button" onClick={() => setSelectedOrder(order)} className="border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:border-blue-400 hover:text-blue-700">Xem</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" onMouseDown={(event) => event.target === event.currentTarget && resetCreate()}>
          <form onSubmit={createOrder} className="max-h-[92vh] w-full max-w-5xl overflow-y-auto border border-slate-300 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 bg-slate-950 px-6 py-5 text-white">
              <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-300">New procurement order</p><h2 className="mt-1 text-xl font-black">Tạo đơn nhập hàng</h2><p className="mt-1 text-xs text-slate-400">Bản nháp chưa làm tăng tồn kho và chưa tính là hàng đang về.</p></div>
              <button type="button" onClick={resetCreate} className="border border-slate-700 p-2 text-slate-300 hover:text-white"><FiX /></button>
            </div>
            <div className="grid gap-5 p-6 md:grid-cols-3">
              <label className="text-xs font-black uppercase tracking-wider text-slate-500">Nhà cung cấp *<select value={createForm.supplier_id} onChange={(event) => setCreateForm({ ...createForm, supplier_id: event.target.value })} className="mt-2 h-11 w-full border border-slate-300 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-800 outline-none focus:border-blue-600"><option value="">Chọn nhà cung cấp</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
              <label className="text-xs font-black uppercase tracking-wider text-slate-500">Ngày dự kiến về<input type="date" value={createForm.expected_at} onChange={(event) => setCreateForm({ ...createForm, expected_at: event.target.value })} className="mt-2 h-11 w-full border border-slate-300 px-3 text-sm font-semibold normal-case tracking-normal text-slate-800 outline-none focus:border-blue-600" /></label>
              <label className="text-xs font-black uppercase tracking-wider text-slate-500">Ghi chú<input value={createForm.note} onChange={(event) => setCreateForm({ ...createForm, note: event.target.value })} placeholder="Điều kiện giao, liên hệ..." className="mt-2 h-11 w-full border border-slate-300 px-3 text-sm font-semibold normal-case tracking-normal text-slate-800 outline-none focus:border-blue-600" /></label>
            </div>
            <div className="px-6 pb-6">
              <div className="mb-3 flex items-center justify-between"><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Danh sách hàng hóa</p><button type="button" onClick={() => setDraftLines([...draftLines, emptyDraftLine()])} className="inline-flex items-center gap-1 border border-blue-300 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-50"><FiPlus /> Thêm dòng</button></div>
              <div className="overflow-x-auto border border-slate-200">
                <table className="min-w-[720px] w-full text-left"><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500"><tr><th className="px-3 py-3">Sản phẩm</th><th className="w-32 px-3 py-3">Số lượng</th><th className="w-40 px-3 py-3">Giá nhập</th><th className="w-12 px-3 py-3" /></tr></thead><tbody className="divide-y divide-slate-100">{draftLines.map((line, index) => <tr key={index}><td className="px-3 py-3"><select value={line.product_id} onChange={(event) => { const product = products.find((item) => item.id === event.target.value); updateDraftLine(index, { product_id: event.target.value, unit_cost: product ? String(product.cost_price || 0) : line.unit_cost }); }} className="h-10 w-full border border-slate-300 bg-white px-2 text-sm outline-none focus:border-blue-600"><option value="">Chọn sản phẩm</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.sku}</option>)}</select></td><td className="px-3 py-3"><input type="number" min="1" value={line.quantity} onChange={(event) => updateDraftLine(index, { quantity: event.target.value })} className="h-10 w-full border border-slate-300 px-2 text-sm outline-none focus:border-blue-600" /></td><td className="px-3 py-3"><input type="number" min="0" value={line.unit_cost} onChange={(event) => updateDraftLine(index, { unit_cost: event.target.value })} className="h-10 w-full border border-slate-300 px-2 text-sm outline-none focus:border-blue-600" /></td><td className="px-3 py-3 text-center">{draftLines.length > 1 && <button type="button" onClick={() => setDraftLines(draftLines.filter((_, lineIndex) => lineIndex !== index))} className="p-2 text-rose-600 hover:bg-rose-50"><FiX /></button>}</td></tr>)}</tbody></table>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4"><button type="button" onClick={resetCreate} className="border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-600">Hủy</button><button type="submit" disabled={saving} className="bg-blue-700 px-5 py-2.5 text-sm font-black text-white disabled:opacity-50">{saving ? 'Đang lưu...' : 'Lưu bản nháp'}</button></div>
          </form>
        </div>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" onMouseDown={(event) => event.target === event.currentTarget && setSelectedOrder(null)}>
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto border border-slate-300 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 bg-slate-950 px-6 py-5 text-white"><div><p className="font-mono text-xs text-blue-300">{selectedOrder.order_number}</p><h2 className="mt-1 text-xl font-black">Chi tiết đơn nhập hàng</h2><p className="mt-1 text-xs text-slate-400">{selectedOrder.suppliers?.name || 'Chưa có nhà cung cấp'} · tạo ngày {formatDate(selectedOrder.created_at)}</p></div><button type="button" onClick={() => setSelectedOrder(null)} className="border border-slate-700 p-2 text-slate-300 hover:text-white"><FiX /></button></div>
            <div className="grid gap-px border-b border-slate-200 bg-slate-200 sm:grid-cols-3"><div className="bg-white p-4"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Trạng thái</p><span className={`mt-2 inline-flex border px-2.5 py-1 text-xs font-black ${statusMeta[selectedOrder.status].tone}`}>{statusMeta[selectedOrder.status].label}</span></div><div className="bg-white p-4"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Dự kiến về</p><p className="mt-2 text-sm font-black text-slate-800">{formatDate(selectedOrder.expected_at)}</p></div><div className="bg-white p-4"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Tổng đơn</p><p className="mt-2 text-sm font-black text-slate-800">{formatCurrency(selectedOrder.total_amount)}</p></div></div>
            <div className="p-6"><div className="mb-3 flex items-center justify-between"><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Dòng hàng & tiến độ nhận</p>{['approved', 'ordered', 'in_transit', 'partially_received'].includes(selectedOrder.status) && <button type="button" onClick={() => { setSelectedOrder(null); openReceive(selectedOrder); }} className="inline-flex items-center gap-2 bg-emerald-700 px-4 py-2 text-xs font-black text-white"><FiInbox /> Nhận hàng</button>}</div><div className="overflow-x-auto border border-slate-200"><table className="min-w-[680px] w-full text-left"><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500"><tr><th className="px-3 py-3">Sản phẩm</th><th className="px-3 py-3">SKU</th><th className="px-3 py-3 text-right">Đặt</th><th className="px-3 py-3 text-right">Đã nhận</th><th className="px-3 py-3 text-right">Còn lại</th><th className="px-3 py-3 text-right">Giá nhập</th></tr></thead><tbody className="divide-y divide-slate-100">{(selectedOrder.items || []).map((item) => <tr key={item.id}><td className="px-3 py-3 text-sm font-bold text-slate-800">{getProductName(item)}</td><td className="px-3 py-3 font-mono text-xs text-slate-500">{item.products?.sku || '—'}</td><td className="px-3 py-3 text-right text-sm font-bold">{item.quantity}</td><td className="px-3 py-3 text-right text-sm font-bold text-emerald-700">{item.received_quantity}</td><td className="px-3 py-3 text-right text-sm font-black text-orange-700">{Math.max(0, item.quantity - item.received_quantity)}</td><td className="px-3 py-3 text-right text-sm font-bold">{formatCurrency(item.unit_cost)}</td></tr>)}</tbody></table></div></div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">{actionFor(selectedOrder) && <button type="button" disabled={saving} onClick={() => void changeStatus(selectedOrder, actionFor(selectedOrder)!.next)} className="bg-blue-700 px-4 py-2.5 text-sm font-black text-white">{actionFor(selectedOrder)!.label}</button>}{!['received', 'cancelled'].includes(selectedOrder.status) && <button type="button" disabled={saving} onClick={() => void changeStatus(selectedOrder, 'cancelled')} className="border border-rose-300 bg-white px-4 py-2.5 text-sm font-black text-rose-700">Huỷ đơn</button>}<button type="button" onClick={() => setSelectedOrder(null)} className="border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-600">Đóng</button></div>
          </div>
        </div>
      )}

      {receiveOrder && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4" onMouseDown={(event) => event.target === event.currentTarget && setReceiveOrder(null)}>
          <form onSubmit={receiveOrderItems} className="max-h-[94vh] w-full max-w-6xl overflow-y-auto border border-slate-300 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 bg-emerald-950 px-6 py-5 text-white"><div><p className="font-mono text-xs text-emerald-300">{receiveOrder.order_number}</p><h2 className="mt-1 text-xl font-black">Nhận hàng vào kho</h2><p className="mt-1 text-xs text-emerald-200/70">Nhập số lô và HSD riêng cho từng dòng để hệ thống theo dõi FEFO.</p></div><button type="button" onClick={() => setReceiveOrder(null)} className="border border-emerald-800 p-2 text-emerald-200 hover:text-white"><FiX /></button></div>
            <div className="p-6"><div className="mb-4 border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">Chỉ số lượng thực nhận mới được cộng vào tồn. Có thể sửa số lượng để nhận một phần; phần còn lại vẫn giữ là hàng đang về.</div><div className="overflow-x-auto border border-slate-200"><table className="min-w-[980px] w-full text-left"><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500"><tr><th className="px-3 py-3">Sản phẩm</th><th className="w-28 px-3 py-3 text-right">Còn phải nhận</th><th className="w-28 px-3 py-3">Thực nhận</th><th className="w-36 px-3 py-3">Giá nhập</th><th className="w-44 px-3 py-3">Số lô *</th><th className="w-44 px-3 py-3">HSD *</th></tr></thead><tbody className="divide-y divide-slate-100">{receiveLines.map((line, index) => { const outstanding = line.item.quantity - line.item.received_quantity; return <tr key={line.item.id}><td className="px-3 py-3"><p className="text-sm font-bold text-slate-800">{getProductName(line.item)}</p><p className="mt-1 font-mono text-[11px] text-slate-400">{line.item.products?.sku || '—'}</p></td><td className="px-3 py-3 text-right text-sm font-black text-orange-700">{outstanding}</td><td className="px-3 py-3"><input type="number" min="0" max={outstanding} value={line.quantity} onChange={(event) => setReceiveLines(receiveLines.map((current, lineIndex) => lineIndex === index ? { ...current, quantity: event.target.value } : current))} className="h-10 w-full border border-slate-300 px-2 text-sm outline-none focus:border-emerald-600" /></td><td className="px-3 py-3"><input type="number" min="0" value={line.unit_price} onChange={(event) => setReceiveLines(receiveLines.map((current, lineIndex) => lineIndex === index ? { ...current, unit_price: event.target.value } : current))} className="h-10 w-full border border-slate-300 px-2 text-sm outline-none focus:border-emerald-600" /></td><td className="px-3 py-3"><input value={line.batch_number} onChange={(event) => setReceiveLines(receiveLines.map((current, lineIndex) => lineIndex === index ? { ...current, batch_number: event.target.value } : current))} placeholder="VD: LOT-2026-01" className="h-10 w-full border border-slate-300 px-2 text-sm outline-none focus:border-emerald-600" /></td><td className="px-3 py-3"><input type="date" value={line.expiry_date} onChange={(event) => setReceiveLines(receiveLines.map((current, lineIndex) => lineIndex === index ? { ...current, expiry_date: event.target.value } : current))} className="h-10 w-full border border-slate-300 px-2 text-sm outline-none focus:border-emerald-600" /></td></tr>; })}</tbody></table></div></div>
            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4"><button type="button" onClick={() => setReceiveOrder(null)} className="border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-600">Hủy</button><button type="submit" disabled={saving} className="bg-emerald-700 px-5 py-2.5 text-sm font-black text-white disabled:opacity-50">{saving ? 'Đang cập nhật...' : 'Xác nhận nhận hàng'}</button></div>
          </form>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrdersPage;
